import { useEffect, useMemo, useState } from 'react';
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
    <div className="min-h-screen space-y-6 bg-[#0a1024] px-3 pb-10 pt-4 text-white">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <div className="rounded-3xl border border-[#1a3762] bg-[#0c1c3a] px-6 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-40 rounded-lg border border-[#1a3762] bg-[#0b142e] p-2">
                <img src="/friosan-logo.png" alt="Friosan" className="h-full w-full object-contain" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-[0.18em] text-[#f2c744]">
                Bitacora de camiones
              </h1>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg tracking-[0.22em] text-[#f2c744]">
                {formatDate(now)}, {formatHour(now)}
              </p>
              <p className="text-xs text-slate-200">Ultima actualizacion: {formatHour(now)}</p>
            </div>
          </div>
        </div>

        {listenerError && (
          <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {listenerError}
          </div>
        )}

        <div className="rounded-2xl border border-[#1a3762] bg-[#0f2248] px-4 py-3 shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#f2c744]">Tablero visor</p>
              <p className="text-base">Estado general de camiones</p>
              <p className="text-xs text-slate-300">
                Filtros: {filterDock === 'todos' ? 'Recepcion + Despacho' : filterDock === 'recepcion' ? 'Solo recepcion' : 'Solo despacho'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              <span className="rounded-full border border-[#f2c744]/40 bg-[#13264b] px-3 py-1">Total: {stats.total}</span>
              <span className="rounded-full border border-[#f2c744]/40 bg-[#13264b] px-3 py-1">Porteria: {stats.enPorteria}</span>
              <span className="rounded-full border border-[#f2c744]/40 bg-[#13264b] px-3 py-1">Espera: {stats.enEspera}</span>
              <span className="rounded-full border border-[#f2c744]/40 bg-[#13264b] px-3 py-1">En curso: {stats.enCurso}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-[#f2c744]/50 bg-[#13264b] p-1 text-sm">
              {(['todos', 'recepcion', 'despacho'] as Array<'todos' | DockType>).map((dock) => (
                <button
                  key={dock}
                  onClick={() => setFilterDock(dock)}
                  className={`rounded-full px-4 py-2 transition ${
                    filterDock === dock ? 'bg-[#f2c744] text-[#0b142e] font-semibold' : 'text-slate-100 hover:text-white'
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
              className="flex-1 min-w-[260px] rounded-full border border-[#f2c744]/30 bg-[#0b142e] px-4 py-2 text-sm text-white outline-none focus:border-[#f2c744] focus:ring-2 focus:ring-[#f2c744]/40"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-[#1a3762] bg-[#0c1c3a] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="grid min-w-[1250px] grid-cols-[130px,220px,140px,120px,140px,120px,150px,150px,110px,110px] border-b border-[#1a3762] bg-[#0b234a] text-[12px] font-semibold uppercase tracking-[0.18em] text-[#f2c744]">
            <div className="border-r border-[#1a3762] px-3 py-3">Patente</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Nombre empresa</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Fec. bitacora</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Hora bitacora</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Fec. ingreso</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Hora ingreso</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Estado</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Proceso</div>
            <div className="border-r border-[#1a3762] px-3 py-3">Anden</div>
            <div className="px-3 py-3">Tiempo</div>
          </div>

          {boardRows.map((truck, idx) => {
            const bitacoraDate = formatDate(truck.scheduledArrival ?? null);
            const bitacoraHour = formatHour(truck.scheduledArrival ?? null);
            const ingresoDate = formatDate(truck.checkInGateAt ?? truck.checkInTime ?? null);
            const ingresoHour = formatHour(truck.checkInGateAt ?? truck.checkInTime ?? null);
            const elapsed = formatElapsed(truck.checkInTime ?? truck.checkInGateAt, now);
            const process = typeDisplay(truck);
            const gate = truck.dockNumber ? gateFromTruck(truck) : 'N/A';

            const stateClass =
              truck.status === 'en_curso'
                ? 'bg-[#2196f3]'
                : truck.status === 'en_espera' || truck.status === 'en_porteria'
                  ? 'bg-[#e74c3c]'
                  : ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(truck.status)
                    ? 'bg-[#1abc9c]'
                    : 'bg-[#f39c12]';

            const processClass =
              (truck.loadType ?? 'carga') === 'carga'
                ? 'bg-[#3498db]'
                : (truck.loadType ?? 'descarga') === 'descarga'
                  ? 'bg-[#e74c3c]'
                  : 'bg-[#9b59b6]';

            return (
              <div
                key={truck.id}
                className={`grid min-w-[1250px] grid-cols-[130px,220px,140px,120px,140px,120px,150px,150px,110px,110px] border-b border-[#1a3762] ${
                  idx % 2 === 0 ? 'bg-[#0c2b52]' : 'bg-[#0a2748]'
                }`}
              >
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#f2c744]">
                  {truck.plate ? truck.plate.toUpperCase() : 'N/A'}
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm font-semibold text-white">
                  <p className="leading-tight break-words">{truck.clientName || 'Sin cliente'}</p>
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm text-white whitespace-nowrap">
                  {bitacoraDate}
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm text-white whitespace-nowrap">
                  {bitacoraHour}
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm text-white whitespace-nowrap">
                  {ingresoDate}
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm text-white whitespace-nowrap">
                  {ingresoHour}
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3">
                  <span className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white ${stateClass}`}>
                    {statusLabel[truck.status]}
                  </span>
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm text-white">
                  <span className={`inline-flex rounded-md px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white ${processClass}`}>
                    {process}
                  </span>
                </div>
                <div className="border-r border-[#1a3762] px-3 py-3 text-sm font-semibold text-purple-200 whitespace-nowrap">
                  {gate}
                </div>
                <div className="px-3 py-3 text-sm font-mono font-semibold text-[#f2c744] whitespace-nowrap">
                  {elapsed}
                </div>
              </div>
            );
          })}

          {boardRows.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-slate-200">
              No hay camiones activos para mostrar en el tablero.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
