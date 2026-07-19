import { motion } from 'framer-motion';

// Voile monochrome très discret : quelques halos gris qui flottent sur fond blanc.
export function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-zinc-900/[0.04] blur-[130px]"
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-40 top-10 h-[28rem] w-[28rem] rounded-full bg-zinc-900/[0.035] blur-[130px]"
        animate={{ x: [0, -50, 0], y: [0, 60, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// Petit égaliseur audio animé (barres qui pulsent).
export function Equalizer({ bars = 5, className = '' }: { bars?: number; className?: string }) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
          transition={{
            duration: 1.1 + (i % 3) * 0.25,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.12,
          }}
          style={{ height: '30%' }}
        />
      ))}
    </div>
  );
}
