import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { subscribeTrucksByDockType } from '../services/trucksApi';
import type { DockType, Truck, TruckStatus } from '../types';
import { TruckCard } from './TruckCard';
import { useAuth } from '../../auth/AuthProvider';

const statusOrder: TruckStatus[] = [
  'en_porteria',
  'en_espera',
  'en_curso',
  'recepcionado',
  'almacenado',
  'cerrado',
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

const useDockTrucks = (dock: DockType) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);

  useEffect(() => {
    const unsub = subscribeTrucksByDockType(dock, setTrucks);
    return () => unsub();
  }, [dock]);

  return trucks;
};

const SummaryCard = ({ title, value }: { title: string; value: number }) => (
  <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center shadow-panel">
    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{title}</p>
    <p className="text-4xl font-bold text-white">{value}</p>
  </div>
);

export const MonitorView = () => {
  const { role } = useAuth();
  const recepcionTrucks = useDockTrucks('recepcion');
  const despachoTrucks = useDockTrucks('despacho');

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
                  <TruckCard key={truck.id} truck={truck} role={role} readOnly />
                ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Recepcion en porteria" value={counts.recepcion.en_porteria ?? 0} />
        <SummaryCard title="Recepcion en curso" value={counts.recepcion.en_curso ?? 0} />
        <SummaryCard title="Recepcion finalizado" value={(counts.recepcion.recepcionado ?? 0) + (counts.recepcion.almacenado ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Despacho en porteria" value={counts.despacho.en_porteria ?? 0} />
        <SummaryCard title="Despacho en curso" value={counts.despacho.en_curso ?? 0} />
        <SummaryCard title="Despacho finalizado" value={(counts.despacho.recepcionado ?? 0) + (counts.despacho.almacenado ?? 0)} />
      </div>

      {board('recepcion', recepcionTrucks)}
      {board('despacho', despachoTrucks)}
    </div>
  );
};
