import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEvent, useEventRules } from '../features/events/useEvents';
import { useListings } from '../features/listings/useListings';
import { ListingCard } from '../features/listings/ListingCard';
import { CheckoutModal } from '../features/checkout/CheckoutModal';
import { Poster } from '../components/Poster';
import { Countdown } from '../components/Countdown';
import { formatPrice } from '../lib/format';
import type { Listing } from '../types/api';

// Page détail d'un événement : affiche, infos, règles de revente, annonces.
export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const event = useEvent(id);
  const rules = useEventRules(id);
  const listings = useListings(id);
  const [selected, setSelected] = useState<Listing | null>(null);

  if (event.isLoading) return <p className="p-10 text-center text-slate-500">Chargement…</p>;
  if (event.isError || !event.data)
    return (
      <div className="p-10 text-center text-slate-500">
        Événement introuvable. <Link to="/" className="font-semibold text-carbon underline underline-offset-4">Retour</Link>
      </div>
    );

  const ev = event.data;

  return (
    <section className="px-5 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Marketplace
      </Link>

      {/* Hero affiche */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8 h-64 overflow-hidden rounded-3xl glass sm:h-80"
      >
        <Poster seed={ev.id} title={ev.name} imageUrl={ev.imageUrl} className="h-full w-full" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
          <h1 className="poster-title text-4xl text-white drop-shadow-lg sm:text-6xl">{ev.name}</h1>
          <p className="mt-2 text-gray-200 drop-shadow">
            {new Date(ev.startsAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
            {ev.venue ? ` · ${ev.venue}` : ''}
          </p>
        </div>
      </motion.div>

      {/* Bandeau infos : countdown + règles */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl glass p-5">
          <Countdown target={ev.startsAt} label="Début dans" />
        </div>
        <div className="rounded-2xl glass p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Plafond de revente</p>
          <p className="mt-1 text-2xl font-extrabold text-carbon">
            {rules.data?.priceCap != null ? formatPrice(rules.data.priceCap) : '—'}
          </p>
        </div>
        <div className="rounded-2xl glass p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">Clôture revente</p>
          <p className="mt-1 text-sm text-slate-600">
            {rules.data?.resaleClosesAt
              ? new Date(rules.data.resaleClosesAt).toLocaleString('fr-FR')
              : '1h avant l’événement'}
          </p>
        </div>
      </div>

      {/* Catégories */}
      {ev.ticketTypes.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {ev.ticketTypes.map((tt) => (
            <span key={tt.id} className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm">
              {tt.name} · <span className="text-slate-500">{formatPrice(tt.faceValue)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Annonces pour cet événement */}
      <h2 className="mb-4 text-xl font-bold">Billets en revente</h2>
      {listings.isLoading && <p className="text-slate-500">Chargement…</p>}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.data?.data.map((l) => (
          <ListingCard key={l.id} listing={l} onBuy={setSelected} />
        ))}
      </div>
      {listings.data && listings.data.data.length === 0 && (
        <div className="rounded-2xl glass p-8 text-center text-slate-500">
          Aucune revente en cours pour cet événement.
        </div>
      )}

      <CheckoutModal listing={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
