import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useValidateTicket } from '../features/tickets/useValidateTicket';
import { useAuth } from '../store/auth';
import { HistoryTimeline } from '../components/HistoryTimeline';

const REASON_LABEL: Record<string, string> = {
  ALREADY_USED: 'Billet déjà utilisé',
  INVALIDATED: 'Billet invalidé (revendu)',
  UNKNOWN: 'Billet inconnu',
};

// Écran de contrôle à l'entrée (US-7.1). Réservé au rôle "controller".
export function ScanPage() {
  const user = useAuth((s) => s.user);
  const validate = useValidateTicket();
  const [qr, setQr] = useState('');

  if (!user) return <p className="p-10 text-center text-slate-500">Connecte-toi.</p>;
  if (user.role !== 'controller')
    return <p className="p-10 text-center text-slate-500">Réservé aux contrôleurs.</p>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qr.trim()) return;
    await validate.mutateAsync(qr.trim());
    setQr('');
  }

  const result = validate.data;

  return (
    <section className="mx-auto max-w-xl px-5 py-12">
      <h1 className="mb-6 text-2xl font-bold">Contrôle d'accès</h1>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl glass p-5">
        <label className="block text-sm text-slate-600">
          Code QR scanné
          <input
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            className="input-dark mt-1 font-mono"
            placeholder="TP.…"
            autoFocus
          />
        </label>
        <motion.button
          type="submit"
          disabled={validate.isPending}
          whileTap={{ scale: 0.97 }}
          className="btn-neon w-full"
        >
          {validate.isPending ? 'Vérification…' : 'Valider'}
        </motion.button>
      </form>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.valid ? 'ok' : `ko-${'reason' in result ? result.reason : ''}`}
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`mt-6 rounded-2xl border p-8 text-center text-xl font-bold ${
              result.valid
                ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-glow-cyan'
                : 'border-red-400/50 bg-red-50 text-red-700'
            }`}
            role="status"
          >
            {result.valid ? (
              <>
                <div className="text-4xl">✅</div>
                <div className="mt-2">Accès autorisé</div>
                <div className="mt-1 text-sm font-normal text-slate-500">{result.event.name}</div>
              </>
            ) : (
              <>
                <div className="text-4xl">⛔</div>
                <div className="mt-2">{REASON_LABEL[result.reason] ?? 'Refusé'}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Propriétaire + historique des possesseurs (dès que le billet est reconnu). */}
      {result && result.history && result.history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl glass p-5"
        >
          {result.owner && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Propriétaire du billet</p>
              <p className="mt-1 text-lg font-semibold">{result.owner.name ?? result.owner.email}</p>
              {result.owner.name && <p className="text-sm text-slate-500">{result.owner.email}</p>}
            </div>
          )}
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Historique des possesseurs</p>
          <HistoryTimeline entries={result.history} />
        </motion.div>
      )}
    </section>
  );
}
