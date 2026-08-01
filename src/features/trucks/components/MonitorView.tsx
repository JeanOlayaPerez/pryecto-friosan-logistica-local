import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { fetchAllTrucksOnce, subscribeAllTrucks, updateTruckStatus } from '../services/trucksApi';
import { auth } from '../../../shared/config/firebase';
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

const toInputDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseInputDate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addDays = (value: Date, amount: number) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate() + amount);

const getWeekStart = (value: Date) => {
  const day = value.getDay();
  const diff = (day + 6) % 7;
  return addDays(value, -diff);
};

const formatWeekday = (value: Date) =>
  value
    .toLocaleDateString('es-CL', { weekday: 'short' })
    .replace('.', '')
    .toUpperCase();

const formatTime = (value: Date | null) => {
  if (!value) return '--:--';
  return value.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatDate = (value: Date | null) => {
  if (!value) return '--';
  return value.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatHistoryDay = (value: string) => {
  const parsed = parseInputDate(value);
  if (!parsed) return 'Todos los dias';
  return parsed.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const isCarryoverTruck = (truck: Truck, dayStart: Date) => {
  if (!dayStart) return false;
  if (truck.status === 'cerrado' || truck.status === 'terminado') return false;
  const arrival = truck.checkInTime ?? truck.checkInGateAt;
  if (!arrival) return false;
  return arrival < dayStart;
};

const truckTime = (truck: Truck) =>
  truck.checkInTime ?? truck.checkInGateAt ?? truck.scheduledArrival ?? truck.createdAt ?? null;

const sortTrucks = (list: Truck[], dayStart: Date) =>
  list.slice().sort((a, b) => {
    const aCarryover = isCarryoverTruck(a, dayStart);
    const bCarryover = isCarryoverTruck(b, dayStart);
    if (aCarryover !== bCarryover) return aCarryover ? -1 : 1;
    const aTime = truckTime(a)?.getTime() ?? 0;
    const bTime = truckTime(b)?.getTime() ?? 0;
    return aTime - bTime;
  });

const useMonitorTrucks = (apiOnly: boolean) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const fetchInFlight = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
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
        const result = await fetchAllTrucksOnce({ preferApi: true, preferLite: true, apiOnly });
        markUpdate(result.data, `fetch-${result.source}`, result.error ?? null);
      } catch (err) {
        console.error('Error cargando camiones para monitor', err);
        setErrorOnly(err instanceof Error ? err.message : 'Error cargando camiones');
      } finally {
        fetchInFlight.current = false;
      }
    };

    if (apiOnly) {
      void loadOnce();
      pollId = setInterval(loadOnce, 15000);
    } else {
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
    }

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
      if (pollId) clearInterval(pollId);
      if (watchdogId) clearInterval(watchdogId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [apiOnly]);

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
  const apiOnly = auth.currentUser?.isAnonymous === true;
  const { trucks, lastUpdatedAt, source, error } = useMonitorTrucks(apiOnly);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [historyDay, setHistoryDay] = useState(() => toInputDate(new Date()));
  const [now, setNow] = useState(() => new Date());
  const todayKey = useMemo(() => toInputDate(now), [now]);
  const todayStart = useMemo(() => parseInputDate(todayKey) ?? startOfDay(new Date()), [todayKey]);
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
  const activeRecepcionSorted = useMemo(
    () => sortTrucks(activeRecepcionTrucks, todayStart),
    [activeRecepcionTrucks, todayStart],
  );
  const activeDespachoSorted = useMemo(
    () => sortTrucks(activeDespachoTrucks, todayStart),
    [activeDespachoTrucks, todayStart],
  );
  const activeTrucks = useMemo(
    () => [...activeRecepcionSorted, ...activeDespachoSorted],
    [activeRecepcionSorted, activeDespachoSorted],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canFinalize =
    Boolean(user) &&
    auth.currentUser?.isAnonymous === false &&
    ['recepcion', 'comercial', 'admin', 'superadmin', 'visor'].includes(role ?? '');
  const selectedHistoryDate = useMemo(
    () => parseInputDate(historyDay) ?? startOfDay(new Date()),
    [historyDay],
  );
  const historyWeekStart = useMemo(() => getWeekStart(selectedHistoryDate), [selectedHistoryDate]);
  const historyWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDays(historyWeekStart, idx)),
    [historyWeekStart],
  );

  useEffect(() => {
    if (!canFinalize || !selectionMode) {
      setSelectedIds([]);
      return;
    }
    const activeIds = new Set(activeTrucks.map((truck) => truck.id));
    setSelectedIds((prev) => prev.filter((id) => activeIds.has(id)));
  }, [activeTrucks, canFinalize, selectionMode]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

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

  const historyRows = useMemo(() => {
    const dayStart = parseInputDate(historyDay);
    if (!dayStart) return [];
    const dayEnd = addDays(dayStart, 1);
    return trucks
      .filter((t) => {
        const stamp = t.checkInGateAt ?? t.checkInTime ?? t.createdAt ?? t.scheduledArrival;
        if (!stamp) return false;
        return stamp >= dayStart && stamp < dayEnd;
      })
      .sort((a, b) => {
        const aDate = a.checkInGateAt ?? a.checkInTime ?? a.createdAt ?? a.scheduledArrival;
        const bDate = b.checkInGateAt ?? b.checkInTime ?? b.createdAt ?? b.scheduledArrival;
        return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
      });
  }, [historyDay, trucks]);

  const historyStats = useMemo(() => {
    const enPorteria = historyRows.filter((t) => t.status === 'en_porteria').length;
    const enEspera = historyRows.filter((t) => t.status === 'en_espera').length;
    const enCurso = historyRows.filter((t) => t.status === 'en_curso').length;
    return {
      total: historyRows.length,
      enPorteria,
      enEspera,
      enCurso,
    };
  }, [historyRows]);

  const toggleSelect = (truckId: string) => {
    setSelectedIds((prev) =>
      prev.includes(truckId) ? prev.filter((id) => id !== truckId) : [...prev, truckId],
    );
  };

  const selectAll = () => {
    if (!canFinalize) return;
    setSelectedIds(activeTrucks.map((truck) => truck.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds([]);
      }
      return !prev;
    });
  };

  const shiftHistoryWeek = (delta: number) => {
    setHistoryDay((prev) => {
      const base = parseInputDate(prev) ?? new Date();
      return toInputDate(addDays(base, delta * 7));
    });
  };

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

  const handleFinalizeSelected = async () => {
    if (!user?.id || !canFinalize) return;
    const targets = activeTrucks.filter(
      (truck) =>
        selectedSet.has(truck.id) && truck.status !== 'cerrado' && truck.status !== 'terminado',
    );
    if (targets.length === 0) return;
    const ok = window.confirm(`Finalizar ${targets.length} camiones seleccionados?`);
    if (!ok) return;
    const results = await Promise.allSettled(
      targets.map((truck) => updateTruckStatus(truck.id, 'terminado', { userId: user.id, role })),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    const succeededIds = targets
      .filter((_, idx) => results[idx].status === 'fulfilled')
      .map((truck) => truck.id);
    if (failed) {
      window.alert(`No se pudieron finalizar ${failed} camiones. Revisa permisos o conexion.`);
    }
    setSelectedIds((prev) => prev.filter((id) => !succeededIds.includes(id)));
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
                    selectable={canFinalize && selectionMode}
                    selected={selectionMode && selectedSet.has(truck.id)}
                    onToggleSelect={selectionMode ? () => toggleSelect(truck.id) : undefined}
                    priority={isCarryoverTruck(truck, todayStart)}
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400">Fuente: {source ?? '--'}</span>
          {canFinalize && (
            <button
              type="button"
              onClick={toggleSelectionMode}
              className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200 hover:bg-amber-400/20"
            >
              {selectionMode ? 'Cancelar seleccion' : 'Finalizar camiones'}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 shadow-panel">
          {error}
        </div>
      )}
      {canFinalize && selectionMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 shadow-panel">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Lote</span>
            <span className="text-white">Seleccionados: {selectedIds.length}</span>
            <span className="text-slate-400">Visibles: {activeTrucks.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={activeTrucks.length === 0}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={handleFinalizeSelected}
              disabled={selectedIds.length === 0}
              className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Finalizar seleccionados
            </button>
          </div>
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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Historico semanal</p>
            <p className="text-sm text-slate-200">Selecciona un dia para ver los camiones.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => shiftHistoryWeek(-1)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:bg-white/15"
            >
              Semana anterior
            </button>
            <button
              type="button"
              onClick={() => setHistoryDay(toInputDate(new Date()))}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:bg-white/15"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => shiftHistoryWeek(1)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:bg-white/15"
            >
              Semana siguiente
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {historyWeekDays.map((day) => {
            const key = toInputDate(day);
            const isActive = key === historyDay;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setHistoryDay(key)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-center transition ${
                  isActive
                    ? 'border-amber-300 bg-amber-300 text-slate-950'
                    : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                }`}
              >
                <span
                  className={`text-[10px] uppercase tracking-[0.2em] ${
                    isActive ? 'text-slate-900/80' : 'text-slate-400'
                  }`}
                >
                  {formatWeekday(day)}
                </span>
                <span className="text-lg font-semibold">
                  {day.getDate().toString().padStart(2, '0')}
                </span>
                {isToday && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? 'bg-slate-900' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Mostrando: {formatHistoryDay(historyDay)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Total: {historyStats.total}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Porteria: {historyStats.enPorteria}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Espera: {historyStats.enEspera}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            En curso: {historyStats.enCurso}
          </span>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[120px,1.2fr,1.2fr,140px,140px] bg-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300">
            <span>Patente</span>
            <span>Cliente</span>
            <span>Empresa</span>
            <span>Fec. bitacora</span>
            <span>Hora bitacora</span>
          </div>
          <div className="max-h-[32vh] overflow-auto">
            {historyRows.map((truck, idx) => {
              const rowClass = idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent';
              const bitacoraDate = formatDate(truck.scheduledArrival ?? null);
              const bitacoraHour = formatTime(truck.scheduledArrival ?? null);
              return (
                <div
                  key={truck.id}
                  className={`grid grid-cols-[120px,1.2fr,1.2fr,140px,140px] px-4 py-2 text-sm text-slate-200 ${rowClass}`}
                >
                  <span className="font-semibold text-white">
                    {truck.plate ? truck.plate.toUpperCase() : 'N/A'}
                  </span>
                  <span className="text-slate-100">{truck.clientName || 'Sin cliente'}</span>
                  <span className="text-slate-300">{truck.companyName || 'Sin empresa'}</span>
                  <span className="text-slate-200">{bitacoraDate}</span>
                  <span className="text-slate-200">{bitacoraHour}</span>
                </div>
              );
            })}
            {historyRows.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No hay registros para el dia seleccionado.
              </div>
            )}
          </div>
        </div>
      </div>

      {board('recepcion', activeRecepcionSorted)}
      {board('despacho', activeDespachoSorted)}
    </div>
  );
};
