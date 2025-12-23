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

const statusChipBg: Record<TruckStatus, string> = {
  agendado: 'bg-sky-500/80 text-sky-50',
  en_camino: 'bg-sky-500/80 text-sky-50',
  en_porteria: 'bg-amber-500/90 text-slate-900',
  en_espera: 'bg-amber-500/90 text-slate-900',
  en_curso: 'bg-blue-500/90 text-white',
  recepcionado: 'bg-emerald-500/90 text-emerald-50',
  almacenado: 'bg-emerald-500/90 text-emerald-50',
  cerrado: 'bg-slate-600/90 text-slate-50',
  terminado: 'bg-emerald-500/90 text-emerald-50',
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

const gateFromTruck = (t: Truck) => `${t.dockType === 'recepcion' ? 'R' : 'D'}-${t.dockNumber}`;

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
    <div className="min-h-screen space-y-6 bg-[#0a1024] px-3 pb-10 pt-2 sm:px-6">
      <div className="rounded-3xl border border-amber-300/30 bg-gradient-to-r from-[#0f1a3a] via-[#0c1430] to-[#0f1a3a] px-6 py-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-black/30 p-3 shadow-inner shadow-slate-900/60">
              <img src="/friosan-logo.png" alt="Friosan" className="h-14 w-auto object-contain" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-100">Friosan SPA</p>
              <p className="text-2xl font-extrabold tracking-wide text-amber-300">Espera de camiones</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono tracking-[0.18em] text-amber-100">
              {formatDate(now)}, {formatHour(now)}
            </p>
            <p className="text-xs text-amber-50/70">Ultima actualizacion: {formatHour(now)}</p>
          </div>
        </div>
      </div>

      {listenerError && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {listenerError}
        </div>
      )}

      <div className="rounded-3xl border border-amber-400/30 bg-[#0f162f] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-amber-200">Tablero visor</p>
            <p className="text-xl font-semibold text-amber-50">Estado general de camiones</p>
            <p className="text-xs text-amber-100/80">Filtros: {filterDock === 'todos' ? 'Recepcion + Despacho' : filterDock === 'recepcion' ? 'Solo recepcion' : 'Solo despacho'}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-amber-100">
            <span className="rounded-full border border-amber-300/40 px-3 py-1">Total: {stats.total}</span>
            <span className="rounded-full border border-amber-300/40 px-3 py-1">Porteria: {stats.enPorteria}</span>
            <span className="rounded-full border border-amber-300/40 px-3 py-1">Espera: {stats.enEspera}</span>
            <span className="rounded-full border border-amber-300/40 px-3 py-1">En curso: {stats.enCurso}</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-amber-400/30 bg-black/30 p-1 text-sm shadow-sm shadow-amber-500/20">
            {(['todos', 'recepcion', 'despacho'] as Array<'todos' | DockType>).map((dock) => (
              <button
                key={dock}
                onClick={() => setFilterDock(dock)}
                className={`rounded-full px-4 py-2 transition ${
                  filterDock === dock ? 'bg-amber-400 text-slate-900 font-semibold' : 'text-amber-100 hover:text-white'
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
            className="flex-1 min-w-[240px] rounded-full border border-amber-400/20 bg-[#0a0f1c] px-4 py-2 text-sm text-amber-50 outline-none focus:border-amber-300/60 focus:ring-2 focus:ring-amber-400/30"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-amber-400/30 bg-[#0d132c] shadow-inner shadow-black/30">
          <div className="grid min-w-[1150px] grid-cols-[120px,220px,140px,120px,140px,120px,140px,140px,110px,100px] border-b border-amber-300/30 bg-[#0f214f] text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-100">
            <div className="border-r border-amber-300/30 px-3 py-3">Patente</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Nombre empresa</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Fec. bitacora</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Hora bitacora</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Fec. ingreso</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Hora ingreso</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Estado</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Proceso</div>
            <div className="border-r border-amber-300/30 px-3 py-3">Puerta</div>
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

            return (
              <div
                key={truck.id}
                className={`grid min-w-[1150px] grid-cols-[120px,220px,140px,120px,140px,120px,140px,140px,110px,100px] border-b border-amber-300/20 ${
                  idx % 2 === 0 ? 'bg-[#0d1b42]' : 'bg-[#0b1738]'
                }`}
              >
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-amber-50">
                  {truck.plate ? truck.plate.toUpperCase() : 'N/A'}
                </div>
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm font-semibold text-amber-50">
                  <p className="leading-tight break-words">{truck.clientName || 'Sin cliente'}</p>
                </div>
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm text-amber-100">
                  {bitacoraDate}
                </div>
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm text-amber-100">{bitacoraHour}</div>
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm text-amber-100">{ingresoDate}</div>
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm text-amber-100">{ingresoHour}</div>
                <div className="border-r border-amber-300/20 px-3 py-3">
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${statusChipBg[truck.status]}`}
                  >
                    {statusLabel[truck.status]}
                  </span>
                </div>
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm text-amber-100">
                  <span className="block break-words leading-tight">{process}</span>
                </div>
                <div className="border-r border-amber-300/20 px-3 py-3 text-sm font-semibold text-purple-200">
                  {gate}
                </div>
                <div className="px-3 py-3 text-sm font-mono font-semibold text-amber-50">{elapsed}</div>
              </div>
            );
          })}

          {boardRows.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-amber-100">
              No hay camiones activos para mostrar en el tablero.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
