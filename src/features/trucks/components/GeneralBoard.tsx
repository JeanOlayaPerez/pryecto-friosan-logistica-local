import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { fetchAllTrucksOnce, subscribeAllTrucks, updateTruckStatus } from '../services/trucksApi';
import { auth } from '../../../shared/config/firebase';
import type { DockType, Truck, TruckStatus } from '../types';
import { minutesBetween } from '../../../shared/utils/time';
import { useAuth } from '../../auth/AuthProvider';

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

const TIME_ZONE = 'America/Santiago';

const formatHour = (value?: Date | null) => {
  if (!value) return '--:--';
  try {
    return new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TIME_ZONE,
    }).format(value);
  } catch {
    return '--:--';
  }
};

const formatDate = (value?: Date | null) => {
  if (!value) return '--';
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: TIME_ZONE,
    }).format(value);
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

const normalizeDockNumber = (value: Truck['dockNumber']) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = Number(raw.replace(/[^\d]/g, ''));
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 1 || numeric > 9) return null;
  return numeric;
};

const gateFromTruck = (t: Truck) => {
  const dock = normalizeDockNumber(t.dockNumber);
  return dock ? `${dock}` : 'N/A';
};

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
  'grid table-grid min-w-[1780px] grid-cols-[130px,210px,170px,170px,170px,170px,250px,290px,110px,110px]';

const tvColumns = [
  { label: 'Patente', width: '8%' },
  { label: 'Nombre empresa', width: '16%' },
  { label: 'Fec. bitacora', width: '10%' },
  { label: 'Hora bitacora', width: '8%' },
  { label: 'Fec. ingreso', width: '10%' },
  { label: 'Hora ingreso', width: '8%' },
  { label: 'Estado', width: '12%' },
  { label: 'Proceso', width: '14%' },
  { label: 'Anden', width: '7%' },
  { label: 'Tiempo', width: '7%' },
];

