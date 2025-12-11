import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  deleteTruck,
  flagTruckDelay,
  subscribeAllTrucks,
  updateTruckStatus,
} from '../services/trucksApi';
import type { DockType, Truck, TruckStatus } from '../types';
import { TruckCard } from './TruckCard';
import { TruckForm } from './TruckForm';
import { useAuth } from '../../auth/AuthProvider';
import { formatDurationSince, isDelayed } from '../../../shared/utils/time';

const activeStatuses: TruckStatus[] = [
  'en_espera',
  'en_curso',
  'recepcionado',
  'almacenado',
  'cerrado',
  'terminado',
];

const statusLabels: Record<TruckStatus, string> = {
  agendado: 'Agendado',
  en_camino: 'En camino',
  en_porteria: 'En porteria',
  en_espera: 'En espera',
  en_curso: 'En curso',
  recepcionado: 'Recepcionado',
  almacenado: 'Almacenado',
  cerrado: 'Cerrado',
  terminado: 'Terminado',
};

const statusChip: Record<TruckStatus, string> = {
  agendado: 'bg-white/10 text-white border border-white/15',
  en_camino: 'bg-white/10 text-white border border-white/15',
  en_porteria: 'bg-white/10 text-white border border-white/15',
  en_espera: 'bg-amber-400/10 text-amber-100 border border-amber-400/30',
  en_curso: 'bg-sky-400/10 text-sky-100 border border-sky-400/30',
  recepcionado: 'bg-emerald-400/10 text-emerald-100 border border-emerald-400/30',
  almacenado: 'bg-emerald-400/10 text-emerald-100 border border-emerald-400/30',
  cerrado: 'bg-white/10 text-white border border-white/15',
  terminado: 'bg-emerald-400/10 text-emerald-100 border border-emerald-400/30',
};

const dockNumbers = Array.from({ length: 9 }, (_, i) => `${i + 1}`);

const columnOrder: TruckStatus[] = activeStatuses;

const statusColor = (status: TruckStatus) => {
  if (status === 'en_espera') return 'border-amber-400/40 bg-amber-500/10';
  if (status === 'en_curso') return 'border-sky-400/40 bg-sky-500/10';
  if (status === 'recepcionado' || status === 'almacenado' || status === 'cerrado' || status === 'terminado')
    return 'border-emerald-400/40 bg-emerald-500/10';
  return 'border-white/15 bg-white/5';
};

const flowOrder: TruckStatus[] = ['en_espera', 'en_curso', 'recepcionado', 'almacenado', 'cerrado', 'terminado'];
const nextStatus = (current: TruckStatus): TruckStatus | null => {
  const idx = flowOrder.indexOf(current);
  if (idx === -1 || idx === flowOrder.length - 1) return null;
  return flowOrder[idx + 1];
};
const prevStatus = (current: TruckStatus): TruckStatus | null => {
  const idx = flowOrder.indexOf(current);
  if (idx <= 0) return null;
  return flowOrder[idx - 1];
};

