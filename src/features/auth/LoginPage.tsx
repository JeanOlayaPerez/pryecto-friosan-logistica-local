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

  const baseBg = 'bg-slate-100';
  const panelBg = 'bg-white border-slate-200 text-slate-900 shadow-xl';
  const brandLogo =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width=\"220\" height=\"80\" viewBox=\"0 0 220 80\" fill=\"none\"><rect width=\"220\" height=\"80\" rx=\"10\" fill=\"%231d4ed8\"/><circle cx=\"48\" cy=\"40\" r=\"26\" fill=\"%23ffffff\" fill-opacity=\"0.18\"/><path d=\"M62 22c-5.2-4.5-12.4-6-18.9-3.9C33 21 27 29 27 38c0 10 8 18 18 18 5.7 0 11-2.7 14.4-7.2\" stroke=\"%23a5d8ff\" stroke-width=\"4\" stroke-linecap=\"round\"/><text x=\"80\" y=\"49\" font-family=\"Arial, sans-serif\" font-size=\"28\" font-weight=\"700\" fill=\"%23dbeafe\">FRIOSAN</text></svg>';

  return (
    <div className={`relative min-h-screen overflow-hidden ${baseBg}`}>
      <div
        className="absolute inset-0 opacity-50"
        aria-hidden
        style={{
          background:
            'radial-gradient(circle at 10% 10%, rgba(59,130,246,0.15), transparent 25%), radial-gradient(circle at 90% 0%, rgba(45,212,191,0.14), transparent 28%), radial-gradient(circle at 40% 90%, rgba(52,211,153,0.12), transparent 28%)',
        }}
      />
      <div className="absolute inset-0 opacity-30">
        <div className="logistics-bg" aria-hidden />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-4 py-10 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-md backdrop-blur">
            <img
              src={brandLogo}
              alt="Friosan Logo"
              className="h-12 w-auto"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Friosan Logistica</p>
              <p className="text-sm text-slate-600">Acceso seguro por rol</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fecha</p>
              <p className="text-sm font-semibold text-slate-900">
                {now.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hora</p>
              <p className="text-sm font-semibold text-slate-900">
                {now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
