import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Listing } from '../../types/api';
import { formatPrice } from '../../lib/format';
import { useCreateOrder } from '../orders/useCreateOrder';
import { useOrderStatus } from '../orders/useOrderStatus';
import { api, ApiRequestError } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { Equalizer } from '../../components/AnimatedBackground';
import { eventPhoto } from '../../lib/concertPhoto';

interface Props {
  listing: Listing | null;
  onClose: () => void;
}

// Modale du tunnel d'achat : réservation -> paiement -> suivi du transfert (US-4/5).
export function CheckoutModal({ listing, onClose }: Props) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false); // Stripe en mode simulé (dev)
  const [confirming, setConfirming] = useState(false);
  const createOrder = useCreateOrder();
  const { data: order } = useOrderStatus(orderId);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setOrderId(null);
    setSimulated(false);
    setConfirming(false);
    createOrder.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id]);

  // Redirige vers la connexion en mémorisant la page d'origine (retour après login).
  function goToLogin() {
    onClose();
    navigate('/login', { state: { from: location.pathname } });
  }

  async function handleConfirm() {
    if (!listing) return;
    if (!user) {
      goToLogin();
      return;
    }
    const res = await createOrder.mutateAsync(listing.id);
    // Stripe réel : redirection vers la page de paiement hébergée (sandbox).
    if (res.checkoutUrl) {
      window.location.href = res.checkoutUrl;
      return;
    }
    setOrderId(res.orderId);
    // clientSecret factice « pi_fake… » => Stripe simulé : on propose la validation manuelle.
    setSimulated(Boolean(res.clientSecret?.startsWith('pi_fake')));
  }

  // Mode démo uniquement : appelle l'endpoint de simulation dédié, qui marque la
  // commande payée puis déclenche le transfert (en prod, c'est le webhook Stripe
  // `payment_intent.succeeded` qui joue ce rôle). L'endpoint refuse si Stripe est actif.
  async function handleSimulatePay() {
    if (!orderId) return;
    setConfirming(true);
    try {
      await api(`/orders/${orderId}/simulate-pay`, { method: 'POST' });
    } finally {
      setConfirming(false);
    }
  }

  const errorCode = createOrder.error instanceof ApiRequestError ? createOrder.error.code : null;

  return (
    <AnimatePresence>
      {listing && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Tunnel d'achat"
        >
          <motion.div
            className="w-full max-w-md overflow-hidden rounded-3xl glass shadow-glow"
            initial={{ y: 30, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-28 overflow-hidden bg-carbon">
              <img
                src={eventPhoto(listing.event, 640)}
                alt={`Photo de concert — ${listing.event.name}`}
                className="absolute inset-0 h-full w-full object-cover grayscale-[15%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 to-transparent" />
              <Equalizer bars={8} className="absolute bottom-3 left-5 h-8 [&_span]:!bg-white" />
            </div>

            <div className="p-6">
              <h2 className="text-lg font-bold text-carbon">{listing.event.name}</h2>
              <p className="mt-1 text-3xl font-extrabold text-carbon">{formatPrice(listing.price)}</p>

              {errorCode && (
                <p className="mt-4 rounded-xl border border-red-400/40 bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {errorCode === 'LISTING_RESERVED'
                    ? 'Ce billet vient d’être réservé par un autre acheteur.'
                    : errorCode === 'RESALE_WINDOW_CLOSED'
                      ? 'La fenêtre de revente est fermée.'
                      : 'Une erreur est survenue. Réessayez.'}
                </p>
              )}

              {!user && !orderId && (
                <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" role="note">
                  🔒 Connecte-toi pour finaliser l'achat de ce billet.
                </p>
              )}

              {order?.status === 'transferred' ? (
                <motion.p
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-700"
                >
                  ✅ Achat confirmé — ton nouveau billet est dans « Mes billets ».
                </motion.p>
              ) : order?.status === 'failed' ? (
                <p className="mt-4 rounded-xl border border-red-400/40 bg-red-50 p-3 text-sm text-red-700">
                  Paiement échoué. L’annonce a été relibérée.
                </p>
              ) : orderId ? (
                <div className="mt-4 space-y-3">
                  {simulated ? (
                    <>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" role="note">
                        💳 Paiement simulé — aucun débit réel n'est effectué. Clique pour confirmer.
                      </p>
                      <motion.button
                        type="button"
                        onClick={handleSimulatePay}
                        disabled={confirming}
                        whileTap={{ scale: 0.97 }}
                        className="btn-neon w-full"
                      >
                        {confirming ? 'Validation du paiement…' : 'Confirmer le paiement'}
                      </motion.button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <Equalizer bars={4} className="h-4" /> Paiement en cours de confirmation…
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-800"
                >
                  Fermer
                </button>
                {!orderId &&
                  (user ? (
                    <motion.button
                      type="button"
                      onClick={handleConfirm}
                      disabled={createOrder.isPending}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="btn-neon"
                    >
                      {createOrder.isPending ? 'Réservation…' : 'Payer'}
                    </motion.button>
                  ) : (
                    <motion.button
                      type="button"
                      onClick={goToLogin}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="btn-neon"
                    >
                      Se connecter pour acheter
                    </motion.button>
                  ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
