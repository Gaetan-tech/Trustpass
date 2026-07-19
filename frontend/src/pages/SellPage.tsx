import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMyTickets } from '../features/tickets/useMyTickets';
import { useAttachTicket } from '../features/tickets/useAttachTicket';
import { useCreateListing } from '../features/listings/useCreateListing';
import { useEvents } from '../features/events/useEvents';
import { useAuth } from '../store/auth';
import { ApiRequestError } from '../lib/api';

// Espace vendeur : rattacher un billet (US-2.1) puis le mettre en revente (US-3.1).
export function SellPage() {
  const user = useAuth((s) => s.user);
  const owned = useMyTickets('owned');
  const attach = useAttachTicket();
  const createListing = useCreateListing();
  const events = useEvents();

  const [eventId, setEventId] = useState('');
  const [ticketRef, setTicketRef] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});

  if (!user) return <p className="p-10 text-center text-slate-500">Connecte-toi pour vendre un billet.</p>;

  async function handleAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;
    await attach.mutateAsync({ eventId, ticketRef });
    setEventId('');
    setTicketRef('');
  }

  const attachError = attach.error instanceof ApiRequestError ? attach.error : null;

  async function handlePublish(ticketId: string) {
    const euros = Number(prices[ticketId]);
    if (!euros || euros <= 0) return;
    await createListing.mutateAsync({ ticketId, price: Math.round(euros * 100) });
  }

  const listingError = createListing.error instanceof ApiRequestError ? createListing.error : null;

  return (
    <section className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Vendre un billet</h1>

      <motion.form
        onSubmit={handleAttach}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 space-y-3 rounded-2xl glass p-5"
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-white">1</span>
          Rattacher un billet
        </h2>
        <label className="block text-sm text-slate-600">
          Événement
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
            className="input-dark mt-1"
            aria-label="Événement"
          >
            <option value="" disabled>
              {events.isLoading ? 'Chargement…' : '— Choisir un événement —'}
            </option>
            {events.data?.data.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.venue ? ` · ${ev.venue}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-600">
          Numéro de référence du billet (code QR)
          <input
            value={ticketRef}
            onChange={(e) => setTicketRef(e.target.value)}
            required
            className="input-dark mt-1 font-mono"
            placeholder="ex. TP.XXXX… ou ABC-12345"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Référence unique du billet (son code QR d'origine). Un nouveau QR sera généré à chaque transfert.
          </span>
        </label>
        <motion.button type="submit" disabled={attach.isPending} whileTap={{ scale: 0.97 }} className="btn-neon">
          {attach.isPending ? 'Rattachement…' : 'Rattacher'}
        </motion.button>
        {attachError && (
          <p className="text-sm text-red-600" role="alert">
            {attachError.code === 'TICKET_ALREADY_ATTACHED'
              ? 'Ce billet est déjà rattaché à un compte.'
              : attachError.code === 'TICKET_NOT_ELIGIBLE'
                ? "Ce billet n'est pas éligible à la revente."
                : 'Échec du rattachement.'}
          </p>
        )}
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-3 rounded-2xl glass p-5"
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-white">2</span>
          Mettre en revente
        </h2>
        {owned.isLoading && <p className="text-slate-500">Chargement…</p>}
        {owned.data?.data.length === 0 && <p className="text-sm text-slate-500">Aucun billet disponible à la revente.</p>}
        {listingError && (
          <p className="text-sm text-red-600" role="alert">
            {listingError.code === 'PRICE_ABOVE_CAP'
              ? 'Prix au-dessus du plafond autorisé par l’organisateur.'
              : listingError.code === 'RESALE_WINDOW_CLOSED'
                ? 'La fenêtre de revente est fermée.'
                : 'Publication impossible.'}
          </p>
        )}
        <ul className="space-y-3">
          {owned.data?.data.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/60 p-3">
              <span className="font-medium">{t.event.name}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={prices[t.id] ?? ''}
                  onChange={(e) => setPrices((p) => ({ ...p, [t.id]: e.target.value }))}
                  className="input-dark w-24 text-right"
                  aria-label={`Prix pour ${t.event.name}`}
                  placeholder="€"
                />
                <motion.button
                  type="button"
                  onClick={() => handlePublish(t.id)}
                  disabled={createListing.isPending}
                  whileTap={{ scale: 0.95 }}
                  className="btn-neon px-3 py-1.5 text-sm"
                >
                  Publier
                </motion.button>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
