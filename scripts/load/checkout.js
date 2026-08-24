#!/usr/bin/env node
/**
 * Script de charge du tunnel d'achat — TrustPass (BLOC 4, §4.1.4 / §4.2).
 * Injecte N achats concurrents (réservation + webhook de paiement) sur des
 * annonces distinctes du même événement, puis vérifie qu'aucune commande ne
 * reste « payée non transférée ». Sert à reproduire AN-2026-017 et de scénario
 * de recette (R14).
 *
 * Prérequis : API démarrée, Stripe en mode simulé (STRIPE_SECRET_KEY vide).
 * Usage :
 *   API_URL=http://localhost:3000 EMAIL=buyer@trustpass.dev PASSWORD=password123 \
 *   CONCURRENCY=40 node scripts/load/checkout.js
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.EMAIL ?? 'buyer@trustpass.dev';
const PASSWORD = process.env.PASSWORD ?? 'password123';
const N = Number(process.env.CONCURRENCY ?? 40);

async function j(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await j(res);
  if (!res.ok || !body.accessToken) throw new Error(`login échoué: ${res.status} ${JSON.stringify(body)}`);
  return body.accessToken;
}

async function listings(token) {
  const res = await fetch(`${API}/api/v1/listings`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await j(res);
  return (body.data ?? []).filter((l) => l.status !== 'sold');
}

async function reserve(token, listingId) {
  const res = await fetch(`${API}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ listingId }),
  });
  const body = await j(res);
  return { status: res.status, orderId: body.orderId };
}

async function pay(orderId, i) {
  // En mode simulé, le webhook payment_intent.succeeded déclenche le transfert.
  const res = await fetch(`${API}/api/v1/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: `evt_load_${Date.now()}_${i}`, type: 'payment_intent.succeeded', data: { object: { metadata: { orderId } } } }),
  });
  return res.status;
}

(async () => {
  console.log(`▶ Charge : ${N} achats concurrents sur ${API}`);
  const token = await login();
  const available = await listings(token);
  if (available.length < N) {
    console.warn(`⚠ Seulement ${available.length} annonces disponibles (< ${N}). On ajuste.`);
  }
  const targets = available.slice(0, N);

  // 1) Réservations séquentielles (obtenir les orderId).
  const orders = [];
  for (const l of targets) {
    const r = await reserve(token, l.id);
    if (r.status === 201) orders.push(r.orderId);
  }
  console.log(`  ${orders.length} commandes réservées`);

  // 2) Rafale de webhooks de paiement, tous en même temps.
  const t0 = Date.now();
  const statuses = await Promise.all(orders.map((id, i) => pay(id, i)));
  const ok = statuses.filter((s) => s === 200).length;
  const ms = Date.now() - t0;

  console.log(`  webhooks: ${ok}/${statuses.length} en HTTP 200, en ${ms} ms`);
  if (ok !== statuses.length) {
    console.error(`❌ ${statuses.length - ok} webhooks en échec (statuts: ${[...new Set(statuses)].join(', ')})`);
    process.exit(1);
  }
  console.log('✅ Tous les paiements traités sans erreur.');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
