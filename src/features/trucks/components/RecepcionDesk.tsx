import { useEffect, useMemo, useState } from 'react';
import { deleteTruck, subscribeAllTrucks, updateTruckStatus } from '../services/trucksApi';
import type { Truck } from '../types';
import { TruckCard } from './TruckCard';
import { useAuth } from '../../auth/AuthProvider';

export const RecepcionDesk = () => {
  const { user, role } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAllTrucks(setTrucks);
    return () => unsub();
  }, []);

  const lista = useMemo(
    () =>
      trucks
        .filter((t) => ['en_espera', 'en_curso', 'recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(t.status))
        .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)),
    [trucks],
  );

  const mover = async (id: string, status: any) => {
    if (!user) return;
    try {
      setError(null);
      await updateTruckStatus(id, status, { userId: user.id, role });
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado (revisa permisos o conexion).');
    }
  };

  const eliminar = async (id: string) => {
    if (!user) return;
    const ok = window.confirm('Eliminar este camion? Esta accion es permanente.');
    if (!ok) return;
    try {
      setError(null);
      await deleteTruck(id);
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar el camion (permisos o red).');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Recepcion</h2>
          <p className="text-sm text-slate-400">Control de cola y paso a andenes</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {lista.map((truck) => {
          const actions = [];
          if (user && (role === 'recepcion' || role === 'admin' || role === 'superadmin')) {
            if (truck.status === 'en_espera') {
              actions.push({ label: 'Enviar a anden', onClick: () => mover(truck.id, 'en_curso') });
            }
            if (truck.status === 'en_curso') {
              actions.push({ label: 'Marcar recepcionado', onClick: () => mover(truck.id, 'recepcionado') });
            }
            if (truck.status === 'recepcionado') {
              actions.push({ label: 'Marcar almacenado', onClick: () => mover(truck.id, 'almacenado') });
              actions.push({ label: 'Cerrar viaje', onClick: () => mover(truck.id, 'cerrado') });
            }
            if (truck.status === 'almacenado') {
              actions.push({ label: 'Cerrar', onClick: () => mover(truck.id, 'cerrado') });
            }
            actions.push({ label: 'Eliminar', onClick: () => eliminar(truck.id), tone: 'warning' as const });
          }
          return <TruckCard key={truck.id} truck={truck} role={role} actions={actions} readOnly={actions.length === 0} />;
        })}
        {lista.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-200">
            Sin camiones en cola o proceso.
          </div>
        )}
      </div>
    </div>
  );
};
