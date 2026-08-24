import { PrismaClient } from '@prisma/client';

// Dimensionne explicitement le pool de connexions (défaut 20) — cf. AN-2026-017,
// où le pool par défaut saturait sous le pic d'ouverture des ventes. La limite est
// exposée via DATABASE_CONNECTION_LIMIT. Lecture directe de process.env pour rester
// insensible à l'ordre d'initialisation (les tests d'intégration fixent l'URL à chaud).
function pooledUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', process.env.DATABASE_CONNECTION_LIMIT ?? '20');
    }
    return url.toString();
  } catch {
    return undefined; // URL non parsable : on laisse Prisma la lire du schéma
  }
}

const url = pooledUrl();
export const prisma = url
  ? new PrismaClient({ datasources: { db: { url } } })
  : new PrismaClient();
