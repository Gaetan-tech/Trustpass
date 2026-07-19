import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Listing } from '../../types/api';
import { formatPrice } from '../../lib/format';
import { Equalizer } from '../../components/AnimatedBackground';
import { riseItem } from '../../lib/motion';
import { eventPhoto } from '../../lib/concertPhoto';

interface Props {
  listing: Listing;
  onBuy: (listing: Listing) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Carte-billet façon stub de concert : image de fond, perforations, glow au survol.
export function ListingCard({ listing, onBuy }: Props) {
  // Fond : vraie photo de concert (imageUrl de l'événement, sinon photo déterministe).
  const bg = eventPhoto(listing.event, 640);
  return (
    <motion.article
      variants={riseItem}
      whileHover={{ y: -6, boxShadow: '0 22px 44px -18px rgba(10,10,10,0.45)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="group relative overflow-hidden rounded-2xl glass"
    >
      {/* Bandeau supérieur : vraie photo + voile encre */}
      <div className="relative h-32 overflow-hidden bg-carbon">
        <img
          src={bg}
          alt={`Photo de concert — ${listing.event.name}`}
          className="photo-mono absolute inset-0 h-full w-full object-cover group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 via-transparent to-transparent" />
        <Equalizer bars={7} className="absolute bottom-3 left-4 h-8 opacity-90 [&_span]:!bg-white" />
        <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-carbon backdrop-blur">
          Vérifié
        </span>
      </div>

      {/* Ligne de perforation (séparation stub) */}
      <div className="relative">
        <div className="absolute -left-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-white" />
        <div className="absolute -right-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-white" />
        <div className="mx-4 border-t border-dashed border-zinc-300" />
      </div>

      <div className="p-4">
        <Link
          to={`/events/${listing.event.id}`}
          className="text-lg font-bold leading-tight text-carbon underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          {listing.event.name}
        </Link>
        <p className="mt-1 text-sm text-zinc-500">
          {formatDate(listing.event.startsAt)}
          {listing.event.venue ? ` · ${listing.event.venue}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="badge-available">
            <span className="h-1.5 w-1.5 rounded-full bg-available" /> Disponible
          </span>
          {listing.ticketType && (
            <span className="inline-block rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
              {listing.ticketType.name}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Prix</p>
            <span className="text-2xl font-extrabold text-carbon">{formatPrice(listing.price)}</span>
          </div>
          <motion.button
            type="button"
            onClick={() => onBuy(listing)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-neon"
            aria-label={`Acheter le billet pour ${listing.event.name}`}
          >
            Acheter
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
