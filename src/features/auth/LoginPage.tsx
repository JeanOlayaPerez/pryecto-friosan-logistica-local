import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | undefined)?.from ?? '/';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError('No pudimos iniciar sesión. Revisa tus credenciales.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dark px-4">
      <div className="glass w-full max-w-md rounded-3xl border border-white/10 p-8 shadow-panel">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Friosan Logística
          </p>
          <h1 className="text-2xl font-semibold text-white">Inicia sesión</h1>
          <p className="mt-1 text-sm text-slate-400">
            Demo local, sin Firebase. Prueba con:
            <br />
            <span className="text-slate-200">operaciones@friosan.com</span> / <span className="text-slate-200">demo123</span>
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm text-slate-300">Correo</label>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-panel px-3 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Contraseña</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-panel px-3 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
