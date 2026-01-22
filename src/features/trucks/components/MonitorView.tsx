import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { fetchAllTrucksOnce, subscribeAllTrucks, updateTruckStatus } from '../services/trucksApi';
import type { DockType, Truck, TruckStatus } from '../types';
import { TruckCard } from './TruckCard';
import { useAuth } from '../../auth/AuthProvider';

const statusOrder: TruckStatus[] = [
  'en_porteria',
  'en_espera',
  'en_curso',
  'recepcionado',
  'almacenado',
];

const statusLabel: Record<TruckStatus, string> = {
  agendado: 'Agendado',
  en_camino: 'En camino',
  en_porteria: 'Porteria',
  en_espera: 'En espera',
  en_curso: 'En curso',
  recepcionado: 'Recepcionado',
  almacenado: 'Almacenado',
  cerrado: 'Cerrado',
  terminado: 'Terminado',
};

const formatTime = (value: Date | null) => {
  if (!value) return '--:--';
  return value.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const useMonitorTrucks = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const fetchInFlight = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let watchdogId: ReturnType<typeof setInterval> | null = null;
    let active = true;

    const markUpdate = (data: Truck[], nextSource: string, nextError?: string | null) => {
      if (!active) return;
      setTrucks(data);
      setLastUpdatedAt(new Date());
      setSource(nextSource);
      setError(nextError ?? null);
      lastUpdateRef.current = Date.now();
    };

    const setErrorOnly = (message: string) => {
      if (!active) return;
      setError(message);
    };

    const loadOnce = async () => {
      if (fetchInFlight.current) return;
      fetchInFlight.current = true;
      try {
        const result = await fetchAllTrucksOnce({ preferApi: true, preferLite: true });
        markUpdate(result.data, `fetch-${result.source}`, result.error ?? null);
      } catch (err) {
        console.error('Error cargando camiones para monitor', err);
        setErrorOnly(err instanceof Error ? err.message : 'Error cargando camiones');
      } finally {
        fetchInFlight.current = false;
      }
    };

    unsub = subscribeAllTrucks(
      (data) => {
        markUpdate(data, 'listener');
      },
      (err) => {
        console.error('Error en listener de monitor', err);
        setErrorOnly('Se perdio la conexion en vivo. Reintentando.');
        void loadOnce();
      },
    );

    void loadOnce();

    watchdogId = setInterval(() => {
      const staleMs = Date.now() - lastUpdateRef.current;
      if (!lastUpdateRef.current || staleMs > 45000) {
        void loadOnce();
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadOnce();
      }
    };
    const handleOnline = () => {
      void loadOnce();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      if (unsub) unsub();
      if (watchdogId) clearInterval(watchdogId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return { trucks, lastUpdatedAt, source, error };
};

const SummaryCard = ({ title, value }: { title: string; value: number }) => (
  <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center shadow-panel">
    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{title}</p>
    <p className="text-4xl font-bold text-white">{value}</p>
  </div>
);

export const MonitorView = () => {
  const { role, user } = useAuth();
  const { trucks, lastUpdatedAt, source, error } = useMonitorTrucks();
  const recepcionTrucks = useMemo(
    () => trucks.filter((truck) => truck.dockType === 'recepcion'),
    [trucks],
  );
  const despachoTrucks = useMemo(
    () => trucks.filter((truck) => truck.dockType === 'despacho'),
    [trucks],
  );
  const activeRecepcionTrucks = useMemo(
    () => recepcionTrucks.filter((truck) => truck.status !== 'cerrado' && truck.status !== 'terminado'),
    [recepcionTrucks],
  );
  const activeDespachoTrucks = useMemo(
    () => despachoTrucks.filter((truck) => truck.status !== 'cerrado' && truck.status !== 'terminado'),
    [despachoTrucks],
  );
  const canFinalize =
    Boolean(user) && ['recepcion', 'comercial', 'admin', 'superadmin'].includes(role ?? '');

  const counts = useMemo(() => {
    const buildCounts = (list: Truck[]) =>
      list.reduce(
        (acc, t) => {
          acc[t.status] = (acc[t.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<TruckStatus, number>,
      );
    return {
      recepcion: buildCounts(recepcionTrucks),
      despacho: buildCounts(despachoTrucks),
    };
  }, [recepcionTrucks, despachoTrucks]);

  const handleFinalize = async (truck: Truck) => {
    if (!user?.id || !canFinalize) return;
    const ok = window.confirm(`Finalizar camion ${truck.plate || truck.clientName}?`);
    if (!ok) return;
    try {
      await updateTruckStatus(truck.id, 'terminado', { userId: user.id, role });
    } catch (err) {
      console.error(err);
      window.alert('No se pudo finalizar el camion. Revisa permisos o conexion.');
    }
  };

  const buildActions = (truck: Truck) => {
    if (!canFinalize) return [];
    if (truck.status === 'cerrado' || truck.status === 'terminado') return [];
    return [
      {
        label: 'Finalizar',
        tone: 'warning' as const,
        onClick: () => handleFinalize(truck),
      },
    ];
  };

  const board = (dock: DockType, list: Truck[]) => (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-surface-panel/60 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">
          {dock === 'recepcion' ? 'Recepcion' : 'Despacho'}
        </h3>
        <div className="flex gap-2 text-xs text-slate-400">
          {statusOrder.map((status) => (
            <div key={status} className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
              <span className="text-slate-200">{statusLabel[status]}</span>
              <span className="text-accent font-semibold">{list.filter((t) => t.status === status).length}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {statusOrder.map((status) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-base font-semibold text-white">{statusLabel[status]}</p>
              <span className="text-2xl font-bold text-accent">
                {list.filter((t) => t.status === status).length}
              </span>
            </div>
            <AnimatePresence>
              {list
                .filter((t) => t.status === status)
                .map((truck) => (
                  <TruckCard
                    key={truck.id}
                    truck={truck}
                    role={role}
                    readOnly={!canFinalize}
                    actions={buildActions(truck)}
                  />
                ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 shadow-panel">
        <span>Ultima actualizacion: {formatTime(lastUpdatedAt)}</span>
        <span className="text-slate-400">Fuente: {source ?? '--'}</span>
      </div>
      {error && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 shadow-panel">
          {error}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Recepcion en porteria" value={counts.recepcion.en_porteria ?? 0} />
        <SummaryCard title="Recepcion en curso" value={counts.recepcion.en_curso ?? 0} />
        <SummaryCard
          title="Recepcion finalizado"
          value={
            (counts.recepcion.recepcionado ?? 0) +
            (counts.recepcion.almacenado ?? 0) +
            (counts.recepcion.cerrado ?? 0) +
            (counts.recepcion.terminado ?? 0)
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Despacho en porteria" value={counts.despacho.en_porteria ?? 0} />
        <SummaryCard title="Despacho en curso" value={counts.despacho.en_curso ?? 0} />
        <SummaryCard
          title="Despacho finalizado"
          value={
            (counts.despacho.recepcionado ?? 0) +
            (counts.despacho.almacenado ?? 0) +
            (counts.despacho.cerrado ?? 0) +
            (counts.despacho.terminado ?? 0)
          }
        />
      </div>

      {board('recepcion', activeRecepcionTrucks)}
      {board('despacho', activeDespachoTrucks)}
    </div>
  );
};
