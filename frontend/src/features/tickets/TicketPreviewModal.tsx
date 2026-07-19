import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Ticket } from '../../types/api';
import { eventPhotoDataUrl } from '../../lib/concertPhoto';
import {
  buildTicketSvg,
  svgToPngDataUrl,
  downloadDataUrl,
  type TicketMockupData,
} from '../../lib/ticketMockup';

// Aperçu visuel d'un billet possédé (depuis « Mes billets ») + export PNG.
export function TicketPreviewModal({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);

  // Photo de l'événement en fond, embarquée en data URI (auto-contenue pour le PNG).
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const eventId = ticket?.event.id;
  const eventImageUrl = ticket?.event.imageUrl;
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setPhotoDataUrl(undefined);
    eventPhotoDataUrl({ id: eventId, imageUrl: eventImageUrl }, 900)
      .then((d) => {
        if (!cancelled) setPhotoDataUrl(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventId, eventImageUrl]);

  const data: TicketMockupData | null = useMemo(() => {
    if (!ticket) return null;
    return {
      eventName: ticket.event.name,
      venue: ticket.event.venue,
      dateLabel: new Date(ticket.event.startsAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }),
      holderName: ticket.holderName,
      category: ticket.ticketType?.name,
      reference: ticket.reference ?? '—',
      seed: ticket.event.id,
      photoDataUrl,
    };
  }, [ticket, photoDataUrl]);

  const svg = useMemo(() => (data ? buildTicketSvg(data) : ''), [data]);

  async function handleDownload() {
    if (!svg) return;
    setDownloading(true);
    try {
      const png = await svgToPngDataUrl(svg, 2);
      const slug = (ticket?.event.name ?? 'billet').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      downloadDataUrl(png, `billet-${slug}.png`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AnimatePresence>
      {ticket && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu du billet"
        >
          <motion.div
            className="w-full max-w-2xl rounded-3xl glass p-5 shadow-glow"
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ticket-svg overflow-hidden rounded-2xl" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="mt-4 flex items-center justify-between gap-3">
              {ticket.reference && (
                <span className="text-sm text-zinc-500">
                  Réf. <code className="font-mono text-carbon">{ticket.reference}</code>
                </span>
              )}
              <div className="ml-auto flex gap-3">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-zinc-500 hover:text-carbon">
                  Fermer
                </button>
                <motion.button type="button" onClick={handleDownload} disabled={downloading} whileTap={{ scale: 0.97 }} className="btn-neon">
                  {downloading ? 'Génération…' : '⬇ Télécharger en PNG'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
