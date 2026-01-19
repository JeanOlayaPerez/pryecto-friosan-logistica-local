import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../shared/config/firebase';
import { useAuth } from './AuthProvider';

export const ProtectedRoute = () => {
  const { user, loading, role } = useAuth();
  const location = useLocation();
  const [visorAuthError, setVisorAuthError] = useState<string | null>(null);
  const [visorAuthWorking, setVisorAuthWorking] = useState(false);
  const [visorAuthAttempted, setVisorAuthAttempted] = useState(false);

  const guessRole = () => {
    if (role) return role;
    const email = user?.email?.toLowerCase() ?? '';
    if (email.includes('porteria')) return 'porteria';
    if (email.includes('recepcion')) return 'recepcion';
    if (email.includes('comercial')) return 'comercial';
    if (email.includes('cliente') || email.includes('clientes') || email.includes('empresa')) return 'clientes';
    if (email.includes('operaciones')) return 'operaciones';
    if (email.includes('gerencia')) return 'gerencia';
    if (email.includes('visor') || email.includes('pantalla') || email.includes('display')) return 'visor';
    if (email.includes('admin')) return 'admin';
    return null;
  };

  const effectiveRole = guessRole();

  const defaultHome =
    effectiveRole === 'porteria'
      ? '/porteria'
      : effectiveRole === 'comercial'
        ? '/comercial'
        : effectiveRole === 'recepcion'
          ? '/recepcion'
          : effectiveRole === 'clientes'
            ? '/clientes'
            : effectiveRole === 'visor'
              ? '/visor'
              : effectiveRole === 'gerencia'
                ? '/gerencia'
                : '/';

  const canSeeCommercial = ['comercial', 'admin', 'superadmin', 'operaciones'].includes(effectiveRole ?? '');
  const isGeneralPath = location.pathname === '/visor';
  const shouldTryVisorAuth = isGeneralPath && !user;

  const tryVisorAuth = useCallback(async () => {
    if (visorAuthWorking) return;
    setVisorAuthError(null);
    setVisorAuthWorking(true);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo iniciar sesion anonima';
      setVisorAuthError(message);
    } finally {
      setVisorAuthWorking(false);
    }
  }, [visorAuthWorking]);

  useEffect(() => {
    if (shouldTryVisorAuth && !visorAuthAttempted) {
      setVisorAuthAttempted(true);
      void tryVisorAuth();
    }
  }, [shouldTryVisorAuth, visorAuthAttempted, tryVisorAuth]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-300">
        {isGeneralPath ? 'Iniciando visor...' : 'Cargando sesion...'}
      </div>
    );
  }

  if (!user) {
    if (isGeneralPath) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-slate-200">
          <div className="max-w-lg space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 px-5 py-4 text-sm">
            <p className="text-base font-semibold text-slate-100">No se pudo iniciar el visor.</p>
            <p className="text-slate-300">
              Revisa que Anonymous este habilitado en Firebase Auth y que el dominio del sitio este autorizado.
            </p>
            {visorAuthError && (
              <p className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Error: {visorAuthError}
              </p>
            )}
            <button
              type="button"
              onClick={tryVisorAuth}
              disabled={visorAuthWorking}
              className="rounded-full border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 disabled:opacity-60"
            >
              {visorAuthWorking ? 'Conectando...' : 'Reintentar acceso'}
            </button>
          </div>
        </div>
      );
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (location.pathname === '/porteria' && !['porteria', 'admin', 'superadmin'].includes(effectiveRole ?? '')) {
    return <Navigate to="/" replace />;
  }

  if (effectiveRole === 'porteria' && location.pathname !== '/porteria') {
    return <Navigate to="/porteria" replace />;
  }

  if (effectiveRole === 'clientes' && location.pathname !== '/clientes') {
    return <Navigate to="/clientes" replace />;
  }

  if (effectiveRole === 'recepcion' && location.pathname !== '/recepcion') {
    return <Navigate to="/recepcion" replace />;
  }

  if (effectiveRole === 'comercial' && location.pathname !== '/comercial') {
    return <Navigate to="/comercial" replace />;
  }

  if (location.pathname === '/comercial' && !canSeeCommercial) {
    return <Navigate to={defaultHome} replace />;
  }

  if (effectiveRole === 'visor' && location.pathname !== '/visor') {
    return <Navigate to="/visor" replace />;
  }

  if (isGeneralPath && effectiveRole !== 'visor') {
    return <Navigate to={defaultHome} replace />;
  }

  if (effectiveRole === 'gerencia' && !['/gerencia', '/gerencia/reportes'].includes(location.pathname)) {
    return <Navigate to="/gerencia" replace />;
  }

  return <Outlet />;
};
