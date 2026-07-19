import type { AuditAction, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma.js';

type Db = PrismaClient | Prisma.TransactionClient;

interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  amount?: number | null;
  metadata?: Prisma.InputJsonValue;
}

// Écrit une entrée dans le journal append-only (US-10.1).
// Passer le client transactionnel `tx` pour rester atomique avec l'opération métier.
export function writeAudit(input: AuditInput, db: Db = prisma) {
  return db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      amount: input.amount ?? null,
      metadata: input.metadata,
    },
  });
}
