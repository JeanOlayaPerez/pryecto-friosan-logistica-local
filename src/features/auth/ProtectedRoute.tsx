import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export const ProtectedRoute = () => {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  const guessRole = () => {
    if (role) return role;
    const email = user?.email?.toLowerCase() ?? '';
    if (email.includes('porteria')) return 'porteria';
    if (email.includes('recepcion')) return 'recepcion';
    if (email.includes('comercial')) return 'comercial';
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
          : effectiveRole === 'visor'
            ? '/visor'
            : '/';

  const canSeeCommercial = ['comercial', 'admin', 'superadmin', 'operaciones'].includes(effectiveRole ?? '');
  const isGeneralPath = location.pathname === '/visor';

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-300">
        Cargando sesion...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (location.pathname === '/porteria' && !['porteria', 'admin', 'superadmin'].includes(effectiveRole ?? '')) {
    return <Navigate to="/" replace />;
  }

  if (effectiveRole === 'porteria' && location.pathname !== '/porteria') {
    return <Navigate to="/porteria" replace />;
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

  return <Outlet />;
};
