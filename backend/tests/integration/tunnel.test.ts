import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

// Test d'intégration du tunnel de revente complet, sur Postgres + Redis réels.
// Nécessite Docker en cours d'exécution (testcontainers).
let pg: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;
let app: Express;
let prisma: PrismaClient;

async function seed() {
  const argon2 = (await import('argon2')).default;
  const { generateQr } = await import('../../src/lib/qr.js');
  const pwd = await argon2.hash('password123');
  const uid = crypto.randomUUID().slice(0, 8); // emails uniques par test

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
    data: { organizerId: organizer.id, name: 'IT Fest', startsAt: new Date(Date.now() + 30 * 864e5) },
  });
  await prisma.organizerRule.create({
    data: { eventId: event.id, ticketTypeId: null, priceCap: 6000, commissionBps: 500 },
  });
  const ticket = await prisma.ticket.create({
    data: { eventId: event.id, ownerId: seller.id, status: 'listed', qrCode: generateQr('it', 1) },
  });
  const listing = await prisma.listing.create({
    data: { ticketId: ticket.id, sellerId: seller.id, price: 5000, status: 'active' },
  });
  return { seller, buyer, ticket, listing };
}

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  redis = await new RedisContainer('redis:7-alpine').start();

  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.REDIS_URL = redis.getConnectionUrl();

  // Crée le schéma dans la base éphémère (sans fichier de migration).
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: process.env,
    stdio: 'inherit',
  });

  // Import dynamique APRÈS avoir fixé les URLs (env validé à l'import).
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

describe('tunnel de revente (intégration)', () => {
  it('achat -> webhook -> transfert atomique + rotation QR', async () => {
    const { buyer, ticket, listing } = await seed();
    const token = await login(buyer.email);
    const oldQr = ticket.qrCode;

    // 1) Réservation + création de l'intent (mode Stripe simulé).
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ listingId: listing.id });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.orderId as string;

    // L'annonce est désormais réservée.
    const reserved = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(reserved.status).toBe('reserved');

    // 2) Webhook de paiement réussi (source de vérité) -> transfert.
    const webhookRes = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send({ id: 'evt_it_1', type: 'payment_intent.succeeded', data: { object: { metadata: { orderId } } } });
    expect(webhookRes.status).toBe(200);

    // 3) Vérifs des invariants.
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('transferred');

    const updatedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updatedTicket.ownerId).toBe(buyer.id); // propriété transférée
    expect(updatedTicket.qrCode).not.toBe(oldQr); // QR pivoté
    expect(updatedTicket.qrVersion).toBe(2);

    const soldListing = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(soldListing.status).toBe('sold');

    const transfer = await prisma.transfer.findUniqueOrThrow({ where: { orderId } });
    expect(transfer.oldQrCode).toBe(oldQr);
    expect(transfer.newQrCode).toBe(updatedTicket.qrCode);
  });

  it('empêche la double réservation concurrente (409)', async () => {
    const { buyer, listing } = await seed();
    const token = await login(buyer.email);

    const first = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ listingId: listing.id });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ listingId: listing.id });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('LISTING_RESERVED');
  });

  it('refuse une publication au-dessus du plafond (422)', async () => {
    const { seller, ticket } = await seed();
    // Remet le billet en "owned" pour pouvoir republier.
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'owned' } });
    const token = await login(seller.email);

    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticketId: ticket.id, price: 9999 }); // > priceCap 6000
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRICE_ABOVE_CAP');
  });
});
