import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLogin } from '../features/auth/useAuthMutations';
import { ApiRequestError } from '../lib/api';
import { Equalizer } from '../components/AnimatedBackground';

// Écran de connexion (US-1.2).
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Retour à la page d'origine après connexion (ex. reprise d'un achat), sinon accueil.
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login.mutateAsync({ email, password });
    navigate(from);
  }

  const invalid = login.error instanceof ApiRequestError && login.error.code === 'INVALID_CREDENTIALS';

  return (
    <section className="flex justify-center px-5 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl glass p-8 shadow-glow-violet"
      >
        <div className="mb-6 flex items-center gap-2">
          <Equalizer className="h-5" />
          <h1 className="text-2xl font-extrabold">Connexion</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-slate-600">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-dark mt-1"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-dark mt-1"
            />
          </label>
          {login.isError && (
            <p className="text-sm text-red-600" role="alert">
              {invalid ? 'Email ou mot de passe incorrect.' : 'Connexion impossible.'}
            </p>
          )}
          <motion.button
            type="submit"
            disabled={login.isPending}
            whileTap={{ scale: 0.97 }}
            className="btn-neon w-full"
          >
            {login.isPending ? 'Connexion…' : 'Se connecter'}
          </motion.button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          Pas de compte ?{' '}
          <Link to="/register" className="link-accent">
            Créer un compte
          </Link>
        </p>
      </motion.div>
    </section>
  );
}
