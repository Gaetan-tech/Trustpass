import type { Variants } from 'framer-motion';

// Presets d'animation partagés (dérivés du skill ui-ux-pro-max, domaine `gsap`).
// Durées 250–450 ms, easing `back.out(1.4)` → courbe de Bézier équivalente en framer-motion.

// Courbe d'overshoot doux, équivalent de gsap `back.out(1.4)`.
export const backOut: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

// Conteneur qui orchestre l'apparition en cascade de ses enfants.
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

// Élément de grille/liste : monte + s'agrandit avec un léger rebond.
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: backOut } },
};

// Titre / bloc qui apparaît en fondu vers le haut (durée réglable via delay).
export const fadeUp = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: 'easeOut' } },
});

// Révélation au scroll : à brancher via `whileInView` + `viewport`.
export const scrollReveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: backOut } },
};

// Config `viewport` standard : ne déclenche qu'une fois, un peu avant l'entrée en vue.
export const viewportOnce = { once: true, amount: 0.2, margin: '0px 0px -80px 0px' } as const;

// Micro-interaction de survol : légère élévation + glow (à combiner avec `.card-hover`).
export const hoverLift = {
  whileHover: { y: -6, transition: { duration: 0.2, ease: 'easeOut' } },
  whileTap: { scale: 0.98 },
} as const;
