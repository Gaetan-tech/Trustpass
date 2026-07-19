import type { HistoryEntry } from '../types/api';

const TYPE_LABEL: Record<string, string> = {
  attach: 'Émission',
  purchase: 'Revente',
  gift: 'Don',
};

const TYPE_ICON: Record<string, string> = {
  attach: '🎫',
  purchase: '💳',
  gift: '🎁',
};

// Frise chronologique des possesseurs successifs d'un billet.
export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return <p className="text-sm text-slate-500">Aucun historique.</p>;
  return (
    <ol className="space-y-2">
      {entries.map((e, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 text-sm"
        >
          <span className="text-lg leading-none" aria-hidden>
            {TYPE_ICON[e.type] ?? '•'}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-slate-700">
              {TYPE_LABEL[e.type] ?? e.type} → <span className="font-semibold text-carbon">{e.to ?? '—'}</span>
            </p>
            {e.from && <p className="truncate text-xs text-slate-500">de {e.from}</p>}
            <p className="text-xs text-slate-400">{new Date(e.at).toLocaleString('fr-FR')}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
