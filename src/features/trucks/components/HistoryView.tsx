import { useEffect, useMemo, useState } from 'react';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck, TruckStatus } from '../types';
import { TruckCard } from './TruckCard';

export const HistoryView = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [statusFilter, setStatusFilter] = useState<TruckStatus | 'todos'>('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const unsub = subscribeAllTrucks(setTrucks);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    return trucks
      .filter((t) => {
        if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
        if (!fromDate && !toDate) return true;
        const created = t.createdAt ?? t.scheduledArrival;
        if (!created) return false;
        if (fromDate && created < fromDate) return false;
        if (toDate && created > toDate) return false;
        return true;
      })
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }, [trucks, statusFilter, from, to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Historico</p>
          <h2 className="text-2xl font-semibold text-white">Trazabilidad completa</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <label className="text-sm text-slate-300">
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-sm text-slate-300">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <TruckCard key={t.id} truck={t} role="gerencia" readOnly />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-200">
            No hay registros para el filtro seleccionado.
          </div>
        )}
      </div>
    </div>
  );
};
