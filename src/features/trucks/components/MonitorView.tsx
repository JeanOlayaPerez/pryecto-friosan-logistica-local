import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { subscribeTrucksByDockType } from '../services/trucksApi';
import type { DockType, Truck } from '../types';
import { TruckCard } from './TruckCard';
import { useAuth } from '../../auth/AuthProvider';

const statusOrder: Array<'en_espera' | 'en_curso' | 'terminado'> = [
  'en_espera',
  'en_curso',
  'terminado',
];

const statusLabel = {
  en_espera: 'En espera',
  en_curso: 'En curso',
  terminado: 'Terminado',
};

const useDockTrucks = (dock: DockType) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);

  useEffect(() => {
    const unsub = subscribeTrucksByDockType(dock, setTrucks);
    return () => {
      unsub();
    };
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
        { en_espera: 0, en_curso: 0, terminado: 0 } as Record<
          (typeof statusOrder)[number],
          number
        >,
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
          {dock === 'recepcion' ? 'Recepción' : 'Despacho'}
        </h3>
        <div className="flex gap-2 text-xs text-slate-400">
          {statusOrder.map((status) => (
            <div key={status} className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
              <span className="text-slate-200">{statusLabel[status]}</span>
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
        <SummaryCard
          title="Recepción en espera"
          value={counts.recepcion.en_espera}
        />
        <SummaryCard
          title="Recepción en curso"
          value={counts.recepcion.en_curso}
        />
        <SummaryCard
          title="Recepción terminados"
          value={counts.recepcion.terminado}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Despacho en espera" value={counts.despacho.en_espera} />
        <SummaryCard title="Despacho en curso" value={counts.despacho.en_curso} />
        <SummaryCard title="Despacho terminados" value={counts.despacho.terminado} />
      </div>

      {board('recepcion', recepcionTrucks)}
      {board('despacho', despachoTrucks)}
    </div>
  );
};
