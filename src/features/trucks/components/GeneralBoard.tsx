import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { DockType, Truck, TruckStatus } from '../types';
import { formatDurationSince, isDelayed, minutesBetween } from '../../../shared/utils/time';

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

const statusTone: Record<TruckStatus, string> = {
  agendado: 'text-slate-100',
  en_camino: 'text-slate-100',
  en_porteria: 'text-amber-100',
  en_espera: 'text-amber-100',
  en_curso: 'text-sky-100',
  recepcionado: 'text-emerald-100',
  almacenado: 'text-emerald-100',
  cerrado: 'text-slate-100',
  terminado: 'text-emerald-100',
};

const formatHour = (value?: Date | null) => {
  if (!value) return '--:--';
  try {
    return value.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

const gateFromTruck = (t: Truck) => `${t.dockType === 'recepcion' ? 'R' : 'D'}-${t.dockNumber}`;

const typeDisplay = (t: Truck) => {
  const main = (t.loadType ?? 'carga').toUpperCase();
  const entry = (t.entryType ?? 'conos').toUpperCase();
  const isDone = ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(t.status);
  const sub = isDone ? 'LISTO' : entry;
  return `${main} / ${sub}`;
};

const remarkFromTruck = (t: Truck) => {
  if (t.status === 'en_curso') {
    return `OPERANDO ${formatDurationSince(t.processStartTime ?? t.checkInTime)}`;
  }
  if (t.status === 'en_espera') {
    return isDelayed(t.checkInTime, 30)
      ? `DELAY +${formatDurationSince(t.checkInTime)}`
      : `EN FILA ${formatDurationSince(t.checkInTime)}`;
  }
  if (t.status === 'en_porteria') return 'CONTROL PORTERIA';
  if (t.status === 'en_camino') return 'EN RUTA';
  if (t.status === 'agendado') return 'AGENDA CONFIRMADA';
  if (t.status === 'recepcionado' || t.status === 'almacenado') return 'DESCARGA COMPLETA';
  if (t.status === 'cerrado' || t.status === 'terminado') return 'CERRADO';
  return t.notes || '---';
};

const BoardHeaderCell = ({ children }: { children: ReactNode }) => (
  <div className="flex h-10 items-center border-r border-amber-400/30 bg-[#1e293b] px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100 last:border-r-0">
    {children}
  </div>
);

const BoardCell = ({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`relative flex h-12 items-center whitespace-normal border-r border-amber-400/15 px-3 text-sm font-mono uppercase tracking-[0.18em] text-amber-50 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-amber-400/20 first:border-l ${className ?? ''}`}
    style={style}
  >
    <span className="block w-full pr-1 leading-tight">{children}</span>
  </div>
);

const GRID_TEMPLATE = 'grid grid-cols-[130px,150px,1.15fr,0.5fr,210px,180px,1.4fr]';

const statusLedClass = (status: TruckStatus) => {
  if (status === 'en_curso') return 'bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.25)]';
  if (status === 'recepcionado' || status === 'almacenado' || status === 'cerrado' || status === 'terminado')
    return 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]';
  return 'bg-rose-400 shadow-[0_0_0_4px_rgba(248,113,113,0.25)]';
};

export const GeneralBoard = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [filterDock, setFilterDock] = useState<'todos' | DockType>('todos');
  const [search, setSearch] = useState('');
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
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
      return (active.length > 0 ? active : sortedRows).slice(0, 14);
    },
    [sortedRows],
  );

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

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-sky-500/5 to-emerald-500/10 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.16),transparent_25%),radial-gradient(circle_at_70%_30%,rgba(56,189,248,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_25%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-100">Panel operativo</p>
            <h2 className="text-2xl font-bold text-white">Tablero en vivo de camiones</h2>
            <div className="flex flex-wrap gap-2 text-xs text-amber-50">
              <span className="rounded-full bg-black/30 px-3 py-1 font-mono tracking-[0.15em]">
                {now.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'short' })}
              </span>
              <span className="rounded-full bg-black/30 px-3 py-1 font-mono tracking-[0.18em]">
                {now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="rounded-full bg-black/30 px-3 py-1 font-semibold">
                {filterDock === 'todos' ? 'Recepcion + Despacho' : filterDock === 'recepcion' ? 'Solo recepcion' : 'Solo despacho'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-amber-300/40 bg-black/30 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Camiones en pantalla</p>
              <p className="text-3xl font-semibold text-white">{stats.total}</p>
              <p className="text-xs text-amber-50/80">Filtro aplicado</p>
            </div>
            <div className="rounded-2xl border border-amber-300/40 bg-black/30 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Retrasos detectados</p>
              <p className="text-3xl font-semibold text-white">
                {filtered.filter((t) => isDelayed(t.checkInTime, 30)).length}
              </p>
              <p className="text-xs text-amber-50/80">+30 min en espera</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/20 bg-[#0d1322]/70 px-4 py-3 shadow-panel">
        <div className="inline-flex rounded-full border border-amber-400/30 bg-black/30 p-1 text-sm shadow-sm shadow-amber-500/20">
          {(['todos', 'recepcion', 'despacho'] as Array<'todos' | DockType>).map((dock) => (
            <button
              key={dock}
              onClick={() => setFilterDock(dock)}
              className={`rounded-full px-4 py-2 transition ${
                filterDock === dock
                  ? 'bg-amber-400 text-slate-900 font-semibold'
                  : 'text-amber-100 hover:text-white'
              }`}
            >
              {dock === 'todos' ? 'Todos' : dock === 'recepcion' ? 'Recepcion' : 'Despacho'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, patente, conductor o anden"
            className="w-full rounded-full border border-amber-400/20 bg-[#0a0f1c] px-4 py-2 text-sm text-amber-50 outline-none focus:border-amber-300/60 focus:ring-2 focus:ring-amber-400/30"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-amber-100">
          <span className="rounded-full bg-black/30 px-3 py-1">Porteria: {stats.enPorteria}</span>
          <span className="rounded-full bg-black/30 px-3 py-1">Espera: {stats.enEspera}</span>
          <span className="rounded-full bg-black/30 px-3 py-1">En curso: {stats.enCurso}</span>
          <span className="rounded-full bg-black/30 px-3 py-1">A tiempo: {stats.onTime}</span>
        </div>
      </div>

      {listenerError && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {listenerError}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-b from-[#0b1220] to-[#0a0f1a] shadow-[0_25px_70px_rgba(0,0,0,0.45)]">
        <div className={`${GRID_TEMPLATE} border-b border-amber-400/40 shadow-[inset_0_-1px_0_rgba(251,191,36,0.3)]`}>
          <BoardHeaderCell>Hora</BoardHeaderCell>
          <BoardHeaderCell>Patente</BoardHeaderCell>
          <BoardHeaderCell>Cliente</BoardHeaderCell>
          <BoardHeaderCell>Anden</BoardHeaderCell>
          <BoardHeaderCell>Tipo</BoardHeaderCell>
          <BoardHeaderCell>Estado</BoardHeaderCell>
          <BoardHeaderCell>Observacion</BoardHeaderCell>
        </div>

        <AnimatePresence initial={false}>
          {boardRows.map((truck, idx) => (
            <motion.div
              key={truck.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={`${GRID_TEMPLATE} border-b border-amber-400/15 ${
                idx % 2 === 0 ? 'bg-[#0c1423]/80' : 'bg-[#111b2c]/80'
              } hover:bg-[#152238]/90`}
            >
              <BoardCell
                className="text-amber-200 overflow-hidden"
                style={{ whiteSpace: 'nowrap' }}
              >
                {formatHour(truck.checkInTime ?? truck.checkInGateAt ?? truck.scheduledArrival)}
              </BoardCell>
              <BoardCell className="text-lg font-semibold tracking-[0.28em] text-white">
                {truck.plate.toUpperCase()}
              </BoardCell>
              <BoardCell className="text-[13px] font-semibold text-white tracking-[0.12em]">
                {truck.clientName}
              </BoardCell>
              <BoardCell className="text-amber-100">
                {gateFromTruck(truck)}
              </BoardCell>
              <BoardCell className="text-[12px] text-amber-100">
                {typeDisplay(truck)}
              </BoardCell>
              <BoardCell className={`text-[12px] font-semibold ${statusTone[truck.status]} flex items-center gap-3 justify-between`}>
                <span className="truncate">{statusLabel[truck.status]}</span>
                <span className={`ml-4 h-2.5 w-2.5 shrink-0 rounded-full border border-white/10 ${statusLedClass(truck.status)}`} />
              </BoardCell>
              <BoardCell className="text-[12px] text-amber-100">
                {remarkFromTruck(truck)}
              </BoardCell>
            </motion.div>
          ))}
        </AnimatePresence>

        {boardRows.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-amber-100">
            No hay camiones activos para mostrar en el tablero.
          </div>
        )}
      </div>
    </div>
  );
};
