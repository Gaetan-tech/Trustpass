import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

// Vue d'ensemble multi-événements du dashboard organisateur (KAN-51) :
// agrégats par événement (billets émis / revendus / transférés + recette) et
// isolation stricte par organisateur. Sur Postgres + Redis réels (testcontainers).
let pg: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;
let app: Express;
let prisma: PrismaClient;

// Seed complet : un organisateur A avec un événement instrumenté (statuts,
// commandes, don) et un organisateur B avec son propre événement (pour l'isolation).
async function seed() {
  const argon2 = (await import('argon2')).default;
  const { generateQr } = await import('../../src/lib/qr.js');
  const pwd = await argon2.hash('password123');
  const uid = crypto.randomUUID().slice(0, 8);

  const orgA = await prisma.user.create({
    data: { email: `orgA-${uid}@it.dev`, passwordHash: pwd, role: 'organizer', emailVerifiedAt: new Date() },
  });
  const orgB = await prisma.user.create({
    data: { email: `orgB-${uid}@it.dev`, passwordHash: pwd, role: 'organizer', emailVerifiedAt: new Date() },
  });
  const seller = await prisma.user.create({
    data: { email: `seller-${uid}@it.dev`, passwordHash: pwd, role: 'seller', emailVerifiedAt: new Date() },
  });
  const buyer = await prisma.user.create({
    data: { email: `buyer-${uid}@it.dev`, passwordHash: pwd, role: 'buyer', emailVerifiedAt: new Date() },
  });

  const eventA = await prisma.event.create({
    data: { organizerId: orgA.id, name: 'Fest A', startsAt: new Date(Date.now() + 30 * 864e5) },
  });
  const eventB = await prisma.event.create({
    data: { organizerId: orgB.id, name: 'Fest B', startsAt: new Date(Date.now() + 30 * 864e5) },
  });

  // 3 billets émis pour l'événement A → breakdown { sold, listed, owned }.
  const t1 = await prisma.ticket.create({
    data: { eventId: eventA.id, ownerId: buyer.id, status: 'sold', qrCode: generateQr(`a1-${uid}`, 1) },
  });
  const t2 = await prisma.ticket.create({
    data: { eventId: eventA.id, ownerId: seller.id, status: 'listed', qrCode: generateQr(`a2-${uid}`, 1) },
  });
  const t3 = await prisma.ticket.create({
    data: { eventId: eventA.id, ownerId: seller.id, status: 'owned', qrCode: generateQr(`a3-${uid}`, 1) },
  });
  // Billet de l'événement B (ne doit jamais apparaître pour l'organisateur A).
  await prisma.ticket.create({
    data: { eventId: eventB.id, ownerId: seller.id, status: 'owned', qrCode: generateQr(`b1-${uid}`, 1) },
  });

  const mkOrder = async (ticketId: string, status: 'transferred' | 'paid' | 'pending', amount: number) => {
    const listing = await prisma.listing.create({
      data: { ticketId, sellerId: seller.id, price: amount, status: status === 'transferred' ? 'sold' : 'active' },
    });
    await prisma.order.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount,
        commission: Math.round(amount * 0.05),
        status,
        idempotencyKey: crypto.randomUUID(),
      },
    });
  };

  // Recette = 5000 (transferred) + 3000 (paid) ; la commande pending (9999) est exclue.
  // Revendus = 1 (seule la commande transferred compte).
  await mkOrder(t1.id, 'transferred', 5000);
  await mkOrder(t2.id, 'paid', 3000);
  await mkOrder(t3.id, 'pending', 9999);

  // Un don nominatif (hors marketplace) sur l'événement A → transférés = 1.
  await prisma.transfer.create({
    data: {
      ticketId: t3.id,
      kind: 'gift',
      fromUserId: seller.id,
      toHolderName: 'Alex Martin',
      oldQrCode: t3.qrCode,
      newQrCode: generateQr(`a3-${uid}`, 2),
    },
  });

  return { orgA, orgB, eventA, eventB };
}

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  redis = await new RedisContainer('redis:7-alpine').start();

  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.REDIS_URL = redis.getConnectionUrl();

  execSync('npx prisma db push --skip-generate --accept-data-loss', { env: process.env, stdio: 'inherit' });

  app = (await import('../../src/app.js')).createApp();
  prisma = (await import('../../src/lib/prisma.js')).prisma;
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await pg?.stop();
  await redis?.stop();
});

async function login(email: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'password123' });
  return res.body.accessToken as string;
}

describe('GET /organizer/dashboard (intégration)', () => {
  it('agrège billets émis / revendus / transférés + recette par événement', async () => {
    const { orgA, eventA } = await seed();
    const token = await login(orgA.email);

    const res = await request(app)
      .get('/api/v1/organizer/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.data.find((r: { eventId: string }) => r.eventId === eventA.id);
    expect(row).toBeDefined();
    expect(row.ticketsIssued).toBe(3);
    expect(row.ticketsResold).toBe(1); // seule la commande transferred
    expect(row.ticketsTransferred).toBe(1); // don nominatif
    expect(row.revenue).toBe(8000); // 5000 + 3000, la commande pending exclue
    expect(row.statusBreakdown).toMatchObject({ sold: 1, listed: 1, owned: 1, reserved: 0, used: 0, invalidated: 0 });
  });

  it('agrège les totaux tous événements confondus', async () => {
    const { orgA } = await seed();
    const token = await login(orgA.email);

    const res = await request(app)
      .get('/api/v1/organizer/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.totals).toMatchObject({
      events: 1,
      ticketsIssued: 3,
      ticketsResold: 1,
      ticketsTransferred: 1,
      revenue: 8000,
    });
  });

  it("n'expose jamais les événements d'un autre organisateur (isolation)", async () => {
    const { orgA, eventB } = await seed();
    const token = await login(orgA.email);

    const res = await request(app)
      .get('/api/v1/organizer/dashboard')
      .set('Authorization', `Bearer ${token}`);

    const ids = res.body.data.map((r: { eventId: string }) => r.eventId);
    expect(ids).not.toContain(eventB.id);
  });

  it('refuse un utilisateur non-organisateur (403)', async () => {
    const uid = crypto.randomUUID().slice(0, 8);
    const argon2 = (await import('argon2')).default;
    await prisma.user.create({
      data: { email: `buyer-only-${uid}@it.dev`, passwordHash: await argon2.hash('password123'), role: 'buyer', emailVerifiedAt: new Date() },
    });
    const token = await login(`buyer-only-${uid}@it.dev`);

    const res = await request(app)
      .get('/api/v1/organizer/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
