import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRegister } from '../features/auth/useAuthMutations';
import { ApiRequestError } from '../lib/api';
import { Equalizer } from '../components/AnimatedBackground';

// Écran d'inscription (US-1.1) — enchaîne sur une connexion automatique.
export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await register.mutateAsync({ email, password });
    navigate('/');
  }

  const taken = register.error instanceof ApiRequestError && register.error.code === 'EMAIL_TAKEN';

  return (
    <section className="flex justify-center px-5 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl glass p-8 shadow-glow"
      >
        <div className="mb-6 flex items-center gap-2">
          <Equalizer className="h-5" />
          <h1 className="text-2xl font-extrabold">Créer un compte</h1>
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
            Mot de passe (8 caractères min.)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input-dark mt-1"
            />
          </label>
          {register.isError && (
            <p className="text-sm text-red-600" role="alert">
              {taken ? 'Cet email est déjà utilisé.' : 'Inscription impossible.'}
            </p>
          )}
          <motion.button
            type="submit"
            disabled={register.isPending}
            whileTap={{ scale: 0.97 }}
            className="btn-neon w-full"
          >
            {register.isPending ? 'Création…' : 'Créer mon compte'}
          </motion.button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          Déjà inscrit ?{' '}
          <Link to="/login" className="link-accent">
            Se connecter
          </Link>
        </p>
      </motion.div>
    </section>
  );
}
