import { useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../../shared/config/firebase';
import { useAuth } from '../../auth/AuthProvider';
import { GeneralBoard } from './GeneralBoard';

export const VisorTvView = () => {
  const { user, loading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [authWorking, setAuthWorking] = useState(false);
  const [authAttempted, setAuthAttempted] = useState(false);

  const startAnonymous = async () => {
    if (authWorking) return;
    setAuthError(null);
    setAuthWorking(true);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo iniciar sesion anonima';
      setAuthError(message);
    } finally {
      setAuthWorking(false);
    }
  };

  useEffect(() => {
    if (!loading && !user && !authAttempted) {
      setAuthAttempted(true);
      void startAnonymous();
    }
  }, [authAttempted, loading, user]);

  if (loading || authWorking || !user) {
    return (
      <div className="tv-board">
        <div className="tv-card">
          <div className="tv-title">Iniciando visor</div>
          <div className="tv-muted">
            Conectando con Firebase. Si no avanza, revisa que Anonymous este habilitado y el dominio autorizado.
          </div>
          {authError && (
            <div className="tv-alert" style={{ marginTop: '12px' }}>
              Error: {authError}
            </div>
          )}
          <button
            type="button"
            onClick={startAnonymous}
            disabled={authWorking}
            className="tv-button"
            style={{ marginTop: '12px' }}
          >
            {authWorking ? 'Conectando...' : 'Reintentar acceso'}
          </button>
        </div>
      </div>
    );
  }

  return <GeneralBoard />;
};
