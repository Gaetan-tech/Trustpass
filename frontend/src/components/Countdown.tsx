import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms / 3600000) % 24),
    m: Math.floor((ms / 60000) % 60),
    s: Math.floor((ms / 1000) % 60),
    done: ms === 0,
  };
}

// Compte à rebours live (façon "drop") vers une date cible.
export function Countdown({ target, label }: { target: string; label?: string }) {
  const targetMs = new Date(target).getTime();
  const [t, setT] = useState(() => diff(targetMs));

  useEffect(() => {
    const id = setInterval(() => setT(diff(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (t.done) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
        🔴 En cours
      </span>
    );
  }

  const cells: [string, number][] = [
    ['J', t.d],
    ['H', t.h],
    ['M', t.m],
    ['S', t.s],
  ];

  return (
    <div>
      {label && <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>}
      <div className="flex gap-2">
        {cells.map(([unit, val]) => (
          <div key={unit} className="min-w-[3.25rem] rounded-xl glass px-2 py-2 text-center">
            <motion.div
              key={`${unit}-${val}`}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-2xl font-extrabold tabular-nums text-neon"
            >
              {String(val).padStart(2, '0')}
            </motion.div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
