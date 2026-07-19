import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { generateQr } from '../src/lib/qr.js';

// Seed de démonstration : comptes + plusieurs événements avec annonces actives,
// de quoi alimenter le carrousel, les pages détail et le tunnel d'achat.
const prisma = new PrismaClient();

const EVENTS = [
  { name: 'TrustPass Live 2026', venue: 'Accor Arena, Paris', days: 30, type: 'Fosse', face: 4500, price: 5000 },
  { name: 'Neon Nights Festival', venue: 'Parc des Expositions, Lyon', days: 45, type: 'Pass 1 jour', face: 6000, price: 6500 },
  { name: 'Bass Drop Warehouse', venue: 'La Halle, Marseille', days: 12, type: 'Early bird', face: 3000, price: 3500 },
  { name: 'Sunset Électro', venue: 'Plage du Prado, Nice', days: 60, type: 'VIP', face: 9000, price: 9500 },
];

async function main() {
  const pwd = await argon2.hash('password123');

  const organizer = await prisma.user.create({
    data: { email: 'organizer@trustpass.dev', passwordHash: pwd, role: 'organizer', emailVerifiedAt: new Date() },
  });
  const seller = await prisma.user.create({
    data: { email: 'seller@trustpass.dev', passwordHash: pwd, role: 'seller', emailVerifiedAt: new Date() },
  });
  await prisma.user.create({
    data: { email: 'buyer@trustpass.dev', passwordHash: pwd, role: 'buyer', emailVerifiedAt: new Date() },
  });
  await prisma.user.create({
    data: { email: 'controller@trustpass.dev', passwordHash: pwd, role: 'controller', emailVerifiedAt: new Date() },
  });

  for (const [idx, e] of EVENTS.entries()) {
    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        name: e.name,
        venue: e.venue,
        startsAt: new Date(Date.now() + e.days * 24 * 3600 * 1000),
      },
    });
    const ticketType = await prisma.ticketType.create({
      data: { eventId: event.id, name: e.type, faceValue: e.face },
    });
    await prisma.organizerRule.create({
      data: { eventId: event.id, ticketTypeId: null, priceCap: Math.round(e.face * 1.3), commissionBps: 500 },
    });

    // 2 annonces actives par événement.
    for (let n = 0; n < 2; n++) {
      const ticket = await prisma.ticket.create({
        data: {
          eventId: event.id,
          ticketTypeId: ticketType.id,
          ownerId: seller.id,
          status: 'listed',
          qrCode: generateQr(`seed-${idx}-${n}`, 1),
        },
      });
      await prisma.listing.create({
        data: { ticketId: ticket.id, sellerId: seller.id, price: e.price + n * 500, status: 'active' },
      });
    }
  }

  console.log('Seed terminé. Comptes: organizer/seller/buyer/controller @trustpass.dev — mot de passe: password123');
  console.log(`${EVENTS.length} événements créés, 2 annonces actives chacun.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
