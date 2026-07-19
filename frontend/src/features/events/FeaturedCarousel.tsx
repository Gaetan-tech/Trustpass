import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEvents } from './useEvents';
import { Poster } from '../../components/Poster';
import { Countdown } from '../../components/Countdown';

// Carrousel "à la une" : affiches d'événements qui défilent automatiquement.
export function FeaturedCarousel() {
  const { data } = useEvents();
  const navigate = useNavigate();
  const events = data?.data.slice(0, 5) ?? [];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (events.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % events.length), 5000);
    return () => clearInterval(id);
  }, [events.length]);

  if (events.length === 0) return null;
  const ev = events[i]!;

  return (
    <div className="relative mb-12 h-72 overflow-hidden rounded-3xl glass sm:h-80">
      <AnimatePresence mode="wait">
        <motion.button
          key={ev.id}
          type="button"
          onClick={() => navigate(`/events/${ev.id}`)}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 block text-left"
        >
          <Poster seed={ev.id} title={ev.name} imageUrl={ev.imageUrl} className="h-full w-full" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
            <span className="mb-2 w-fit rounded-full bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur">
              À la une
            </span>
            <h2 className="poster-title max-w-lg text-4xl text-white drop-shadow-lg sm:text-5xl">
              {ev.name}
            </h2>
            {ev.venue && <p className="mt-1 text-gray-200 drop-shadow">{ev.venue}</p>}
            <div className="mt-4">
              <Countdown target={ev.startsAt} label="Début dans" />
            </div>
          </div>
        </motion.button>
      </AnimatePresence>

      {/* Puces de navigation */}
      <div className="absolute bottom-4 right-6 z-10 flex gap-1.5">
        {events.map((e, idx) => (
          <button
            key={e.id}
            type="button"
            aria-label={`Voir ${e.name}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