export const TruckBoard = () => {
  const { user, role } = useAuth();
  const [selectedDock, setSelectedDock] = useState<DockType>('recepcion');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [search, setSearch] = useState('');
  const [viewOnly, setViewOnly] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<{ temp: number; wind: number; description: string } | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [listenerError, setListenerError] = useState<string | null>(null);

  const canRecep = role === 'recepcion' || role === 'admin';
  const canCreate = role === 'admin';
  const readOnly = viewOnly || role === 'comercial' || role === 'gerencia' || role === 'operaciones';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      setLoadingWeather(true);
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-33.45&longitude=-70.66&current_weather=true&timezone=auto',
        );
        const data = await res.json();
        if (data?.current_weather) {
          const code = data.current_weather.weathercode;
          const map: Record<number, string> = {
            0: 'Despejado',
            1: 'Mayormente despejado',
            2: 'Parcial nublado',
            3: 'Nublado',
            45: 'Niebla',
            48: 'Niebla',
            51: 'Llovizna',
            61: 'Lluvia',
            80: 'Chubascos',
          };
          setWeather({
            temp: data.current_weather.temperature,
            wind: data.current_weather.windspeed,
            description: map[code] ?? 'Tiempo estable',
          });
        }
      } catch (err) {
        console.warn('No se pudo obtener clima', err);
      } finally {
        setLoadingWeather(false);
      }
    };
    fetchWeather();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAllTrucks(
      (data) => {
        setListenerError(null);
        setTrucks(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setListenerError('No se pudieron cargar los camiones (permisos o red).');
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const byDock = useMemo(() => trucks.filter((t) => t.dockType === selectedDock), [trucks, selectedDock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = byDock;
    if (!q) return base;
    return base.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        t.plate.toLowerCase().includes(q) ||
        t.driverName.toLowerCase().includes(q) ||
        `${t.dockNumber}`.toLowerCase().includes(q),
    );
  }, [search, byDock]);

  const grouped = useMemo(
    () =>
      filtered.reduce(
        (acc, t) => {
          if (!acc[t.status]) acc[t.status] = [];
          acc[t.status].push(t);
          return acc;
        },
        {} as Record<TruckStatus, Truck[]>,
      ),
    [filtered],
  );

  const agenda = filtered
    .filter((t) => t.status === 'agendado' || t.status === 'en_camino')
    .sort((a, b) => (a.scheduledArrival?.getTime() ?? 0) - (b.scheduledArrival?.getTime() ?? 0))
    .slice(0, 6);

  const todayHist = useMemo(() => {
    const today = new Date();
    const sameDay = (d?: Date | null) =>
      d &&
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return byDock
      .filter((t) => sameDay(t.checkInTime ?? t.createdAt))
      .sort((a, b) => (b.checkInTime?.getTime() ?? 0) - (a.checkInTime?.getTime() ?? 0));
  }, [byDock]);

  const delays = filtered
    .filter((t) => t.status === 'en_espera' && isDelayed(t.checkInTime, 30))
    .slice(0, 4);

  const dockSummary = dockNumbers.map((dock) => {
    const assigned = byDock.filter((t) => `${t.dockNumber}` === dock);
    const occupied = assigned.some(
      (t) => t.status !== 'cerrado' && t.status !== 'almacenado' && t.status !== 'terminado',
    );
    const waiting = assigned.filter((t) => t.status === 'en_espera').length;
    return { dock, count: assigned.length, waiting, occupied };
  });

  const stats = {
    total: filtered.length,
    en_espera: grouped.en_espera?.length ?? 0,
    en_curso: grouped.en_curso?.length ?? 0,
    recepcionado: grouped.recepcionado?.length ?? 0,
    almacenado: grouped.almacenado?.length ?? 0,
  };

  const handleMove = async (truckId: string, status: TruckStatus, note?: string) => {
    if (!user?.id) return;
    try {
      setActionError(null);
      await updateTruckStatus(truckId, status, { userId: user.id, role }, note);
    } catch (err) {
      console.error(err);
      setActionError('No se pudo actualizar el estado. Revisa permisos o conexion.');
    }
  };

  const handleDelay = async (truckId: string, notes: string) => {
    try {
      setActionError(null);
      await flagTruckDelay(truckId, notes, user ? { userId: user.id, role } : undefined);
    } catch (err) {
      console.error(err);
      setActionError('No se pudo marcar retraso. Revisa permisos o conexion.');
    }
  };

  const buildActions = (truck: Truck) => {
    if (readOnly || !user) return [];
    const actions: { label: string; tone?: 'primary' | 'success' | 'warning' | 'ghost'; onClick: () => void }[] = [];

    if (canRecep && truck.status === 'en_espera') {
      actions.push({ label: 'Mover a en curso', onClick: () => handleMove(truck.id, 'en_curso') });
      actions.push({
        label: 'Marcar retraso',
        tone: 'warning',
        onClick: () =>
          handleDelay(truck.id, truck.notes ?? 'Retraso priorizado'),
      });
    }
    if (canRecep && truck.status === 'en_curso') {
      actions.push({ label: 'Marcar recepcionado', tone: 'success', onClick: () => handleMove(truck.id, 'recepcionado') });
    }
    if (canRecep && truck.status === 'recepcionado') {
      actions.push({ label: 'Marcar almacenado', tone: 'success', onClick: () => handleMove(truck.id, 'almacenado') });
      actions.push({ label: 'Reabrir en curso', tone: 'ghost', onClick: () => handleMove(truck.id, 'en_curso') });
    }
    if (canRecep && truck.status === 'almacenado') {
      actions.push({ label: 'Cerrar viaje', onClick: () => handleMove(truck.id, 'cerrado') });
    }
    if (canRecep && truck.status === 'cerrado') {
      actions.push({ label: 'Reabrir', tone: 'ghost', onClick: () => handleMove(truck.id, 'recepcionado') });
    }
    // quick next/prev for recepcion/admin
    if (canRecep) {
      const n = nextStatus(truck.status);
      const p = prevStatus(truck.status);
      if (n) actions.push({ label: 'Siguiente etapa', onClick: () => handleMove(truck.id, n) });
      if (p) actions.push({ label: 'Retroceder', tone: 'ghost', onClick: () => handleMove(truck.id, p) });
    }
    if (role === 'admin') {
      actions.push({
        label: 'Eliminar',
        tone: 'warning',
        onClick: async () => {
          const ok = window.confirm('Eliminar camion? Esta accion no se puede deshacer.');
          if (!ok) return;
          await deleteTruck(truck.id);
        },
      });
    }
    return actions;
  };

  return (
    <div className="relative space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-sky-500/10 via-fuchsia-500/10 to-emerald-500/10 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_25%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.1),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.1),transparent_25%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Panel principal</p>
            <h2 className="text-2xl font-bold text-white">
              Operaciones en vivo - {selectedDock === 'recepcion' ? 'Recepcion' : 'Despacho'}
            </h2>
            <p className="text-sm text-slate-200">
              Vista integral de camiones, andenes y retrasos en tiempo real.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              <span className="rounded-full bg-white/10 px-3 py-1">
                {now.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'short' })}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              {weather && (
                <span className="rounded-full bg-white/10 px-3 py-1">
                  Stgo: {weather.temp.toFixed(0)} C | Viento {weather.wind.toFixed(0)} km/h | {weather.description}
                </span>
              )}
              {loadingWeather && <span className="rounded-full bg-white/10 px-3 py-1">Cargando clima...</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Camiones totales</p>
              <p className="text-3xl font-semibold text-white">{filtered.length}</p>
              <p className="text-xs text-slate-300">Vista filtrada</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Andenes ocupados</p>
              <p className="text-3xl font-semibold text-white">
                {dockSummary.filter((d) => d.occupied).length} / 9
              </p>
              <p className="text-xs text-slate-300">Tiempo real</p>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 animate-pulse rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute left-10 bottom-0 h-40 w-40 animate-pulse rounded-full bg-emerald-400/15 blur-3xl" />
      </div>

      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
        <div className="inline-flex rounded-full border border-white/10 bg-surface-panel/70 p-1 text-sm shadow-sm shadow-accent/10">
          {(['recepcion', 'despacho'] as DockType[]).map((dock) => (
            <button
              key={dock}
              onClick={() => setSelectedDock(dock)}
              className={`rounded-full px-4 py-2 transition ${
                selectedDock === dock
                  ? 'bg-accent text-slate-900 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {dock === 'recepcion' ? 'Recepcion' : 'Despacho'}
            </button>
          ))}
        </div>

        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, patente, conductor o anden"
              className="w-full rounded-full border border-white/10 bg-surface-panel px-4 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {role && role !== 'comercial' && role !== 'gerencia' && (
              <button
                onClick={() => setViewOnly((prev) => !prev)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  viewOnly
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-accent/40 bg-accent/90 text-slate-900'
                }`}
              >
                {viewOnly ? 'Salir de solo vista' : 'Modo solo vista'}
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => {
                  setEditingTruck(null);
                  setFormOpen(true);
                }}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-accent/30 hover:brightness-110"
              >
                + Nuevo camion
              </button>
            )}
            {role === 'comercial' && (
              <span className="text-xs text-slate-400">Rol comercial/gerencia: solo lectura</span>
            )}
          </div>
        </div>
      </div>

      {(listenerError || actionError) && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {listenerError ?? actionError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <InfoBadge label="Hora local" value={now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
        <InfoBadge label="En espera" value={`${stats.en_espera}`} />
        <InfoBadge label="En curso" value={`${stats.en_curso}`} />
        <InfoBadge label="Recepcionado" value={`${stats.recepcionado}`} />
        <InfoBadge label="Almacenado" value={`${stats.almacenado}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DelaysPanel delayed={delays} delayedCount={delays.length} />
        <GridAndenes summary={dockSummary} />
        <AgendaPanel items={agenda} />
      </div>

      {loading ? (
        <div className="glass flex min-h-[300px] items-center justify-center rounded-2xl border border-white/10 text-slate-300">
          Cargando camiones...
        </div>
      ) : (
        <LayoutGroup>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {columnOrder.map((statusKey) => {
              const list = grouped[statusKey] ?? [];
              const colorClass = statusColor(statusKey);
              return (
                <div key={statusKey} className={`space-y-3 rounded-3xl border px-4 py-3 shadow-panel ${colorClass}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-200">
                        {statusLabels[statusKey as keyof typeof statusLabels]}
                      </p>
                      <p className="text-2xl font-semibold text-white">{list.length}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs ${statusChip[statusKey as keyof typeof statusChip]}`}>
                      {statusLabels[statusKey as keyof typeof statusLabels]}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {list.map((truck) => (
                        <TruckCard
                          key={truck.id}
                          truck={truck}
                          role={role}
                          readOnly={readOnly}
                          actions={buildActions(truck)}
                        />
                      ))}
                    </AnimatePresence>

                    {list.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-200">
                        Sin camiones en esta columna.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </LayoutGroup>
      )}

      <HistoryToday items={todayHist} />

      {formOpen && (
        <TruckForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          initialTruck={editingTruck}
        />
      )}
    </div>
  );
};

const InfoBadge = ({ label, value }: { label: string; value: string }) => (
  <div className="glass flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="text-base font-semibold text-white">{value}</p>
  </div>
);

const GridAndenes = ({
  summary,
}: {
  summary: Array<{ dock: string; count: number; waiting: number; occupied: boolean }>;
}) => {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Andenes (1-9)</p>
        <p className="text-xs text-slate-400">Ocupacion por anden</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {summary.map((dock) => (
          <motion.div
            key={dock.dock}
            layout
            className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">#{dock.dock}</span>
              <span className="text-xs text-slate-400">{dock.count} cam.</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  dock.occupied
                    ? 'bg-rose-400 shadow-[0_0_0_4px_rgba(248,113,113,0.25)]'
                    : 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]'
                }`}
                aria-label="estado anden"
              />
              <p className="text-xs text-slate-400">
                {dock.occupied ? 'Ocupado' : 'Libre'} - Espera: {dock.waiting}
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-amber-400/70 transition-all"
                style={{
                  width: `${Math.min(100, (dock.waiting / Math.max(1, dock.count || 1)) * 100)}%`,
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DelaysPanel = ({
  delayed,
  delayedCount,
}: {
  delayed: Truck[];
  delayedCount: number;
}) => {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Retrasos (+30m)</p>
        <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100">
          {delayedCount} en retraso
        </span>
      </div>
      <div className="space-y-2">
        {delayed.length === 0 && (
          <p className="text-sm text-slate-400">Sin retrasos en esta vista.</p>
        )}
        {delayed.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="flex items-start justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2"
          >
            <div>
              <p className="text-white font-semibold">{t.clientName}</p>
              <p className="text-xs text-slate-400">
                {t.plate} - Anden {t.dockNumber}
              </p>
              {t.notes && <p className="mt-1 text-xs text-rose-200">{t.notes}</p>}
            </div>
            <div className="text-right text-xs text-slate-300">
              <p>{formatDurationSince(t.checkInTime)} en espera</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const AgendaPanel = ({ items }: { items: Truck[] }) => (
  <div className="glass rounded-2xl border border-white/10 p-4">
    <div className="mb-2 flex items-center justify-between">
      <p className="text-sm font-semibold text-white">Agenda y llegadas</p>
      <p className="text-xs text-slate-400">{items.length} proximos</p>
    </div>
    <div className="space-y-2 max-h-64 overflow-auto pr-1">
      {items.length === 0 && <p className="text-sm text-slate-400">Sin camiones agendados.</p>}
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm"
        >
          <div className="space-y-0.5">
            <p className="text-white">{item.clientName}</p>
            <p className="text-xs text-slate-400">
              {item.plate} - Anden {item.dockNumber}
            </p>
          </div>
          <div className="text-right text-xs text-slate-300">
            <p>{item.scheduledArrival?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-1 ${statusChip[item.status as keyof typeof statusChip]}`}>
              {statusLabels[item.status as keyof typeof statusLabels]}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const HistoryToday = ({ items }: { items: Truck[] }) => (
  <div className="glass rounded-2xl border border-white/10 p-4">
    <div className="mb-2 flex items-center justify-between">
      <p className="text-sm font-semibold text-white">Historial de hoy</p>
      <p className="text-xs text-slate-400">{items.length} ingresos</p>
    </div>
    <div className="space-y-2 max-h-64 overflow-auto pr-1">
      {items.length === 0 && <p className="text-sm text-slate-400">Sin ingresos registrados hoy.</p>}
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm"
        >
          <div className="space-y-0.5">
            <p className="text-white">{item.clientName}</p>
            <p className="text-xs text-slate-400">
              {item.plate} - Anden {item.dockNumber}
            </p>
          </div>
          <div className="text-right text-xs text-slate-300">
            <p>{formatDurationSince(item.checkInTime ?? item.createdAt)} atras</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-1 ${statusChip[item.status as keyof typeof statusChip]}`}>
              {statusLabels[item.status as keyof typeof statusLabels]}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);