const statusTone = (status: TruckStatus) => {
  if (status === 'en_curso') return '#2f66cf';
  if (status === 'en_espera' || status === 'en_porteria') return '#c05a36';
  if (['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(status)) return '#2d8e6f';
  return '#caa83f';
};

const processTone = (loadType?: Truck['loadType']) => {
  if (loadType === 'descarga') return '#c05a36';
  if (loadType === 'mixto') return '#5c4ea8';
  return '#2f66cf';
};

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className ?? 'h-4 w-4'}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const isCarryoverTruck = (truck: Truck, dayStart: Date) => {
  if (!dayStart) return false;
  if (truck.status === 'cerrado' || truck.status === 'terminado') return false;
  const arrival = truck.checkInTime ?? truck.checkInGateAt;
  if (!arrival) return false;
  return arrival < dayStart;
};

const TableHeader = ({ projector, compact = false }: { projector?: boolean; compact?: boolean }) => {
  const headerText = projector ? 'text-xl' : compact ? 'text-base' : 'text-lg';
  const headerPadding = projector ? 'py-4' : compact ? 'py-2.5' : 'py-3';
  const headerTracking = compact ? 'tracking-[0.08em]' : 'tracking-[0.1em]';

  return (
    <div className={`${tableGrid} border-b border-[#2f2f34] bg-[#1f1f23] ${headerText} ${headerTracking} font-semibold uppercase text-[#e6cf6a] whitespace-nowrap`}>
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
  selected,
  onToggleSelect,
  carryover = false,
  compact = false,
}: {
  truck: Truck;
  idx: number;
  now: Date;
  projector?: boolean;
  selected?: boolean;
  onToggleSelect?: (truck: Truck) => void;
  carryover?: boolean;
  compact?: boolean;
}) => {
  const bitacoraDate = formatDate(truck.scheduledArrival ?? null);
  const bitacoraHour = formatHour(truck.scheduledArrival ?? null);
  const ingresoDate = formatDate(truck.checkInGateAt ?? truck.checkInTime ?? null);
  const ingresoHour = formatHour(truck.checkInGateAt ?? truck.checkInTime ?? null);
  const elapsed = formatElapsed(truck.checkInTime ?? truck.checkInGateAt, now);
  const process = typeDisplay(truck);
  const gate = truck.dockNumber ? gateFromTruck(truck) : 'N/A';
  const rowText = projector ? 'text-2xl' : compact ? 'text-lg' : 'text-xl';
  const rowPadding = projector ? 'py-4' : compact ? 'py-2.5' : 'py-3';
  const rowTracking = compact ? 'tracking-[0.08em]' : 'tracking-[0.1em]';
  const rowTextClass = `${rowText} ${rowTracking} font-semibold uppercase`;
  const badgeText = rowText;
  const badgePadding = projector ? 'px-5 py-2.5' : 'px-5 py-2';
  const showSelect = !projector && Boolean(onToggleSelect);
  const statusBadgeWidth = showSelect ? 'w-[12.5rem]' : 'w-[13.5rem]';
  const carryoverRowClass = carryover ? 'border-l-4 border-l-rose-500/90' : '';
  const priorityBadgeClass = projector
    ? 'mt-1 inline-flex items-center gap-2 rounded-full border border-rose-300/70 bg-rose-500/25 px-4 py-1.5 text-sm font-black uppercase tracking-[0.24em] text-rose-100 shadow-[0_0_0_1px_rgba(244,63,94,0.28)]'
    : 'mt-1 inline-flex items-center gap-1.5 rounded-full border border-rose-300/70 bg-rose-500/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-rose-100 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]';
  const priorityIconClass = projector ? 'h-4 w-4' : 'h-3.5 w-3.5';

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
      className={`${tableGrid} border-b border-[#2f2f34] ${carryoverRowClass} ${idx % 2 === 0 ? 'bg-[#2c3f98]' : 'bg-[#202024]'} ${selected ? 'ring-2 ring-[#e6cf6a]/60' : ''}`}
    >
      <div className={`border-r border-[#2f2f34] px-4 ${rowPadding} ${rowTextClass} text-[#e6cf6a]`}>
        <div>{truck.plate ? truck.plate.toUpperCase() : 'N/A'}</div>
        {carryover && (
          <div className={priorityBadgeClass}>
            <ClockIcon className={priorityIconClass} />
            <span>Prioridad / Ayer</span>
          </div>
        )}
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
        <div className="flex items-center gap-2">
          {showSelect && (
            <input
              type="checkbox"
              checked={Boolean(selected)}
              onChange={() => onToggleSelect?.(truck)}
              className="h-4 w-4"
              style={{ accentColor: '#e6cf6a' }}
              aria-label={`Seleccionar camion ${truck.plate || truck.clientName}`}
            />
          )}
          <span
            className={`inline-flex ${statusBadgeWidth} items-center justify-center rounded-md ${badgePadding} ${badgeText} font-semibold uppercase tracking-[0.1em] text-[#e9dda1] whitespace-nowrap ${stateClass}`}
          >
            {statusLabel[truck.status]}
          </span>
        </div>
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
      <div className={`px-4 ${rowPadding} ${rowTextClass} text-[#e6cf6a] whitespace-nowrap`}>{elapsed}</div>
    </motion.div>
  );
};

