import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from './AuthProvider';
import { auth } from '../../shared/config/firebase';

type Mode = 'night' | 'day';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<Mode>('night');

  const from = (location.state as { from?: string } | undefined)?.from ?? '/';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError('No pudimos iniciar sesion. Revisa tus credenciales.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setMessage(null);
    if (!email) {
      setError('Ingresa tu correo para recuperar la clave.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Te enviamos un correo para restablecer la contrasena.');
    } catch (err) {
      console.error(err);
      setError('No se pudo enviar el correo de recuperacion.');
    }
  };

  const toggleMode = () => setMode((prev) => (prev === 'night' ? 'day' : 'night'));

  const baseBg = mode === 'night' ? 'bg-surface-dark' : 'bg-slate-100';
  const panelBg =
    mode === 'night'
      ? 'bg-gradient-to-br from-white/10 via-surface-panel to-surface-dark border-white/10 text-slate-100'
      : 'bg-white border-slate-200 text-slate-900 shadow-xl';
  const textPrimary = mode === 'night' ? 'text-white' : 'text-slate-900';
  const textSecondary = mode === 'night' ? 'text-slate-300' : 'text-slate-600';

  return (
    <div className={`relative min-h-screen overflow-hidden ${baseBg}`}>
      <div
        className="absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            mode === 'night'
              ? 'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.15), transparent 30%), radial-gradient(circle at 80% 0%, rgba(168,85,247,0.12), transparent 30%), radial-gradient(circle at 50% 80%, rgba(16,185,129,0.12), transparent 30%)'
              : 'radial-gradient(circle at 10% 10%, rgba(59,130,246,0.2), transparent 25%), radial-gradient(circle at 90% 0%, rgba(45,212,191,0.18), transparent 28%), radial-gradient(circle at 40% 90%, rgba(52,211,153,0.18), transparent 28%)',
        }}
      />
      <div className="absolute inset-0 opacity-30">
        <div className="logistics-bg" aria-hidden />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-4 py-10 md:flex-row md:items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-200">
            <span>Friosan Logistica</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-slate-900">Seguro</span>
          </div>
          <h1 className={`text-4xl font-bold leading-tight md:text-5xl ${textPrimary}`}>
            Acceso centralizado para el panel operativo
          </h1>
          <p className={`max-w-2xl text-lg ${textSecondary}`}>
            Roles separados, datos en tiempo real y recuperacion de clave integrada. Mantiene los accesos
            listos para la demo y para produccion.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-panel">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fecha y hora</p>
              <p className="text-lg font-semibold text-white">
                {now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-sm text-slate-300">
                {now.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-panel">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sesion</p>
              <p className="text-lg font-semibold text-white">No persistente</p>
              <p className="text-sm text-slate-300">Cada refresh vuelve al login.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-panel">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recuperacion</p>
              <p className="text-lg font-semibold text-white">Correo Firebase</p>
              <p className="text-sm text-slate-300">Link automatico de cambio de clave.</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className={`overflow-hidden rounded-3xl border ${panelBg} shadow-[0_20px_80px_rgba(0,0,0,0.35)]`}>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Inicia sesion</p>
                <h2 className="text-xl font-semibold text-white">Credenciales del rol</h2>
                <p className="text-sm text-slate-400">Correo y clave asignados a tu rol.</p>
              </div>
              <button
                type="button"
                onClick={toggleMode}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
              >
                {mode === 'night' ? 'Modo dia' : 'Modo noche'}
              </button>
            </div>

            <div className="border-t border-white/10 bg-black/10 px-6 py-5">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm text-slate-300">Correo</label>
                  <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-surface-panel px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
                    <span className="pr-2 text-slate-400">@</span>
                    <input
                      type="email"
                      className="w-full bg-transparent text-sm text-white outline-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-300">Contrasena</label>
                  <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-surface-panel px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
                    <span className="pr-2 text-slate-400">***</span>
                    <input
                      type="password"
                      className="w-full bg-transparent text-sm text-white outline-none"
                      value={password}
                      autoComplete="current-password"
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="font-semibold text-accent hover:underline"
                    >
                      Olvide mi contrasena
                    </button>
                    <span className="text-slate-400">Acceso solo para cuentas internas</span>
                  </div>
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}
                {message && <p className="text-sm text-emerald-400">{message}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? 'Ingresando...' : 'Entrar'}
                </button>
              </form>

              <div className="mt-4 text-xs text-slate-400">
                Tip: usa los correos de prueba (porteria@..., recepcion@..., operaciones@..., visor@...) y la clave que definiste en Firebase Auth.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
