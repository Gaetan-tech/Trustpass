import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth';
import { useEvents, useEvent } from '../features/events/useEvents';
import { eventPhotoDataUrl } from '../lib/concertPhoto';
import {
  buildTicketSvg,
  svgToPngDataUrl,
  downloadDataUrl,
  type TicketMockupData,
} from '../lib/ticketMockup';

// Générateur de maquette de billet : aperçu en direct + téléchargement PNG.
export function MockupPage() {
  const user = useAuth((s) => s.user);
  const events = useEvents();
  const [eventId, setEventId] = useState('');
  const [holderName, setHolderName] = useState('');
  const [category, setCategory] = useState('');
  const [reference, setReference] = useState('');
  const [downloading, setDownloading] = useState(false);

  const eventDetail = useEvent(eventId || undefined);
  const selected = events.data?.data.find((e) => e.id === eventId);

  // Photo de l'événement en fond, embarquée en data URI (auto-contenue pour le PNG).
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const photoSeed = eventId || 'trustpass-mockup';
  useEffect(() => {
    let cancelled = false;
    setPhotoDataUrl(undefined);
    eventPhotoDataUrl({ id: photoSeed, imageUrl: selected?.imageUrl }, 900)
      .then((d) => {
        if (!cancelled) setPhotoDataUrl(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [photoSeed, selected?.imageUrl]);

  const data: TicketMockupData = useMemo(
    () => ({
      eventName: selected?.name ?? 'Nom de l’événement',
      venue: selected?.venue,
      dateLabel: selected
        ? new Date(selected.startsAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
        : undefined,
      holderName: holderName.trim() || undefined,
      category: category.trim() || undefined,
      reference: reference.trim() || 'TP.XXXX-XXXX',
      seed: eventId || selected?.name,
      photoDataUrl,
    }),
    [selected, holderName, category, reference, eventId, photoDataUrl],
  );

  const svg = useMemo(() => buildTicketSvg(data), [data]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const png = await svgToPngDataUrl(svg, 2);
      const slug = (data.eventName || 'billet').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      downloadDataUrl(png, `maquette-billet-${slug}.png`);
    } finally {
      setDownloading(false);
    }
  }

  // Réservé aux organisateurs (garde placée après tous les hooks).
  if (user?.role !== 'organizer') {
    return (
      <section className="mx-auto max-w-5xl px-5 py-16 text-center text-slate-500">
        <h1 className="poster-title mb-2 text-3xl">Maquette de billet</h1>
        <p>Cette fonctionnalité est réservée aux comptes organisateur.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="poster-title mb-1 text-4xl sm:text-5xl">Maquette de billet</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Compose un aperçu de billet à partir d’un événement du marketplace, puis télécharge-le en PNG.
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Formulaire */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 rounded-2xl glass p-5"
        >
          <label className="block text-sm text-slate-600">
            Événement
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setCategory('');
              }}
              className="input-dark mt-1"
              aria-label="Événement"
            >
              <option value="">{events.isLoading ? 'Chargement…' : '— Choisir un événement —'}</option>
              {events.data?.data.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.venue ? ` · ${ev.venue}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-600">
            Catégorie
            {eventDetail.data && eventDetail.data.ticketTypes.length > 0 ? (
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-dark mt-1" aria-label="Catégorie">
                <option value="">— Aucune —</option>
                {eventDetail.data.ticketTypes.map((tt) => (
                  <option key={tt.id} value={tt.name}>
                    {tt.name}
                  </option>
                ))}
              </select>
            ) : (
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="input-dark mt-1" placeholder="ex. VIP, Fosse…" />
            )}
          </label>

          <label className="block text-sm text-slate-600">
            Nom du porteur
            <input value={holderName} onChange={(e) => setHolderName(e.target.value)} className="input-dark mt-1" placeholder="ex. Camille Dupont" />
          </label>

          <label className="block text-sm text-slate-600">
            Référence / code QR
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="input-dark mt-1 font-mono" placeholder="ex. TP.XXXX…" />
          </label>

          <motion.button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            whileTap={{ scale: 0.97 }}
            className="btn-neon w-full"
          >
            {downloading ? 'Génération…' : '⬇ Télécharger en PNG'}
          </motion.button>
          <p className="text-xs text-slate-400">
            Le QR affiché est une maquette (non scannable). Le vrai QR est généré à l’émission du billet.
          </p>
        </motion.div>

        {/* Aperçu en direct */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Aperçu</p>
          <div
            className="ticket-svg overflow-hidden rounded-2xl shadow-card"
            aria-label="Aperçu du billet"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </motion.div>
      </div>
    </section>
  );
}
