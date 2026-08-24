import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

// Test de non-régression de l'anomalie AN-2026-017 (BLOC 4, §4.2.2) : une rafale
// de webhooks concurrents ne doit produire ni erreur ni commande orpheline
// (commande payée sans transfert). Écrit AVANT le correctif — il échouait alors.
// Nécessite Docker (testcontainers).
let pg: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;
let app: Express;
let prisma: PrismaClient;

async function seedEventWithListings(n: number) {
  const argon2 = (await import('argon2')).default;
  const { generateQr } = await import('../../src/lib/qr.js');
  const pwd = await argon2.hash('password123');
  const uid = crypto.randomUUID().slice(0, 8);

  const seller = await prisma.user.create({
    data: { email: `seller-${uid}@it.dev`, passwordHash: pwd, role: 'seller', emailVerifiedAt: new Date() },
  });
  const buyer = await prisma.user.create({
    data: { email: `buyer-${uid}@it.dev`, passwordHash: pwd, role: 'buyer', emailVerifiedAt: new Date() },
  });
  const organizer = await prisma.user.create({
    data: { email: `org-${uid}@it.dev`, passwordHash: pwd, role: 'organizer', emailVerifiedAt: new Date() },
  });
  const event = await prisma.event.create({
    data: { organizerId: organizer.id, name: 'Bass Drop Warehouse', startsAt: new Date(Date.now() + 30 * 864e5) },
  });
  await prisma.organizerRule.create({
    data: { eventId: event.id, ticketTypeId: null, priceCap: 20000, commissionBps: 500 },
  });

  // Crée directement N commandes réservées (comme seedPaidOrders du dossier) :
  // on cible la concurrence des WEBHOOKS, pas le rate-limiter de POST /orders.
  const reservedUntil = new Date(Date.now() + 10 * 60_000);
  const orderIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const ticket = await prisma.ticket.create({
      data: { eventId: event.id, ownerId: seller.id, status: 'reserved', qrCode: generateQr(`conc-${uid}-${i}`, 1) },
    });
    const listing = await prisma.listing.create({
      data: { ticketId: ticket.id, sellerId: seller.id, price: 5000, status: 'reserved', reservedBy: buyer.id, reservedUntil },
    });
    const order = await prisma.order.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount: 5000,
        commission: 250,
        idempotencyKey: `conc-${uid}-${i}`,
        status: 'pending',
      },
    });
    orderIds.push(order.id);
  }
  return { buyer, orderIds };
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

describe('webhooks concurrents (AN-2026-017)', () => {
  it('traite 40 webhooks concurrents sans erreur et sans commande orpheline', async () => {
    const N = 40;
    const { orderIds } = await seedEventWithListings(N);

    // Rafale de N webhooks de paiement, tous en même temps.
    const responses = await Promise.all(
      orderIds.map((orderId, i) =>
        request(app)
          .post('/api/v1/webhooks/stripe')
          .set('Content-Type', 'application/json')
          .send({ id: `evt_conc_${i}`, type: 'payment_intent.succeeded', data: { object: { metadata: { orderId } } } }),
      ),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true); // échouait avant correctif

    // Invariant métier : aucune commande payée sans transfert.
    const orphelines = await prisma.order.count({ where: { status: 'paid', transfer: { is: null } } });
    expect(orphelines).toBe(0);

    // Toutes les commandes sont bien transférées.
    const transferees = await prisma.order.count({ where: { id: { in: orderIds }, status: 'transferred' } });
    expect(transferees).toBe(N);
  }, 120_000);
});