const TvTable = ({
  rows,
  now,
  emptyMessage,
  projector = false,
  onExitProjector,
  selectedSet,
  onToggleSelect,
  carryoverCutoff,
}: {
  rows: Truck[];
  now: Date;
  emptyMessage: string;
  projector?: boolean;
  onExitProjector?: () => void;
  selectedSet?: Set<string>;
  onToggleSelect?: (truck: Truck) => void;
  carryoverCutoff?: Date | null;
}) => {
  const showSelect = !projector && Boolean(onToggleSelect) && Boolean(selectedSet);

  return (
    <div className={`tv-table-wrap ${projector ? 'tv-table-wrap--projector' : ''}`}>
      {projector && onExitProjector && (
        <button type="button" onClick={onExitProjector} className="tv-projector-exit">
          Salir proyeccion
        </button>
      )}
      <table className={`tv-table ${projector ? 'tv-table--projector' : ''}`}>
        <colgroup>
          {tvColumns.map((col) => (
            <col key={col.label} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {tvColumns.map((col) => (
              <th key={col.label}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={tvColumns.length} className="tv-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((truck, idx) => {
              const bitacoraDate = formatDate(truck.scheduledArrival ?? null);
              const bitacoraHour = formatHour(truck.scheduledArrival ?? null);
              const ingresoDate = formatDate(truck.checkInGateAt ?? truck.checkInTime ?? null);
              const ingresoHour = formatHour(truck.checkInGateAt ?? truck.checkInTime ?? null);
              const elapsed = formatElapsed(truck.checkInTime ?? truck.checkInGateAt, now);
              const process = typeDisplay(truck);
              const gate = truck.dockNumber ? gateFromTruck(truck) : 'N/A';
              const rowClass = idx % 2 === 0 ? 'tv-row-even' : 'tv-row-odd';
              const isSelected = Boolean(selectedSet?.has(truck.id));
              const isCarryover = Boolean(carryoverCutoff && isCarryoverTruck(truck, carryoverCutoff));
              const carryoverRowClass = isCarryover ? 'tv-row-carryover' : '';

              return (
                <tr key={truck.id} className={`${rowClass} ${carryoverRowClass}`}>
                  <td className={`tv-cell ${isCarryover ? 'tv-cell-carryover' : ''}`}>
                    {truck.plate ? truck.plate.toUpperCase() : 'N/A'}
                    {isCarryover && (
                      <div className="tv-badge-carryover">
                        <ClockIcon className="tv-badge-carryover-icon" />
                        <span>Prioridad / Ayer</span>
                      </div>
                    )}
                  </td>
                  <td className="tv-cell tv-cell-wrap">{truck.clientName || 'Sin cliente'}</td>
                  <td className="tv-cell">{bitacoraDate}</td>
                  <td className="tv-cell">{bitacoraHour}</td>
                  <td className="tv-cell">{ingresoDate}</td>
                  <td className="tv-cell">{ingresoHour}</td>
                <td className="tv-cell">
                  <span className="tv-badge" style={{ backgroundColor: statusTone(truck.status) }}>
                    {statusLabel[truck.status]}
                  </span>
                  {showSelect && (
                    <label className="mt-2 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#ded293]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(truck)}
                          className="h-4 w-4"
                          style={{ accentColor: '#e6cf6a' }}
                          aria-label={`Seleccionar camion ${truck.plate || truck.clientName}`}
                        />
                        Lote
                      </label>
                    )}
                </td>
                  <td className="tv-cell">
                    <span className="tv-badge" style={{ backgroundColor: processTone(truck.loadType) }}>
                      {process}
                    </span>
                  </td>
                  <td className="tv-cell">{gate}</td>
                  <td className="tv-cell">{elapsed}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

type GeneralBoardProps = {
  forceCompat?: boolean;
};

export const GeneralBoard = ({ forceCompat = false }: GeneralBoardProps = {}) => {
  const { user, role } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [filterDock, setFilterDock] = useState<'todos' | DockType>('todos');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [shiftIndex, setShiftIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDay, setHistoryDay] = useState(() => toInputDate(new Date()));
  const [projectorMode, setProjectorMode] = useState(false);
  const [isCompat, setIsCompat] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('compat-tv');
  });
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagItems, setDiagItems] = useState<
    Array<{ label: string; value: string; status: 'ok' | 'warn' | 'fail' | 'info' }>
  >([]);
  const [lastFetchSource, setLastFetchSource] = useState<string | null>(null);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const fetchInFlight = useRef(false);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const tableContentRef = useRef<HTMLDivElement | null>(null);
  const [tableScale, setTableScale] = useState(1);
  const [tableScaledSize, setTableScaledSize] = useState({ width: 0, height: 0 });
  const compatEnabled = forceCompat || isCompat;
  const todayKey = useMemo(() => toInputDate(now), [now]);
  const todayStart = useMemo(() => parseInputDate(todayKey) ?? startOfDay(new Date()), [todayKey]);
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
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setIsCompat(document.documentElement.classList.contains('compat-tv'));
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
    let unsub: (() => void) | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let watchdogId: ReturnType<typeof setInterval> | null = null;
    let active = true;

    const markUpdate = (data: Truck[], nextSource: string, nextError?: string | null) => {
      if (!active) return;
      setTrucks(data);
      setLastFetchSource(nextSource);
      setLastFetchError(nextError ?? null);
      setDataLoaded(true);
      lastUpdateRef.current = Date.now();
    };

    const loadOnce = async () => {
      if (fetchInFlight.current) return;
      fetchInFlight.current = true;
      try {
        const result = await fetchAllTrucksOnce({ preferLite: compatEnabled, preferApi: compatEnabled });
        if (!active) return;
        setListenerError(null);
        markUpdate(result.data, `fetch-${result.source}`, result.error ?? null);
      } catch (err) {
        if (!active) return;
        console.error(err);
        setListenerError('No se pudieron cargar los camiones (permisos o red).');
        setLastFetchError(err instanceof Error ? err.message : 'Error cargando camiones');
        setDataLoaded(true);
      } finally {
        fetchInFlight.current = false;
      }
    };

    if (compatEnabled) {
      void loadOnce();
      intervalId = setInterval(loadOnce, 15000);
    } else {
      unsub = subscribeAllTrucks(
        (data) => {
          setListenerError(null);
          markUpdate(data, 'listener');
        },
        (err) => {
          console.error(err);
          setListenerError('No se pudieron cargar los camiones (permisos o red).');
          setLastFetchError(err instanceof Error ? err.message : 'Error cargando camiones');
          setDataLoaded(true);
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
      if (intervalId) clearInterval(intervalId);
      if (watchdogId) clearInterval(watchdogId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [compatEnabled]);

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
    const visible = filtered.filter((t) => t.status !== 'cerrado' && t.status !== 'terminado');
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
    return visible
      .slice()
      .sort((a, b) => {
        const aCarryover = isCarryoverTruck(a, todayStart);
        const bCarryover = isCarryoverTruck(b, todayStart);
        if (aCarryover !== bCarryover) return aCarryover ? -1 : 1;
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
  }, [filtered, todayStart]);

  const boardRows = useMemo(
    () => {
      return sortedRows.slice(0, 10);
    },
    [sortedRows],
  );
  const carryoverRows = useMemo(
    () => boardRows.filter((truck) => isCarryoverTruck(truck, todayStart)),
    [boardRows, todayStart],
  );
  const regularRows = useMemo(
    () => boardRows.filter((truck) => !isCarryoverTruck(truck, todayStart)),
    [boardRows, todayStart],
  );
  const displayRows = useMemo(() => {
    if (regularRows.length <= 1) return carryoverRows.concat(regularRows);
    const offset = shiftIndex % regularRows.length;
    const rotated = regularRows.slice(offset).concat(regularRows.slice(0, offset));
    return carryoverRows.concat(rotated);
  }, [carryoverRows, regularRows, shiftIndex]);
  const stats = useMemo(() => {
    const visible = filtered.filter((t) => t.status !== 'cerrado' && t.status !== 'terminado');
    const enPorteria = visible.filter((t) => t.status === 'en_porteria').length;
    const enEspera = visible.filter((t) => t.status === 'en_espera').length;
    const enCurso = visible.filter((t) => t.status === 'en_curso').length;
    const onTime = visible.filter((t) =>
      t.scheduledArrival && t.checkInGateAt
        ? minutesBetween(t.scheduledArrival, t.checkInGateAt) <= 0
        : false,
    ).length;
    return {
      total: visible.length,
      enPorteria,
      enEspera,
      enCurso,
      onTime,
    };
  }, [filtered]);

  const historyRows = useMemo(() => {
    const dayStart = parseInputDate(historyDay);
    if (!dayStart) return [];
    const dayEnd = addDays(dayStart, 1);

    return filtered
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
  }, [filtered, historyDay]);

  const canFinalize =
    Boolean(user) && ['recepcion', 'comercial', 'admin', 'superadmin', 'visor'].includes(role ?? '');

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(
    () => boardRows.filter((truck) => selectedSet.has(truck.id)),
    [boardRows, selectedSet],
  );

  useEffect(() => {
    if (!canFinalize || !selectionMode) {
      setSelectedIds([]);
      return;
    }
    const boardIds = new Set(boardRows.map((truck) => truck.id));
    setSelectedIds((prev) => prev.filter((id) => boardIds.has(id)));
  }, [boardRows, canFinalize, selectionMode]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
  }, []);

  const toggleSelect = useCallback((truck: Truck) => {
    setSelectedIds((prev) =>
      prev.includes(truck.id) ? prev.filter((id) => id !== truck.id) : [...prev, truck.id],
    );
  }, []);

  const selectVisible = useCallback(() => {
    if (!canFinalize) return;
    setSelectedIds(boardRows.map((truck) => truck.id));
  }, [boardRows, canFinalize]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const shiftHistoryWeek = useCallback((delta: number) => {
    setHistoryDay((prev) => {
      const base = parseInputDate(prev) ?? new Date();
      return toInputDate(addDays(base, delta * 7));
    });
  }, []);

  const handleFinalizeSelected = useCallback(async () => {
    if (!user?.id || !canFinalize) return;
    if (selectedRows.length === 0) return;
    const ok = window.confirm(`Finalizar ${selectedRows.length} camiones seleccionados?`);
    if (!ok) return;
    const results = await Promise.allSettled(
      selectedRows.map((truck) => updateTruckStatus(truck.id, 'terminado', { userId: user.id, role })),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    const succeededIds = selectedRows
      .filter((_, idx) => results[idx].status === 'fulfilled')
      .map((truck) => truck.id);
    if (failed) {
      window.alert(`No se pudieron finalizar ${failed} camiones. Revisa permisos o conexion.`);
    }
    setSelectedIds((prev) => prev.filter((id) => !succeededIds.includes(id)));
  }, [canFinalize, role, selectedRows, user]);

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

  const canShowDiagnostics = dataLoaded && trucks.length === 0;

  const runDiagnostics = async () => {
    if (!canShowDiagnostics) return;
    setDiagRunning(true);
    const items: Array<{ label: string; value: string; status: 'ok' | 'warn' | 'fail' | 'info' }> = [];
    const envProject = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
    const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
    const envStorage = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;

    items.push({
      label: 'Conexion',
      value: navigator.onLine ? 'online' : 'offline',
      status: navigator.onLine ? 'ok' : 'fail',
    });
    items.push({
      label: 'URL',
      value: window.location.href,
      status: 'info',
    });
    items.push({
      label: 'Proyecto Firebase',
      value: envProject ?? 'no definido',
      status: envProject ? 'ok' : 'fail',
    });
    items.push({
      label: 'Auth domain',
      value: envAuthDomain ?? 'no definido',
      status: envAuthDomain ? 'ok' : 'fail',
    });
    items.push({
      label: 'Storage bucket',
      value: envStorage ?? 'no definido',
      status: envStorage ? 'info' : 'warn',
    });
    items.push({
      label: 'Hora local',
      value: new Date().toISOString(),
      status: 'info',
    });
    items.push({
      label: 'Compat',
      value: compatEnabled ? 'activo' : 'inactivo',
      status: compatEnabled ? 'info' : 'ok',
    });
    items.push({
      label: 'Sesion',
      value: auth.currentUser
        ? auth.currentUser.isAnonymous
          ? `anon ${auth.currentUser.uid}`
          : auth.currentUser.email ?? auth.currentUser.uid
        : 'sin sesion',
      status: auth.currentUser ? 'ok' : 'fail',
    });
    items.push({
      label: 'Filtro dock',
      value: filterDock,
      status: 'info',
    });
    items.push({
      label: 'Busqueda',
      value: search ? search : 'sin filtro',
      status: search ? 'warn' : 'info',
    });
    items.push({
      label: 'Datos',
      value: `trucks=${trucks.length}, filtrados=${filtered.length}`,
      status: trucks.length > 0 ? 'ok' : 'warn',
    });
    items.push({
      label: 'Listener',
      value: listenerError ?? 'sin error',
      status: listenerError ? 'fail' : 'ok',
    });
    items.push({
      label: 'Fuente datos',
      value: lastFetchSource ?? 'N/A',
      status: 'info',
    });
    if (lastFetchError) {
      items.push({
        label: 'Error fetch',
        value: lastFetchError,
        status: 'warn',
      });
    }
    items.push({
      label: 'User agent',
      value: navigator.userAgent || 'N/A',
      status: 'info',
    });

    const tryFetch = async (url: string) => {
      if (typeof fetch !== 'function') {
        return { ok: false, error: 'fetch no soportado' };
      }
      try {
        await fetch(url, { mode: 'no-cors', cache: 'no-store' });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'error' };
      }
    };

    const gstatic = await tryFetch('https://www.gstatic.com/generate_204');
    items.push({
      label: 'Acceso gstatic',
      value: gstatic.ok ? 'ok' : `fallo (${gstatic.error ?? 'sin detalle'})`,
      status: gstatic.ok ? 'ok' : 'fail',
    });

    const firestorePing = await tryFetch('https://firestore.googleapis.com/');
    items.push({
      label: 'Acceso Firestore',
      value: firestorePing.ok ? 'ok' : `fallo (${firestorePing.error ?? 'sin detalle'})`,
      status: firestorePing.ok ? 'ok' : 'fail',
    });

    setDiagItems(items);
    setDiagOpen(true);
    setDiagRunning(false);
  };

  const diagStatusClass = (status: 'ok' | 'warn' | 'fail' | 'info') => {
    if (status === 'ok') return 'bg-emerald-400';
    if (status === 'warn') return 'bg-amber-400';
    if (status === 'fail') return 'bg-rose-500';
    return 'bg-slate-400';
  };
  const tvDiagStatusClass = (status: 'ok' | 'warn' | 'fail' | 'info') => {
    if (status === 'ok') return 'tv-dot-ok';
    if (status === 'warn') return 'tv-dot-warn';
    if (status === 'fail') return 'tv-dot-fail';
    return 'tv-dot-info';
  };

  const updateTableScale = useCallback(() => {
    if (compatEnabled) {
      setTableScale(1);
      setTableScaledSize({ width: 0, height: 0 });
      return;
    }
    const viewport = tableViewportRef.current;
    const content = tableContentRef.current;
    if (!viewport || !content) return;
    const contentWidth = content.scrollWidth;
    const contentHeight = content.scrollHeight;
    if (!contentWidth || !contentHeight) return;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = projectorMode ? viewport.clientHeight : contentHeight;
    if (!viewportWidth || !viewportHeight) return;
    const scaleWidth = viewportWidth / contentWidth;
    const scaleHeight = viewportHeight / contentHeight;
    const maxScale = projectorMode ? Number.POSITIVE_INFINITY : 1;
    const nextScale = Math.min(scaleWidth, scaleHeight, maxScale);
    setTableScale(nextScale);
    setTableScaledSize({ width: contentWidth * nextScale, height: contentHeight * nextScale });
  }, [projectorMode, compatEnabled]);

  useLayoutEffect(() => {
    updateTableScale();
  }, [updateTableScale, displayRows.length, projectorMode]);

  useEffect(() => {
    window.addEventListener('resize', updateTableScale);
    return () => window.removeEventListener('resize', updateTableScale);
  }, [updateTableScale]);

  if (compatEnabled) {
    return (
      <div className={`tv-board ${projectorMode ? 'tv-board--projector' : ''}`}>
        {!projectorMode && (
          <div className="tv-card tv-header">
            <div className="tv-header-row">
              <div className="tv-header-cell tv-header-left">
                <span className="tv-logo">
                  <img src="/friosan-logo.png" alt="Friosan" />
                </span>
                <span className="tv-title-block">
                  <span className="tv-brand">Friosan SPA</span>
                  <span className="tv-title-row">
                    <span className="tv-title">Bitacora de camiones</span>
                    <button
                      type="button"
                      onClick={() => setProjectorMode(true)}
                      className="tv-button tv-projector-btn"
                    >
                      Proyectar tablero
                    </button>
                  </span>
                </span>
              </div>
              <div className="tv-header-cell tv-header-right">
                <div className="tv-time">
                  {formatDate(now)}, {formatHour(now)}
                </div>
                <div className="tv-update">Ultima actualizacion: {formatHour(now)}</div>
                <div className="tv-status">
                  <span className="tv-dot tv-dot-ok" />
                  Actualizado
                </div>
              </div>
            </div>
          </div>
        )}

        {!projectorMode && listenerError && <div className="tv-alert">{listenerError}</div>}

        {!projectorMode && (
          <div className="tv-card tv-controls">
            <div className="tv-controls-top">
              <div className="tv-controls-left">
                <div className="tv-label">Tablero visor</div>
                <div className="tv-desc">Estado general de camiones</div>
                <div className="tv-muted">
                  Filtros:{' '}
                  {filterDock === 'todos'
                    ? 'Recepcion + Despacho'
                    : filterDock === 'recepcion'
                      ? 'Solo recepcion'
                      : 'Solo despacho'}
                </div>
              </div>
              <div className="tv-controls-right">
                {canFinalize && (
                  <button
                    type="button"
                    onClick={toggleSelectionMode}
                    className="tv-button"
                    style={{ marginRight: '6px' }}
                  >
                    {selectionMode ? 'Cancelar seleccion' : 'Finalizar camiones'}
                  </button>
                )}
                <span className="tv-pill">Total: {stats.total}</span>
                <span className="tv-pill">Porteria: {stats.enPorteria}</span>
                <span className="tv-pill">Espera: {stats.enEspera}</span>
                <span className="tv-pill">En curso: {stats.enCurso}</span>
              </div>
            </div>
            <div className="tv-controls-bottom">
              <div className="tv-filter-group">
                {(['todos', 'recepcion', 'despacho'] as Array<'todos' | DockType>).map((dock) => (
                  <button
                    key={dock}
                    type="button"
                    onClick={() => setFilterDock(dock)}
                    className={`tv-filter-btn ${filterDock === dock ? 'is-active' : ''}`}
                  >
                    {dock === 'todos' ? 'Todos' : dock === 'recepcion' ? 'Recepcion' : 'Despacho'}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, patente, conductor o anden"
                className="tv-search"
              />
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="tv-button"
              >
                {showHistory ? 'Ocultar historico' : 'Ver historico'}
              </button>
            </div>
            {canFinalize && selectionMode && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="tv-pill">Seleccionados: {selectedIds.length}</span>
                <span className="tv-pill">Visibles: {boardRows.length}</span>
                <button
                  type="button"
                  onClick={selectVisible}
                  disabled={boardRows.length === 0}
                  className="tv-button"
                >
                  Seleccionar visibles
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedIds.length === 0}
                  className="tv-button"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeSelected}
                  disabled={selectedIds.length === 0}
                  className="tv-button"
                >
                  Finalizar seleccionados
                </button>
              </div>
            )}
          </div>
        )}

        {!projectorMode && showHistory && (
          <div className="tv-card tv-history">
            <div className="tv-history-header">
              <div className="tv-history-left">
                <div className="tv-label">Historico semanal</div>
                <div className="tv-desc">Registros del panel</div>
                <div className="tv-muted">Selecciona un dia para ver su informacion.</div>
              </div>
              <div className="tv-history-controls">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => shiftHistoryWeek(-1)} className="tv-button">
                    Semana anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryDay(toInputDate(new Date()))}
                    className="tv-button"
                  >
                    Hoy
                  </button>
                  <button type="button" onClick={() => shiftHistoryWeek(1)} className="tv-button">
                    Semana siguiente
                  </button>
                </div>
              </div>
            </div>
            <div className="tv-week-grid grid grid-cols-7">
              {historyWeekDays.map((day) => {
                const key = toInputDate(day);
                const isActive = key === historyDay;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHistoryDay(key)}
                    className={`tv-week-btn ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="tv-week-day">{formatWeekday(day)}</span>
                    <span className="tv-week-date">{day.getDate().toString().padStart(2, '0')}</span>
                    {isToday && <span className="tv-week-dot" />}
                  </button>
                );
              })}
            </div>
            <div className="tv-history-stats">
              <span className="tv-pill">Mostrando: {formatHistoryDay(historyDay)}</span>
              <span className="tv-pill">Total: {historyStats.total}</span>
              <span className="tv-pill">Porteria: {historyStats.enPorteria}</span>
              <span className="tv-pill">Espera: {historyStats.enEspera}</span>
              <span className="tv-pill">En curso: {historyStats.enCurso}</span>
            </div>
            <TvTable
              rows={historyRows}
              now={now}
              emptyMessage="No hay registros para el dia seleccionado."
            />
          </div>
        )}

        <TvTable
          rows={displayRows}
          now={now}
          projector={projectorMode}
          onExitProjector={projectorMode ? () => setProjectorMode(false) : undefined}
          emptyMessage="No hay camiones activos para mostrar en el tablero."
          selectedSet={selectionMode ? selectedSet : undefined}
          onToggleSelect={selectionMode ? toggleSelect : undefined}
          carryoverCutoff={todayStart}
        />

        {!projectorMode && canShowDiagnostics && (
          <div className="tv-card tv-diagnostics">
            <div className="tv-diagnostics-row">
              <div>
                <div className="tv-label">Diagnostico visor</div>
                <div className="tv-muted">
                  No se recibieron datos del tablero. Ejecuta el diagnostico para revisar red y configuracion.
                </div>
              </div>
              <button
                type="button"
                onClick={runDiagnostics}
                disabled={diagRunning}
                className="tv-button"
              >
                {diagRunning ? 'Diagnosticando...' : diagOpen ? 'Reintentar diagnostico' : 'Ejecutar diagnostico'}
              </button>
            </div>
            {diagOpen && (
              <div className="tv-diagnostics-list">
                {diagItems.map((item) => (
                  <div key={item.label} className="tv-diagnostics-item">
                    <span className={`tv-dot ${tvDiagStatusClass(item.status)}`} />
                    <div className="tv-diagnostics-body">
                      <div className="tv-diagnostics-label">{item.label}</div>
                      <div className="tv-muted">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    );
  }

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
                {canFinalize && (
                  <button
                    type="button"
                    onClick={toggleSelectionMode}
                    className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34]"
                  >
                    {selectionMode ? 'Cancelar seleccion' : 'Finalizar camiones'}
                  </button>
                )}
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
            {canFinalize && selectionMode && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#cdbf86]">
                <span className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1">
                  Seleccionados: {selectedIds.length}
                </span>
                <span className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1">
                  Visibles: {boardRows.length}
                </span>
                <button
                  type="button"
                  onClick={selectVisible}
                  disabled={boardRows.length === 0}
                  className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Seleccionar visibles
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedIds.length === 0}
                  className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeSelected}
                  disabled={selectedIds.length === 0}
                  className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Finalizar seleccionados
                </button>
              </div>
            )}
          </div>
        )}

        {!projectorMode && showHistory && (
          <div className="rounded-2xl border border-[#2f2f34] bg-[#1a1a1d] px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#e6cf6a]">Historico semanal</p>
                <p className="text-sm text-[#cdbf86]">Selecciona un dia para ver los camiones.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#cdbf86]">
                <button
                  type="button"
                  onClick={() => shiftHistoryWeek(-1)}
                  className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34]"
                >
                  Semana anterior
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryDay(toInputDate(new Date()))}
                  className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34]"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => shiftHistoryWeek(1)}
                  className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34]"
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
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition ${
                      isActive
                        ? 'border-[#e6cf6a] bg-[#e6cf6a] text-[#1c1c20]'
                        : 'border-[#2f2f34] bg-[#1c1c20] text-[#e9dda1] hover:bg-[#242428]'
                    }`}
                  >
                    <span
                      className={`text-[10px] uppercase tracking-[0.2em] ${
                        isActive ? 'text-[#1c1c20]/80' : 'text-[#cdbf86]'
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
                          isActive ? 'bg-[#1c1c20]' : 'bg-emerald-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#cdbf86]">
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
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#2f2f34] bg-[#121217]">
              <div className="max-h-[38vh] overflow-auto">
                <div className="sticky top-0 z-10">
                  <TableHeader compact />
                </div>
                <LayoutGroup>
                  {historyRows.map((truck, idx) => (
                    <TableRow key={truck.id} truck={truck} idx={idx} now={now} compact />
                  ))}
                </LayoutGroup>
                {historyRows.length === 0 && (
                  <div className="flex h-24 items-center justify-center text-sm text-[#cdbf86]">
                    No hay registros para el dia seleccionado.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          ref={tableViewportRef}
          className={`visor-table relative overflow-hidden ${
            projectorMode
              ? 'h-screen rounded-none border-0 bg-[#1a1a1d] shadow-none'
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
          <div
            style={
              tableScaledSize.width
                ? { width: tableScaledSize.width, height: tableScaledSize.height }
                : undefined
            }
          >
            <div
              ref={tableContentRef}
              className="inline-block"
              style={{ transform: `scale(${tableScale})`, transformOrigin: 'top left' }}
            >
              <TableHeader projector={projectorMode} />

              <LayoutGroup>
                {displayRows.map((truck, idx) => (
                  <TableRow
                    key={truck.id}
                    truck={truck}
                    idx={idx}
                    now={now}
                    projector={projectorMode}
                    selected={selectionMode && selectedSet.has(truck.id)}
                    onToggleSelect={selectionMode ? toggleSelect : undefined}
                    carryover={isCarryoverTruck(truck, todayStart)}
                  />
                ))}
              </LayoutGroup>

              {displayRows.length === 0 && (
                <div className="flex h-32 items-center justify-center text-sm text-[#cdbf86]">
                  No hay camiones activos para mostrar en el tablero.
                </div>
              )}
            </div>
          </div>
        </div>

        {canShowDiagnostics && (
          <div className="rounded-2xl border border-[#2f2f34] bg-[#1a1a1d] px-5 py-4 shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#e6cf6a]">Diagnostico visor</p>
                <p className="text-sm text-[#cdbf86]">
                  No se recibieron datos del tablero. Ejecuta el diagnostico para revisar red y configuracion.
                </p>
              </div>
              <button
                type="button"
                onClick={runDiagnostics}
                disabled={diagRunning}
                className="rounded-full border border-[#e6cf6a]/40 bg-[#242428] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#ded293] hover:bg-[#2f2f34] disabled:opacity-60"
              >
                {diagRunning ? 'Diagnosticando...' : diagOpen ? 'Reintentar diagnostico' : 'Ejecutar diagnostico'}
              </button>
            </div>
            {diagOpen && (
              <div className="mt-3 grid gap-2">
                {diagItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-xl border border-[#2f2f34] bg-[#1c1c20] px-3 py-2 text-xs"
                  >
                    <span className={`mt-1 h-2 w-2 rounded-full ${diagStatusClass(item.status)}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#e9dda1]">{item.label}</p>
                      <p className="break-words text-[#cdbf86]">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};











