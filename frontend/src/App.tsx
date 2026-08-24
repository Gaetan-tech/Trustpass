import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MarketplacePage } from './pages/MarketplacePage';
import { EventDetailPage } from './pages/EventDetailPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { SellPage } from './pages/SellPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage';
import { ScanPage } from './pages/ScanPage';
import { MockupPage } from './pages/MockupPage';
import { AnimatedBackground, Equalizer } from './components/AnimatedBackground';
import { useAuth } from './store/auth';
import { useLogout } from './features/auth/useAuthMutations';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`relative text-sm transition-colors ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute -bottom-1.5 left-0 h-0.5 w-full rounded-full bg-accent"
        />
      )}
    </Link>
  );
}

export function App() {
  const user = useAuth((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout.mutateAsync();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AnimatedBackground />

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-ink/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Equalizer className="h-5" />
            <span className="font-display text-xl tracking-tight text-carbon">TrustPass</span>
          </Link>

          <div className="hidden items-center gap-5 sm:flex">
            <NavLink to="/">Marketplace</NavLink>
            {user && <NavLink to="/tickets">Mes billets</NavLink>}
            {user && <NavLink to="/sell">Vendre</NavLink>}
            {user?.role === 'organizer' && <NavLink to="/mockup">Maquette</NavLink>}
            {user?.role === 'organizer' && <NavLink to="/organizer">Organisateur</NavLink>}
            {user?.role === 'controller' && <NavLink to="/scan">Contrôle</NavLink>}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden text-sm text-slate-500 md:inline">{user.email}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-neon text-sm">
                Connexion
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1800px] flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Routes location={location}>
              <Route path="/" element={<MarketplacePage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/tickets" element={<MyTicketsPage />} />
              <Route path="/sell" element={<SellPage />} />
              <Route path="/organizer" element={<OrganizerDashboardPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/mockup" element={<MockupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer inversé : bande noire pleine largeur (pattern éditorial). */}
      <footer className="section-invert mt-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-12 sm:flex-row sm:items-center">
          <div>
            <span className="poster-title text-3xl text-white">TrustPass</span>
            <p className="mt-2 max-w-sm text-sm text-white/50">
              La revente de billets, sans arnaque. Prix plafonné, transfert sécurisé, zéro faux billet.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/60">
            <Link to="/" className="transition-colors hover:text-accent">Marketplace</Link>
            <Link to="/sell" className="transition-colors hover:text-accent">Vendre</Link>
            {user?.role === 'organizer' && (
              <Link to="/mockup" className="transition-colors hover:text-accent">Maquette</Link>
            )}
            <span className="text-white/30">© {new Date().getFullYear()} TrustPass</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
