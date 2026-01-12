import { useEffect, useMemo, useState } from 'react';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck, TruckStatus } from '../types';
import { TruckCard } from './TruckCard';

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

const formatSelectedDay = (value: string) => {
  const parsed = parseInputDate(value);
  if (!parsed) return 'Todos los dias';
  return parsed.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export const HistoryView = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [statusFilter, setStatusFilter] = useState<TruckStatus | 'todos'>('todos');
  const [selectedDay, setSelectedDay] = useState(() => toInputDate(new Date()));

  useEffect(() => {
    const unsub = subscribeAllTrucks(setTrucks);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const start = parseInputDate(selectedDay);
    const end = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) : null;

    return trucks
      .filter((t) => {
        if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
        if (!start || !end) return true;
        const created = t.createdAt ?? t.scheduledArrival;
        if (!created) return false;
        return created >= start && created < end;
      })
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }, [trucks, statusFilter, selectedDay]);

  const stats = useMemo(() => {
    const enPorteria = filtered.filter((t) => t.status === 'en_porteria').length;
    const enEspera = filtered.filter((t) => t.status === 'en_espera').length;
    const enCurso = filtered.filter((t) => t.status === 'en_curso').length;
    return {
      total: filtered.length,
      enPorteria,
      enEspera,
      enCurso,
    };
  }, [filtered]);

  const emptyMessage = selectedDay
    ? 'No hay registros para el dia seleccionado.'
    : 'No hay registros para el filtro seleccionado.';

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Historico diario</p>
            <h2 className="text-2xl font-semibold text-white">Bitacora por dia</h2>
            <p className="text-sm text-slate-300">
              Selecciona un dia en el calendario para ver los registros.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-300">
              Dia
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="mt-1 rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDay(toInputDate(new Date()))}
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100 hover:bg-white/15"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setSelectedDay('')}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Ver todos
            </button>
            <label className="text-sm text-slate-300">
              Estado
              <select
                className="mt-1 rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="todos">Todos</option>
                <option value="agendado">Agendado</option>
                <option value="en_porteria">Porteria</option>
                <option value="en_espera">En espera</option>
                <option value="en_curso">En curso</option>
                <option value="recepcionado">Recepcionado</option>
                <option value="almacenado">Almacenado</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Mostrando: {formatSelectedDay(selectedDay)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Total: {stats.total}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Porteria: {stats.enPorteria}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            Espera: {stats.enEspera}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
            En curso: {stats.enCurso}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <TruckCard key={t.id} truck={t} role="gerencia" readOnly />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-200">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
};
