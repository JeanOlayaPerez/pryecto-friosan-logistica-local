import { useEffect, useMemo, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { DockType, Truck, TruckStatus } from '../types';
import { minutesBetween } from '../../../shared/utils/time';

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

const formatHour = (value?: Date | null) => {
  if (!value) return '--:--';
  try {
    return value.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
};

const formatDate = (value?: Date | null) => {
  if (!value) return '--';
  try {
    const d = value;
    const day = `${d.getDate()}`.padStart(2, '0');
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '--';
  }
};

const formatElapsed = (start?: Date | null, nowValue?: Date | null) => {
  if (!start || !nowValue) return 'N/A';
  const diff = nowValue.getTime() - start.getTime();
  if (Number.isNaN(diff) || diff < 0) return 'N/A';
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

const gateFromTruck = (t: Truck) => `A-${t.dockNumber ?? '-'}`;

const typeDisplay = (t: Truck) => {
  const main = (t.loadType ?? 'carga').toUpperCase();
  const entry = (t.entryType ?? 'conos').toUpperCase();
  const isDone = ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(t.status);
  const sub = isDone ? 'LISTO' : entry;
  return `${main} / ${sub}`;
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

const tableGrid =
  'grid min-w-[1780px] grid-cols-[130px,210px,170px,170px,170px,170px,250px,290px,110px,110px]';

const TableHeader = ({ projector }: { projector?: boolean }) => {
  const headerText = projector ? 'text-xl' : 'text-lg';
  const headerPadding = projector ? 'py-4' : 'py-3';

  return (
    <div className={`${tableGrid} border-b border-[#2f2f34] bg-[#1f1f23] ${headerText} font-semibold uppercase tracking-[0.1em] text-[#e6cf6a] whitespace-nowrap`}>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Patente</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Nombre empresa</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Fec. bitacora</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Hora bitacora</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Fec. ingreso</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Hora ingreso</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Estado</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Proceso</div>
      <div className={`border-r border-[#2f2f34] px-4 ${headerPadding}`}>Anden</div>
      <div className={`px-4 ${headerPadding}`}>Tiempo</div>
    </div>
  );
};

const TableRow = ({
  truck,
  idx,
  now,
  projector,
}: {
  truck: Truck;
  idx: number;
  now: Date;
  projector?: boolean;
}) => {
  const bitacoraDate = formatDate(truck.scheduledArrival ?? null);
  const bitacoraHour = formatHour(truck.scheduledArrival ?? null);
  const ingresoDate = formatDate(truck.checkInGateAt ?? truck.checkInTime ?? null);
  const ingresoHour = formatHour(truck.checkInGateAt ?? truck.checkInTime ?? null);
  const elapsed = formatElapsed(truck.checkInTime ?? truck.checkInGateAt, now);
  const process = typeDisplay(truck);
  const gate = truck.dockNumber ? gateFromTruck(truck) : 'N/A';
  const rowText = projector ? 'text-2xl' : 'text-xl';
  const rowPadding = projector ? 'py-4' : 'py-3';
  const rowTextClass = `${rowText} font-semibold uppercase tracking-[0.1em]`;
  const badgeText = rowText;
  const badgePadding = projector ? 'px-5 py-2.5' : 'px-5 py-2';

  const stateClass =
    truck.status === 'en_curso'
      ? 'bg-[#2f66cf]'
      : truck.status === 'en_espera' || truck.status === 'en_porteria'
        ? 'bg-[#c05a36]'
        : ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(truck.status)
          ? 'bg-[#2d8e6f]'
          : 'bg-[#caa83f]';

  const processClass =
    (truck.loadType ?? 'carga') === 'carga'
      ? 'bg-[#2f66cf]'
      : (truck.loadType ?? 'descarga') === 'descarga'
        ? 'bg-[#c05a36]'
        : 'bg-[#5c4ea8]';

  return (
    <motion.div
      key={truck.id}
      layout
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className={`${tableGrid} border-b border-[#2f2f34] ${idx % 2 === 0 ? 'bg-[#2c3f98]' : 'bg-[#202024]'}`}
    >
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e6cf6a]`}>
        {truck.plate ? truck.plate.toUpperCase() : 'N/A'}
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e9dda1]`}>
        <p className="leading-tight break-words">{truck.clientName || 'Sin cliente'}</p>
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e9dda1] whitespace-nowrap`}>
        {bitacoraDate}
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e9dda1] whitespace-nowrap`}>
        {bitacoraHour}
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e9dda1] whitespace-nowrap`}>
        {ingresoDate}
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e9dda1] whitespace-nowrap`}>
        {ingresoHour}
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding}`}>
        <span
          className={`inline-flex w-[13.5rem] items-center justify-center rounded-md ${badgePadding} ${badgeText} font-semibold uppercase tracking-[0.1em] text-[#e9dda1] whitespace-nowrap ${stateClass}`}
        >
          {statusLabel[truck.status]}
        </span>
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e9dda1]`}>
        <span
          className={`inline-flex w-[15rem] items-center justify-center rounded-md ${badgePadding} ${badgeText} font-semibold uppercase tracking-[0.1em] text-[#e9dda1] whitespace-nowrap ${processClass}`}
        >
          {process}
        </span>
      </div>
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e6cf6a] whitespace-nowrap`}>
        {gate}
      </div>
      <div className={`px-4 ${rowPadding} ${rowTextClass} text-[#e6cf6a] whitespace-nowrap`}>
        {elapsed}
      </div>
    </motion.div>
  );
};

