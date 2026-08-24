import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useMyTickets } from '../features/tickets/useMyTickets';
import { useTransferTicket } from '../features/tickets/useTransferTicket';
import { useFinalizeOrder } from '../features/orders/useFinalizeOrder';
import { TicketPreviewModal } from '../features/tickets/TicketPreviewModal';
import { useAuth } from '../store/auth';
import { ApiRequestError } from '../lib/api';
import { eventPhoto } from '../lib/concertPhoto';
import type { Ticket } from '../types/api';

const STATUS_STYLE: Record<string, string> = {
  owned: 'border-carbon bg-carbon text-white',
  listed: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  used: 'border-zinc-200 bg-zinc-50 text-zinc-400',
};

const FALLBACK_STATUS = 'border-zinc-300 bg-zinc-100 text-zinc-500';

// « Mes billets » (US-2.1) + transfert nominatif à un proche (US-5.2).
export function MyTicketsPage() {
  const user = useAuth((s) => s.user);
  const { data, isLoading, isError } = useMyTickets();
  const [preview, setPreview] = useState<Ticket | null>(null);

  // Retour de Stripe Checkout (?purchased=<orderId>) : confirme le paiement.
  const [params, setParams] = useSearchParams();
  const purchasedOrderId = params.get('purchased');
  const finalize = useFinalizeOrder();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!purchasedOrderId) return;
    finalize.mutate(purchasedOrderId, {
      onSettled: (res) => {
        if (res?.status === 'transferred') setConfirmed(true);
        params.delete('purchased');
        setParams(params, { replace: true });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchasedOrderId]);

  if (!user) return <EmptyState>Connecte-toi pour voir tes billets.</EmptyState>;

  return (
    <section className="px-5 py-10">
      <h1 className="poster-title mb-6 text-4xl sm:text-5xl">Mes billets</h1>

      {(finalize.isPending || confirmed) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 rounded-xl border p-3 text-sm ${
            confirmed
              ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
          role="status"
        >
          {confirmed ? '✅ Paiement confirmé — ton nouveau billet est ci-dessous.' : 'Confirmation du paiement en cours…'}
        </motion.div>
      )}

      {isLoading && <p className="text-slate-500">Chargement…</p>}
      {isError && (
        <p className="text-red-600" role="alert">
          Erreur de chargement.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data?.data.map((t, i) => (
          <TicketCard key={t.id} ticket={t} index={i} onPreview={setPreview} />
        ))}
      </div>
      {data && data.data.length === 0 && <EmptyState>🎟️ Tu n'as pas encore de billet.</EmptyState>}

      <TicketPreviewModal ticket={preview} onClose={() => setPreview(null)} />
    </section>
  );
}

function TicketCard({ ticket, index, onPreview }: { ticket: Ticket; index: number; onPreview: (t: Ticket) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-2xl glass"
    >
      {/* Bandeau photo de concert du billet */}
      <div className="relative h-24 overflow-hidden bg-carbon">
        <img
          src={eventPhoto(ticket.event, 640)}
          alt=""
          className="photo-mono absolute inset-0 h-full w-full object-cover group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 to-transparent" />
        <span
          className={`absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            STATUS_STYLE[ticket.status] ?? FALLBACK_STATUS
          }`}
        >
          {ticket.status}
        </span>
      </div>

      <div className="p-5">
        <span className="font-semibold text-carbon">{ticket.event.name}</span>
        <p className="mt-1 text-sm text-zinc-500">{ticket.ticketType?.name ?? 'Billet'}</p>

        {ticket.reference && (
          <p className="mt-1 text-xs text-zinc-400">
            Réf. <code className="font-mono text-zinc-500">{ticket.reference}</code>
          </p>
        )}

        {ticket.holderName && (
          <p className="mt-2 text-sm text-zinc-600">
            Porteur : <strong>{ticket.holderName}</strong>
          </p>
        )}

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => onPreview(ticket)}
            className="text-sm font-semibold text-carbon underline-offset-4 hover:underline"
          >
            Aperçu
          </button>
          {ticket.status === 'owned' && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-sm font-semibold text-carbon underline-offset-4 hover:underline"
            >
              {open ? 'Annuler' : 'Transférer à un proche →'}
            </button>
          )}
        </div>

        {ticket.status === 'owned' && (
          <AnimatePresence initial={false}>
            {open && <TransferForm ticket={ticket} onDone={() => setOpen(false)} />}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// Formulaire de don nominatif : nom + email du destinataire (US-5.2).
function TransferForm({ ticket, onDone }: { ticket: Ticket; onDone: () => void }) {
  const transfer = useTransferTicket();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ reassigned: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const res = await transfer.mutateAsync({ ticketId: ticket.id, name: name.trim(), email: email.trim() });
    setResult({ reassigned: res.reassigned });
  }

  const err = transfer.error instanceof ApiRequestError ? transfer.error : null;

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-700"
        role="status"
      >
        ✅ Billet transféré à <strong>{name}</strong>. Un email vient de lui être envoyé.{' '}
        {result.reassigned
          ? 'Ayant un compte TrustPass, le billet est déjà disponible dans « Mes billets » de son espace.'
          : 'Le billet est nominatif à son nom ; il pourra le récupérer en créant un compte avec cet email. Un nouveau QR et une nouvelle référence ont été générés.'}
        <div className="mt-2">
          <button type="button" onClick={onDone} className="font-medium text-emerald-800 hover:underline">
            Fermer
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 space-y-2 overflow-hidden rounded-xl border border-slate-200 bg-white/60 p-3"
    >
      <label className="block text-sm text-slate-600">
        Nom du destinataire
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input-dark mt-1"
          placeholder="ex. Camille Dupont"
        />
      </label>
      <label className="block text-sm text-slate-600">
        Email du destinataire
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-dark mt-1"
          placeholder="camille@exemple.fr"
        />
      </label>
      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err.code === 'TICKET_ALREADY_USED'
            ? 'Ce billet est déjà passé au contrôle d’accès : il ne peut plus être transféré.'
            : err.code === 'TICKET_NOT_TRANSFERABLE'
              ? 'Retire d’abord ce billet de la vente pour le transférer.'
              : 'Transfert impossible.'}
        </p>
      )}
      <motion.button
        type="submit"
        disabled={transfer.isPending}
        whileTap={{ scale: 0.97 }}
        className="btn-neon px-4 py-2 text-sm"
      >
        {transfer.isPending ? 'Transfert…' : 'Confirmer le transfert'}
      </motion.button>
    </motion.form>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="mx-5 my-10 rounded-2xl glass p-10 text-center text-slate-500">{children}</div>;
}
