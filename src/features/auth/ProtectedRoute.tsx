import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export const ProtectedRoute = () => {
  const { user, loading, role } = useAuth();
  const location = useLocation();

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

  if (location.pathname === '/porteria' && !['porteria', 'admin', 'superadmin'].includes(role ?? '')) {
    return <Navigate to="/" replace />;
  }

  if (role === 'porteria' && location.pathname !== '/porteria') {
    return <Navigate to="/porteria" replace />;
  }

  if (role === 'comercial' && location.pathname !== '/comercial') {
    return <Navigate to="/comercial" replace />;
  }

  return <Outlet />;
};
