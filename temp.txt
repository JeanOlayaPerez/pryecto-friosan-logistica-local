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

      <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_25px_70px_rgba(0,0,0,0.32)] backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Tablero visor</p>
            <p className="text-xl font-semibold text-slate-900">Estado general de camiones</p>
            <p className="text-xs text-slate-500">Filtros: {filterDock === 'todos' ? 'Recepcion + Despacho' : filterDock === 'recepcion' ? 'Solo recepcion' : 'Solo despacho'}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Total: {stats.total}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Porteria: {stats.enPorteria}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Espera: {stats.enEspera}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">En curso: {stats.enCurso}</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-sm shadow-sm">
            {(['todos', 'recepcion', 'despacho'] as Array<'todos' | DockType>).map((dock) => (
              <button
                key={dock}
                onClick={() => setFilterDock(dock)}
                className={`rounded-full px-4 py-2 transition ${
                  filterDock === dock ? 'bg-sky-500 text-white font-semibold' : 'text-slate-700 hover:text-slate-900'
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
            className="flex-1 min-w-[240px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-inner shadow-slate-200/60 backdrop-blur">
          <div className="grid min-w-[1320px] grid-cols-[130px,230px,150px,130px,150px,130px,170px,150px,120px,110px] border-b border-slate-200 bg-slate-100 text-[12px] font-semibold uppercase tracking-[0.15em] text-slate-700">
            <div className="border-r border-slate-200 px-3 py-2.5">Patente</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Nombre empresa</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Fec. bitacora</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Hora bitacora</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Fec. ingreso</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Hora ingreso</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Estado</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Proceso</div>
            <div className="border-r border-slate-200 px-3 py-2.5">Andén</div>
            <div className="px-3 py-2.5">Tiempo</div>
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
                className={`grid min-w-[1320px] grid-cols-[130px,230px,150px,130px,150px,130px,170px,150px,120px,110px] border-b border-slate-200 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
                  {truck.plate ? truck.plate.toUpperCase() : 'N/A'}
                </div>
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900">
                  <p className="leading-tight break-words">{truck.clientName || 'Sin cliente'}</p>
                </div>
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                  {bitacoraDate}
                </div>
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm text-slate-700">{bitacoraHour}</div>
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm text-slate-700">{ingresoDate}</div>
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm text-slate-700">{ingresoHour}</div>
                <div className="border-r border-slate-200 px-3 py-2.5">
                  <span
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${statusChipBg[truck.status]}`}
                  >
                    {statusLabel[truck.status]}
                  </span>
                </div>
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                  <span className="block break-words leading-tight">{process}</span>
                </div>
                <div className="border-r border-slate-200 px-3 py-2.5 text-sm font-semibold text-purple-700">
                  {gate}
                </div>
                <div className="px-3 py-2.5 text-sm font-mono font-semibold text-slate-900">{elapsed}</div>
              </div>
            );
          })}

          {boardRows.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-slate-600">
              No hay camiones activos para mostrar en el tablero.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
