import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from './AuthProvider';
import { auth } from '../../shared/config/firebase';

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
  const [showPassword, setShowPassword] = useState(false);

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

  const baseBg = 'bg-slate-900';
  const panelBg = 'bg-white border-slate-200 text-slate-900 shadow-xl';
  const brandLogo = '/friosan-logo.png'; // coloca tu archivo exacto en public/friosan-logo.png

  return (
    <div className={`relative min-h-screen overflow-hidden ${baseBg}`}>
      <div
        className="absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            'linear-gradient(135deg, #0b1830 0%, #0f213f 40%, #0c2b4f 100%)',
        }}
      />
      <div className="absolute inset-0 opacity-25">
        <div className="logistics-bg" aria-hidden />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-4 py-10 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-800/70 px-4 py-3 shadow-md backdrop-blur">
            <img
              src={brandLogo}
              alt="Friosan Logo"
              className="h-12 w-auto rounded-lg bg-white/80 px-2 py-1"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-200">Friosan Logistica</p>
              <p className="text-sm text-slate-300">Acceso seguro por rol</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Fecha</p>
              <p className="text-sm font-semibold text-slate-100">
                {now.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Hora</p>
              <p className="text-sm font-semibold text-slate-100">
                {now.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className={`overflow-hidden rounded-3xl border ${panelBg} shadow-[0_20px_80px_rgba(0,0,0,0.35)]`}>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Inicia sesion</p>
                <h2 className="text-xl font-semibold text-slate-900">Credenciales del rol</h2>
                <p className="text-sm text-slate-500">Usuario y contraseña</p>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-5">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm text-slate-700">Usuario (correo)</label>
                  <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
                    <span className="pr-2 text-slate-500">@</span>
                    <input
                      type="email"
                      className="w-full bg-transparent text-sm text-slate-900 outline-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-700">Contraseña</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
                    <span className="pr-2 text-slate-500">🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full bg-transparent text-sm text-slate-900 outline-none"
                      value={password}
                      autoComplete="current-password"
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="font-semibold text-accent hover:underline"
                    >
                      Olvidé contraseña
                    </button>
                    <span className="text-slate-500">Acceso interno</span>
                  </div>
                </div>

                {error && <p className="text-sm text-rose-500">{error}</p>}
                {message && <p className="text-sm text-emerald-600">{message}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? 'Ingresando...' : 'Iniciar sesión'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
