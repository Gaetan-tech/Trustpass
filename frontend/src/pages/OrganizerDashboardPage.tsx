import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useMyEvents,
  useEventStats,
  useEventRulesFor,
  useSetPriceCap,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useEventTickets,
  useTicketHistory,
  useControllers,
  useCreateController,
  useRevokeController,
} from '../features/organizer/useOrganizer';
import { useAuth } from '../store/auth';
import { formatPrice } from '../lib/format';
import { ApiRequestError } from '../lib/api';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { fileToCompressedDataUrl } from '../lib/image';
import type { EventSummary } from '../types/api';

// Convertit une date ISO (UTC) en valeur pour <input type="datetime-local"> (heure locale).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Dashboard organisateur : gestion des événements (créer / supprimer / plafond),
// statistiques de revente (US-8.1) et historique de possession des billets (US-8.2).
export function OrganizerDashboardPage() {
  const user = useAuth((s) => s.user);
  const isOrganizer = user?.role === 'organizer';
  const events = useMyEvents(Boolean(isOrganizer));
  const [selected, setSelected] = useState<string | null>(null);
  const stats = useEventStats(selected);

  useEffect(() => {
    // On attend une liste à jour (sinon un refetch après création réinitialiserait
    // la sélection à tort, la liste périmée n'incluant pas encore le nouvel événement).
    if (events.isFetching) return;
    const list = events.data?.data ?? [];
    if (list.length === 0) {
      if (selected) setSelected(null);
      return;
    }
    // Sélection initiale, ou repli sur le premier si l'événement courant a disparu (suppression).
    if (!selected || !list.some((e) => e.id === selected)) {
      setSelected(list[0]!.id);
    }
  }, [events.data, events.isFetching, selected]);

  if (!user) return <p className="p-10 text-center text-slate-500">Connecte-toi.</p>;
  if (!isOrganizer)
    return <p className="p-10 text-center text-slate-500">Réservé aux organisateurs.</p>;

  const selectedEvent = events.data?.data.find((e) => e.id === selected) ?? null;

  return (
    <section className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Dashboard organisateur</h1>

      <CreateEventCard onCreated={(id) => setSelected(id)} />

      {events.isLoading && <p className="mt-6 text-slate-500">Chargement…</p>}
      {events.data?.data.length === 0 && (
        <p className="mt-6 text-slate-500">Aucun événement — crée ton premier événement ci-dessus.</p>
      )}

      {events.data && events.data.data.length > 0 && (
        <label className="mb-6 mt-6 block text-sm text-slate-600">
          Événement
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            className="input-dark mt-1"
          >
            {events.data.data.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {selected && selectedEvent && (
        <div className="space-y-6">
          <EditEventCard event={selectedEvent} />
          <PriceCapCard eventId={selected} />
          <DangerZone eventId={selected} eventName={selectedEvent.name} onDeleted={() => setSelected(null)} />

          {stats.data && (
            <div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Reventes" value={String(stats.data.resaleCount)} i={0} />
                <StatCard label="Prix moyen" value={formatPrice(stats.data.avgPrice)} i={1} />
                <StatCard label="Taux de revente" value={`${Math.round(stats.data.resaleRate * 100)}%`} i={2} />
                <StatCard label="Annonces vendues" value={`${stats.data.soldListings}/${stats.data.totalListings}`} i={3} />
              </div>
            </div>
          )}

          <EventTicketsCard eventId={selected} />
        </div>
      )}

      <div className="mt-6">
        <ControllersCard />
      </div>
    </section>
  );
}

// Comptes contrôleur gérés par l'organisateur : création (email + mot de passe),
// liste et révocation. Chaque contrôleur ne peut valider que les événements de
// cet organisateur.
function ControllersCard() {
  const list = useControllers(true);
  const create = useCreateController();
  const revoke = useRevokeController();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 8) return;
    await create.mutateAsync({ email: email.trim(), password });
    setEmail('');
    setPassword('');
  }

  const taken = create.error instanceof ApiRequestError && create.error.code === 'EMAIL_TAKEN';

  return (
    <div className="rounded-3xl glass p-6">
      <h2 className="mb-1 font-semibold">Mes contrôleurs</h2>
      <p className="mb-4 text-xs text-slate-500">
        Crée des comptes contrôleur pour valider les billets à l'entrée. Ils ne peuvent scanner que
        tes événements.
      </p>

      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="email"
          aria-label="Email du contrôleur"
          placeholder="controleur@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-dark"
        />
        <input
          type="password"
          aria-label="Mot de passe du contrôleur"
          placeholder="Mot de passe (8 car. min.)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="input-dark"
        />
        <button type="submit" disabled={create.isPending} className="btn-neon whitespace-nowrap">
          {create.isPending ? 'Création…' : 'Créer'}
        </button>
      </form>
      {create.isError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {taken ? 'Cet email est déjà utilisé.' : 'Création impossible.'}
        </p>
      )}

      <ul className="mt-4 divide-y divide-slate-200/40">
        {list.data?.data.length === 0 && (
          <li className="py-3 text-sm text-slate-500">Aucun contrôleur pour l'instant.</li>
        )}
        {list.data?.data.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <span className="text-sm">{c.email}</span>
            <button
              type="button"
              onClick={() => revoke.mutate(c.id)}
              disabled={revoke.isPending}
              className="text-xs text-red-600 hover:underline"
            >
              Révoquer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// US-6.3 — création d'un événement.
function CreateEventCard({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateEvent();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [catName, setCatName] = useState('');
  const [catPrice, setCatPrice] = useState('');
  const [image, setImage] = useState('');
  const [imgErr, setImgErr] = useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgErr('');
    try {
      setImage(await fileToCompressedDataUrl(f));
    } catch {
      setImgErr('Image invalide.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startsAt) return;
    const ticketTypes =
      catName.trim() && Number(catPrice) > 0
        ? [{ name: catName.trim(), faceValue: Math.round(Number(catPrice) * 100) }]
        : undefined;
    const res = await create.mutateAsync({
      name: name.trim(),
      venue: venue.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      imageUrl: image || undefined,
      ticketTypes,
    });
    setName('');
    setVenue('');
    setStartsAt('');
    setCatName('');
    setCatPrice('');
    setImage('');
    setOpen(false);
    onCreated(res.id);
  }

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Mes événements</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-neon px-4 py-2 text-sm"
        >
          {open ? 'Annuler' : '+ Nouvel événement'}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 overflow-hidden"
          >
            <label className="block text-sm text-slate-600">
              Nom
              <input value={name} onChange={(e) => setName(e.target.value)} required className="input-dark mt-1" placeholder="ex. Nuit Électro 2026" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Lieu
                <input value={venue} onChange={(e) => setVenue(e.target.value)} className="input-dark mt-1" placeholder="ex. Zénith, Paris" />
              </label>
              <label className="block text-sm text-slate-600">
                Date & heure
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="input-dark mt-1" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Catégorie (option.)
                <input value={catName} onChange={(e) => setCatName(e.target.value)} className="input-dark mt-1" placeholder="ex. VIP" />
              </label>
              <label className="block text-sm text-slate-600">
                Prix nominal (€)
                <input type="number" min={1} step="0.01" value={catPrice} onChange={(e) => setCatPrice(e.target.value)} className="input-dark mt-1" placeholder="ex. 80,00" />
              </label>
            </div>
            <div>
              <span className="block text-sm text-slate-600">Affiche / image (option.)</span>
              <div className="mt-1 flex items-center gap-3">
                <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400">
                  {image ? 'Changer l’image' : 'Choisir une image'}
                  <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                </label>
                {image && (
                  <>
                    <img src={image} alt="Aperçu de l'affiche" className="h-12 w-20 rounded-lg object-cover" />
                    <button type="button" onClick={() => setImage('')} className="text-sm text-slate-500 hover:text-red-600">
                      Retirer
                    </button>
                  </>
                )}
              </div>
              {imgErr && <p className="mt-1 text-sm text-red-600">{imgErr}</p>}
            </div>
            {create.isError && (
              <p className="text-sm text-red-600" role="alert">Création impossible.</p>
            )}
            <motion.button type="submit" disabled={create.isPending} whileTap={{ scale: 0.97 }} className="btn-neon">
              {create.isPending ? 'Création…' : "Créer l'événement"}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

// US-6.3 — édition d'un événement (nom, lieu, date).
function EditEventCard({ event }: { event: EventSummary }) {
  const update = useUpdateEvent(event.id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(event.name);
  const [venue, setVenue] = useState(event.venue ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(event.startsAt));
  const [image, setImage] = useState(event.imageUrl ?? '');
  const [savedAt, setSavedAt] = useState(0);

  // Réinitialise le formulaire quand on change d'événement.
  useEffect(() => {
    setName(event.name);
    setVenue(event.venue ?? '');
    setStartsAt(toLocalInput(event.startsAt));
    setImage(event.imageUrl ?? '');
    setOpen(false);
    setSavedAt(0);
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setImage(await fileToCompressedDataUrl(f));
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startsAt) return;
    await update.mutateAsync({
      name: name.trim(),
      venue: venue.trim(),
      startsAt: new Date(startsAt).toISOString(),
      imageUrl: image,
    });
    setSavedAt(Date.now());
    setOpen(false);
  }

  const err = update.error instanceof ApiRequestError ? update.error : null;

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Détails de l'événement</h2>
          <p className="text-sm text-slate-500">
            {event.name}
            {event.venue ? ` · ${event.venue}` : ''} · {new Date(event.startsAt).toLocaleString('fr-FR')}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">
          {open ? 'Annuler' : 'Modifier'}
        </button>
      </div>
      {savedAt > 0 && !open && !err && (
        <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          ✅ Événement mis à jour.
        </p>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 overflow-hidden"
          >
            <label className="block text-sm text-slate-600">
              Nom
              <input value={name} onChange={(e) => setName(e.target.value)} required className="input-dark mt-1" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Lieu
                <input value={venue} onChange={(e) => setVenue(e.target.value)} className="input-dark mt-1" placeholder="ex. Zénith, Paris" />
              </label>
              <label className="block text-sm text-slate-600">
                Date & heure
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="input-dark mt-1" />
              </label>
            </div>
            <div>
              <span className="block text-sm text-slate-600">Affiche / image</span>
              <div className="mt-1 flex items-center gap-3">
                <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400">
                  {image ? 'Changer l’image' : 'Choisir une image'}
                  <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                </label>
                {image && (
                  <>
                    <img src={image} alt="Aperçu de l'affiche" className="h-12 w-20 rounded-lg object-cover" />
                    <button type="button" onClick={() => setImage('')} className="text-sm text-slate-500 hover:text-red-600">
                      Retirer
                    </button>
                  </>
                )}
              </div>
            </div>
            {err && <p className="text-sm text-red-600" role="alert">Mise à jour impossible.</p>}
            <motion.button type="submit" disabled={update.isPending} whileTap={{ scale: 0.97 }} className="btn-neon px-4 py-2 text-sm">
              {update.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

// Fixe le plafond de revente de l'événement sélectionné (US-6.1).
function PriceCapCard({ eventId }: { eventId: string }) {
  const rules = useEventRulesFor(eventId);
  const setCap = useSetPriceCap(eventId);
  const [euros, setEuros] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    setCap.reset();
    setSavedAt(0);
    if (rules.data?.priceCap != null) setEuros((rules.data.priceCap / 100).toFixed(2));
    else setEuros('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, rules.data?.priceCap]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(euros);
    if (!value || value <= 0) return;
    await setCap.mutateAsync(Math.round(value * 100));
    setSavedAt(Date.now());
  }

  const err = setCap.error instanceof ApiRequestError ? setCap.error : null;

  return (
    <motion.form onSubmit={handleSave} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass p-5">
      <h2 className="font-semibold">Plafond de revente</h2>
      <p className="mt-1 text-sm text-slate-500">
        Prix maximum autorisé pour la revente d'un billet de cet événement.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Plafond (€)
          <div className="mt-1 flex items-center gap-2">
            <input type="number" min={1} step="0.01" value={euros} onChange={(e) => setEuros(e.target.value)} className="input-dark w-32 text-right" placeholder="ex. 95,00" aria-label="Plafond de revente en euros" />
            <motion.button type="submit" disabled={setCap.isPending} whileTap={{ scale: 0.96 }} className="btn-neon px-4 py-2 text-sm">
              {setCap.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </motion.button>
          </div>
        </label>
        {rules.data?.priceCap != null && (
          <span className="pb-2 text-sm text-slate-500">
            Actuel : <strong className="text-slate-700">{formatPrice(rules.data.priceCap)}</strong>
          </span>
        )}
      </div>
      {savedAt > 0 && !setCap.isPending && !err && (
        <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          ✅ Plafond mis à jour.
        </p>
      )}
      {err && (
        <p className="mt-3 rounded-lg border border-red-400/40 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {err.code === 'INVALID_WINDOW' ? 'Fenêtre de revente invalide.' : "Enregistrement impossible (es-tu bien le propriétaire de cet événement ?)."}
        </p>
      )}
    </motion.form>
  );
}

// US-6.3 — suppression d'un événement (confirmation en deux temps, sans dialog natif).
function DangerZone({ eventId, eventName, onDeleted }: { eventId: string; eventName: string; onDeleted: () => void }) {
  const del = useDeleteEvent();
  const [confirming, setConfirming] = useState(false);

  // Réinitialise la confirmation quand on change d'événement.
  useEffect(() => {
    setConfirming(false);
    del.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleDelete() {
    try {
      await del.mutateAsync(eventId);
      onDeleted();
    } catch {
      /* erreur affichée ci-dessous */
    }
  }

  const err = del.error instanceof ApiRequestError ? del.error : null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-red-800">Supprimer l'événement</h2>
          <p className="text-sm text-red-700/80">« {eventName} » — action définitive (sans billet rattaché).</p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">
              Annuler
            </button>
            <button type="button" onClick={handleDelete} disabled={del.isPending} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {del.isPending ? 'Suppression…' : 'Confirmer la suppression'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100">
            Supprimer
          </button>
        )}
      </div>
      {err && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {err.code === 'EVENT_HAS_TICKETS'
            ? 'Impossible : des billets sont déjà rattachés à cet événement.'
            : 'Suppression impossible.'}
        </p>
      )}
    </div>
  );
}

// US-8.2 — billets de l'événement + historique de possession de chacun.
function EventTicketsCard({ eventId }: { eventId: string }) {
  const tickets = useEventTickets(eventId);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  return (
    <div className="rounded-2xl glass p-5">
      <h2 className="mb-1 font-semibold">Billets & historique</h2>
      <p className="mb-3 text-sm text-slate-500">Consulte tous les possesseurs et le statut de chaque billet.</p>

      {tickets.isLoading && <p className="text-slate-500">Chargement…</p>}
      {tickets.data?.data.length === 0 && <p className="text-sm text-slate-500">Aucun billet pour cet événement.</p>}

      <ul className="space-y-2">
        {tickets.data?.data.map((t) => (
          <li key={t.id} className="rounded-xl border border-slate-200 bg-white/70 p-3">
            <button
              type="button"
              onClick={() => setOpenTicket((v) => (v === t.id ? null : t.id))}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0">
                <code className="text-neon-cyanInk">{t.reference ?? t.id.slice(0, 8)}</code>
                {t.ticketType && <span className="ml-2 text-sm text-slate-500">{t.ticketType}</span>}
                <span className="ml-2 block truncate text-sm text-slate-600 sm:ml-2 sm:inline">
                  {t.holderName ? `${t.holderName} · ` : ''}
                  {t.ownerEmail}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <StatusChip status={t.status} />
                <span className="text-xs text-slate-400">{t.transfersCount} transfert(s)</span>
                <span className="text-slate-400">{openTicket === t.id ? '▲' : '▼'}</span>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {openTicket === t.id && <TicketHistoryPanel ticketId={t.id} />}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TicketHistoryPanel({ ticketId }: { ticketId: string }) {
  const history = useTicketHistory(ticketId);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden pt-3"
    >
      {history.isLoading && <p className="text-sm text-slate-500">Chargement de l'historique…</p>}
      {history.data && <HistoryTimeline entries={history.data.history} />}
    </motion.div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  owned: 'border-carbon bg-carbon text-white',
  listed: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  reserved: 'border-zinc-300 bg-zinc-50 text-zinc-600',
  sold: 'border-zinc-200 bg-zinc-50 text-zinc-500',
  used: 'border-zinc-200 bg-zinc-50 text-zinc-400',
  invalidated: 'border-red-300 bg-red-50 text-red-700',
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_CHIP[status] ?? 'border-slate-300 bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, i }: { label: string; value: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08 }}
      whileHover={{ y: -4, boxShadow: '0 18px 44px -16px rgba(124,58,237,0.4)' }}
      className="rounded-2xl glass p-4"
    >
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-neon">{value}</p>
    </motion.div>
  );
}
