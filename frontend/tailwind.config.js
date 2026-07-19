/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Thème « éditorial noir sur blanc » (design-system : Minimalist Monochrome).
        // Le blanc et l'encre portent l'UI ; la couleur vient des photos de concert.
        ink: '#ffffff', // fond de page (blanc)
        surface: '#ffffff',
        carbon: '#0a0a0a', // encre quasi-noire (texte / boutons)
        // Accent festif unique : violet électrique (goût de fête / club).
        accent: '#7c3aed',
        'accent-dark': '#6d28d9', // survol / état actif
        'accent-soft': '#ede9fe', // fond très clair (halos, surfaces)
        // Échelle neutre pour bordures / états (alignée zinc).
        neon: {
          // Conservé pour compat (maquette/poster) mais neutralisé en monochrome.
          magenta: '#18181b',
          violet: '#18181b',
          cyan: '#18181b',
          lime: '#18181b',
          cyanInk: '#18181b',
          limeInk: '#18181b',
        },
        // Tokens sémantiques : petits points de statut (accents, jamais l'UI entière).
        available: '#16a34a', // billet disponible (vert)
        reserved: '#d97706', // en cours de réservation (ambre)
        soldout: '#e11d48', // vendu / indisponible (rouge)
      },
      fontFamily: {
        // Righteous : titres display (impact événementiel). Poppins : corps de texte.
        display: ['Righteous', 'system-ui', 'sans-serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Ombres neutres (encre) — élévation douce.
        glow: '0 18px 50px -18px rgba(10,10,10,0.35)',
        'glow-cyan': '0 18px 50px -18px rgba(10,10,10,0.3)',
        'glow-lime': '0 18px 50px -18px rgba(10,10,10,0.25)',
        card: '0 12px 32px -16px rgba(10,10,10,0.22)',
        // Halo violet festif (CTA / éléments live).
        'glow-violet': '0 18px 50px -16px rgba(124,58,237,0.5)',
        'glow-accent': '0 20px 55px -18px rgba(124,58,237,0.55)',
      },
      backgroundImage: {
        // Dégradés monochromes (encre → gris) pour les fonds décoratifs.
        'neon-gradient': 'linear-gradient(120deg,#0a0a0a 0%,#3f3f46 50%,#0a0a0a 100%)',
        aurora: 'linear-gradient(120deg,#18181b 0%,#52525b 50%,#a1a1aa 100%)',
        sunset: 'linear-gradient(120deg,#0a0a0a 0%,#52525b 55%,#a1a1aa 100%)',
        nightlife: 'linear-gradient(135deg,#0a0a0a 0%,#27272a 55%,#52525b 120%)',
        // Voile radial neutre réutilisable.
        'glow-radial':
          'radial-gradient(80% 120% at 20% 0%, rgba(10,10,10,0.06), transparent 60%)',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-30px) translateX(20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        // Panoramique lent d'un dégradé (texte / bordures vivantes).
        'gradient-pan': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        // Halo pulsé violet pour éléments « live » (drop, compte à rebours).
        'pulse-glow': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(124,58,237,0.5)' },
          '50%': { boxShadow: '0 0 22px 5px rgba(124,58,237,0.18)' },
        },
        // Apparition douce vers le haut (fallback CSS hors framer-motion).
        rise: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 12s ease-in-out infinite',
        shimmer: 'shimmer 4s linear infinite',
        'gradient-pan': 'gradient-pan 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        rise: 'rise 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
