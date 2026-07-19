import { useState } from 'react';
import { motion } from 'framer-motion';
import { useListings } from '../features/listings/useListings';
import { ListingCard } from '../features/listings/ListingCard';
import { CheckoutModal } from '../features/checkout/CheckoutModal';
import { FeaturedCarousel } from '../features/events/FeaturedCarousel';
import { Equalizer } from '../components/AnimatedBackground';
import { staggerContainer, fadeUp, viewportOnce, backOut } from '../lib/motion';
import type { Listing } from '../types/api';

// Marketplace : hero concert + grille d'annonces animée + tunnel d'achat.
export function MarketplacePage() {
  const { data, isLoading, isError, error } = useListings();
  const [selected, setSelected] = useState<Listing | null>(null);

  return (
    <section className="px-5 py-10">
      {/* Carrousel à la une */}
      <FeaturedCarousel />

      {/* Hero */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mb-12 overflow-hidden rounded-3xl glass p-8 sm:p-12"
      >
        <div className="absolute inset-0 -z-10 bg-glow-radial" />
        {/* Halo violet festif en fond du hero. */}
        <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-accent opacity-20 blur-3xl animate-float" />
        <motion.div variants={fadeUp(0)} className="flex items-center gap-3">
          <span className="badge animate-pulse-glow text-accent ring-accent/30">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> En direct
          </span>
          <Equalizer bars={6} className="h-6" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Revente sécurisée · billets vérifiés
          </span>
        </motion.div>
        <motion.h1
          variants={fadeUp(0.05)}
          className="poster-title mt-5 max-w-3xl text-5xl sm:text-7xl lg:text-8xl"
        >
          Vis le concert,<br />
          <span className="mark">pas l'arnaque</span>.
        </motion.h1>
        <motion.p variants={fadeUp(0.12)} className="mt-5 max-w-xl text-zinc-500">
          Des billets revendus à prix plafonné, transférés en toute sécurité. Zéro faux billet,
          zéro doublon.
        </motion.p>
      </motion.div>

      {/* Bande inversée : 3 garanties (pattern éditorial noir sur blanc). */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: backOut }}
        className="section-invert mb-12 grid gap-px overflow-hidden rounded-3xl sm:grid-cols-3"
      >
        {[
          { k: '01', t: 'Prix plafonné', d: "Jamais au-dessus du plafond fixé par l'organisateur." },
          { k: '02', t: 'Transfert sécurisé', d: 'QR régénéré à chaque vente : l’ancien billet est invalidé.' },
          { k: '03', t: 'Zéro faux billet', d: 'Chaque billet est vérifié et nominatif, sans doublon possible.' },
        ].map((b) => (
          <div key={b.k} className="group bg-carbon p-7 transition-colors hover:bg-zinc-900 sm:p-8">
            <span className="font-display text-sm tracking-widest text-accent">{b.k}</span>
            <h3 className="mt-3 font-display text-xl uppercase tracking-tight text-white">{b.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{b.d}</p>
          </div>
        ))}
      </motion.section>

      <div className="mb-6 flex items-end justify-between border-b border-zinc-200 pb-3">
        <h2 className="poster-title text-3xl sm:text-4xl">Billets en revente</h2>
        {data && <span className="text-sm text-zinc-500">{data.total} annonce(s)</span>}
      </div>

      {isLoading && <SkeletonGrid />}
      {isError && (
        <p className="rounded-xl border border-red-400/40 bg-red-50 p-4 text-red-700" role="alert">
          Impossible de charger les annonces ({(error as Error).message}).
        </p>
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {data?.data.map((listing) => (
          <ListingCard key={listing.id} listing={listing} onBuy={setSelected} />
        ))}
      </motion.div>

      {data && data.data.length === 0 && !isLoading && (
        <div className="rounded-2xl glass p-10 text-center text-slate-500">
          🎟️ Aucune annonce pour le moment — reviens vite, ça bouge en coulisses.
        </div>
      )}

      <CheckoutModal listing={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={i}
          className="h-64 rounded-2xl glass"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
