import crypto from 'node:crypto';
import { env } from '../config/env.js';

// QR opaque et signé (HMAC). À chaque transfert, on génère un nouveau code
// (nouvelle version) ce qui invalide de facto l'ancien (cf. US-5.1).
// Numéro de référence lisible et unique du billet (distinct du QR signé).
// Régénéré à chaque génération/transfert pour identifier l'état courant du billet.
export function generateReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 (lisibilité)
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `TP-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export function generateQr(ticketId: string, version: number): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${ticketId}.${version}.${nonce}`;
  const sig = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(payload)
    .digest('base64url')
    .slice(0, 24);
  return `TP.${payload}.${sig}`;
}
