import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

// Masque le splash (défini dans index.html) une fois React monté, en garantissant
// une durée d'affichage minimale pour que l'animation d'entrée reste visible.
(function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const MIN_VISIBLE_MS = 1100;
  const elapsed = Date.now() - (window as unknown as { __splashStart?: number }).__splashStart!;
  const wait = Math.max(0, MIN_VISIBLE_MS - (Number.isFinite(elapsed) ? elapsed : 0));
  window.setTimeout(() => {
    splash.classList.add('is-hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // Filet de sécurité si transitionend ne se déclenche pas (onglet en arrière-plan).
    window.setTimeout(() => splash.remove(), 800);
  }, wait);
})();