export const GeneralBoard = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [filterDock, setFilterDock] = useState<'todos' | DockType>('todos');
  const [search, setSearch] = useState('');
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [shiftIndex, setShiftIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDay, setHistoryDay] = useState(() => toInputDate(new Date()));
  const [projectorMode, setProjectorMode] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      setShiftIndex((prev) => prev + 1);
      setRefreshing(true);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setRefreshing(false), 800);
    };
    const intervalId = setInterval(tick, 5000);
    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeAllTrucks(
      (data) => {
        setListenerError(null);
        setTrucks(data);
      },
      (err) => {
        console.error(err);
        setListenerError('No se pudieron cargar los camiones (permisos o red).');
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = filterDock === 'todos' ? trucks : trucks.filter((t) => t.dockType === filterDock);
    if (!q) return base;
    return base.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        t.plate.toLowerCase().includes(q) ||
        t.driverName.toLowerCase().includes(q) ||
        `${t.dockNumber}`.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q),
    );
  }, [filterDock, search, trucks]);

  const sortedRows = useMemo(() => {
    const order: TruckStatus[] = [
      'en_curso',
      'en_espera',
      'en_porteria',
      'en_camino',
      'agendado',
      'recepcionado',
      'almacenado',
      'cerrado',
      'terminado',
    ];
    return filtered
      .slice()
      .sort((a, b) => {
        const aIdx = order.indexOf(a.status);
        const bIdx = order.indexOf(b.status);
        if (aIdx !== bIdx) return aIdx - bIdx;
        const aTime =
          a.checkInTime?.getTime() ??
          a.checkInGateAt?.getTime() ??
          a.scheduledArrival?.getTime() ??
          0;
        const bTime =
          b.checkInTime?.getTime() ??
          b.checkInGateAt?.getTime() ??
          b.scheduledArrival?.getTime() ??
          0;
        return aTime - bTime;
      });
  }, [filtered]);

  const boardRows = useMemo(
    () => {
      const active = sortedRows.filter((t) => t.status !== 'cerrado' && t.status !== 'terminado');
      return (active.length > 0 ? active : sortedRows).slice(0, 10);
    },
    [sortedRows],
  );
  const displayRows = useMemo(() => {
    if (boardRows.length <= 1) return boardRows;
    const offset = shiftIndex % boardRows.length;
    return boardRows.slice(offset).concat(boardRows.slice(0, offset));
  }, [boardRows, shiftIndex]);
  const stats = useMemo(() => {
    const enPorteria = filtered.filter((t) => t.status === 'en_porteria').length;
    const enEspera = filtered.filter((t) => t.status === 'en_espera').length;
    const enCurso = filtered.filter((t) => t.status === 'en_curso').length;
    const onTime = filtered.filter((t) =>
      t.scheduledArrival && t.checkInGateAt
        ? minutesBetween(t.scheduledArrival, t.checkInGateAt) <= 0
        : false,
    ).length;
    return {
      total: filtered.length,
      enPorteria,
      enEspera,
      enCurso,
      onTime,
    };
  }, [filtered]);

  const historyRows = useMemo(() => {
    const dayStart = parseInputDate(historyDay);
    if (!dayStart) return [];
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);

    return filtered
      .filter((t) => {
        const created = t.createdAt ?? t.scheduledArrival;
        if (!created) return false;
        return created >= dayStart && created < dayEnd;
      })
      .sort((a, b) => {
        const aDate = a.createdAt ?? a.scheduledArrival;
        const bDate = b.createdAt ?? b.scheduledArrival;
        return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
      });
  }, [filtered, historyDay]);

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

  return (
    <div
      className={`${projectorMode ? 'min-h-screen bg-[#0f0f12] px-0 pb-0 pt-0' : 'min-h-screen space-y-4 bg-[#0f0f12] px-4 pb-8 pt-3 sm:px-6 sm:pb-8 md:px-[2cm] md:pb-[2cm]'} text-[#e9dda1]`}
    >
      <div className={`${projectorMode ? 'w-full' : 'w-full space-y-3'}`}>
        {!projectorMode && (
          <div className="rounded-2xl border border-[#2f2f34] bg-[#1a1a1d] px-5 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-32 overflow-hidden rounded-lg border border-[#2f2f34] bg-[#1c1c20]">
                  <img src="/friosan-logo.png" alt="Friosan" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-black uppercase tracking-[0.16em] text-[#e6cf6a]">
                    Bitacora de camiones
                  </h1>
                  <button
                    type="button"
                    onClick={() => setProjectorMode(true)}
                    className="rounded-full border border-[#e6cf6a]/50 bg-[#242428] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34]"
                  >
                    Proyectar tablero
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-base tracking-[0.2em] text-[#e6cf6a]">
                  {formatDate(now)}, {formatHour(now)}
                </p>
                <p className="text-xs text-[#cdbf86]">Ultima actualizacion: {formatHour(now)}</p>
                <div className="mt-1 inline-flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.2em] text-[#cdbf86]">
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#e6cf6a]" />
                  </span>
                  <span>Actualizado</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!projectorMode && listenerError && (
          <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {listenerError}
          </div>
        )}

        {!projectorMode && (
          <div className="rounded-2xl border border-[#2f2f34] bg-[#1e1e21] px-4 py-2 shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#cdbf86]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#e6cf6a]">Tablero visor</p>
                <p className="text-sm">Estado general de camiones</p>
                <p className="text-xs text-[#b4a770]">
                  Filtros: {filterDock === 'todos' ? 'Recepcion + Despacho' : filterDock === 'recepcion' ? 'Solo recepcion' : 'Solo despacho'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-[#cdbf86]">
                <span className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-2.5 py-0.5">Total: {stats.total}</span>
                <span className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-2.5 py-0.5">Porteria: {stats.enPorteria}</span>
                <span className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-2.5 py-0.5">Espera: {stats.enEspera}</span>
                <span className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-2.5 py-0.5">En curso: {stats.enCurso}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-[#e6cf6a]/50 bg-[#242428] p-1 text-xs">
                {(['todos', 'recepcion', 'despacho'] as Array<'todos' | DockType>).map((dock) => (
                  <button
                    key={dock}
                    onClick={() => setFilterDock(dock)}
                    className={`rounded-full px-3 py-1.5 transition ${
                      filterDock === dock ? 'bg-[#e6cf6a] text-[#1c1c20] font-semibold' : 'text-[#ded293] hover:text-[#e9dda1]'
                    }`}
                  >
                    {dock === 'todos' ? 'Todos' : dock === 'recepcion' ? 'Recepcion' : 'Despacho'}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, patente, conductor o anden"
                className="flex-1 min-w-[260px] rounded-full border border-[#e6cf6a]/30 bg-[#1c1c20] px-4 py-1.5 text-sm text-[#e9dda1] outline-none focus:border-[#e6cf6a] focus:ring-2 focus:ring-[#e6cf6a]/40"
              />
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-4 py-1.5 text-sm text-[#ded293] hover:bg-[#2f2f34]"
              >
                {showHistory ? 'Ocultar historico' : 'Ver historico'}
              </button>
            </div>
          </div>
        )}

        <div
          className={`visor-table relative overflow-x-auto ${
            projectorMode
              ? 'min-h-screen rounded-none border-0 bg-[#1a1a1d] shadow-none'
              : 'rounded-3xl border border-[#2f2f34] bg-[#1a1a1d] shadow-[0_20px_60px_rgba(0,0,0,0.45)]'
          }`}
        >
          {projectorMode && (
            <button
              type="button"
              onClick={() => setProjectorMode(false)}
              className="absolute right-4 top-3 z-10 rounded-full border border-[#e6cf6a]/50 bg-[#242428]/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#ded293] hover:bg-[#2f2f34]"
            >
              Salir proyeccion
            </button>
          )}
          <div
            className={`pointer-events-none absolute right-4 ${
              projectorMode ? 'top-12' : 'top-3'
            } flex items-center text-[#e6cf6a]/80`}
          >
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              {refreshing && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e6cf6a] opacity-50" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${refreshing ? 'bg-[#e6cf6a]' : 'bg-[#e6cf6a]/60'}`} />
            </span>
          </div>
          <TableHeader projector={projectorMode} />

          <LayoutGroup>
            {displayRows.map((truck, idx) => (
              <TableRow key={truck.id} truck={truck} idx={idx} now={now} projector={projectorMode} />
            ))}
          </LayoutGroup>

          {displayRows.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-[#cdbf86]">
              No hay camiones activos para mostrar en el tablero.
            </div>
          )}
        </div>

        {!projectorMode && showHistory && (
          <div className="rounded-3xl border border-[#2f2f34] bg-[#1a1a1d] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#e6cf6a]">Historico diario</p>
                <p className="text-lg font-semibold text-[#e9dda1]">Registros del panel</p>
                <p className="text-xs text-[#b4a770]">Selecciona un dia para ver su informacion.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#cdbf86]">
                <label className="text-xs text-[#b4a770]">
                  Dia
                  <input
                    type="date"
                    value={historyDay}
                    onChange={(e) => setHistoryDay(e.target.value)}
                    className="mt-1 rounded-lg border border-[#2f2f34] bg-[#1c1c20] px-3 py-2 text-sm text-[#e9dda1]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setHistoryDay(toInputDate(new Date()))}
                  className="rounded-lg border border-[#2f2f34] bg-[#242428] px-3 py-2 text-sm text-[#ded293] hover:bg-[#2f2f34]"
                >
                  Hoy
                </button>
              </div>
            </div>
            <div className="border-t border-[#2f2f34] px-5 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#cdbf86]">
                <span className="rounded-full border border-[#2f2f34] bg-[#242428] px-3 py-1">
                  Mostrando: {formatHistoryDay(historyDay)}
                </span>
                <span className="rounded-full border border-[#2f2f34] bg-[#242428] px-3 py-1">
                  Total: {historyStats.total}
                </span>
                <span className="rounded-full border border-[#2f2f34] bg-[#242428] px-3 py-1">
                  Porteria: {historyStats.enPorteria}
                </span>
                <span className="rounded-full border border-[#2f2f34] bg-[#242428] px-3 py-1">
                  Espera: {historyStats.enEspera}
                </span>
                <span className="rounded-full border border-[#2f2f34] bg-[#242428] px-3 py-1">
                  En curso: {historyStats.enCurso}
                </span>
              </div>
            </div>
            <div className="visor-table relative max-h-[45vh] overflow-auto border-t border-[#2f2f34]">
              <TableHeader />
              <LayoutGroup>
                {historyRows.map((truck, idx) => (
                  <TableRow key={truck.id} truck={truck} idx={idx} now={now} />
                ))}
              </LayoutGroup>
              {historyRows.length === 0 && (
                <div className="flex h-28 items-center justify-center text-sm text-[#cdbf86]">
                  No hay registros para el dia seleccionado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};











