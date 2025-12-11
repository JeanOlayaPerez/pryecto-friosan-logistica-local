import { useEffect, useMemo, useState } from 'react';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck, TruckStatus } from '../types';
import { TruckCard } from './TruckCard';
import { formatDurationSince, minutesBetween } from '../../../shared/utils/time';

const metricCard = (title: string, value: string, desc?: string) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-panel">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
    <p className="text-3xl font-semibold text-white">{value}</p>
    {desc && <p className="text-sm text-slate-400">{desc}</p>}
  </div>
);

export const ManagerDashboard = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);

  useEffect(() => {
    const unsub = subscribeAllTrucks(setTrucks);
    return () => unsub();
  }, []);

  const metrics = useMemo(() => {
    const total = trucks.length;
    const byStatus = trucks.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<TruckStatus, number>,
    );

    const waits = trucks
      .filter((t) => t.checkInGateAt && t.checkInTime)
      .map((t) => minutesBetween(t.checkInGateAt!, t.checkInTime!));
    const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;

    const slas = trucks
      .filter((t) => t.scheduledArrival && t.checkInGateAt)
      .map((t) => minutesBetween(t.scheduledArrival, t.checkInGateAt));
    const onTime = slas.filter((m) => m <= 0).length;
    const onTimePct = slas.length ? Math.round((onTime / slas.length) * 100) : 0;

    const inCourse = (byStatus['en_curso'] ?? 0) + (byStatus['en_espera'] ?? 0);

    return { total, byStatus, avgWait, onTimePct, inCourse };
  }, [trucks]);

  const today = useMemo(() => {
    const now = new Date();
    const sameDay = (d?: Date | null) =>
      d &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return trucks.filter((t) => sameDay(t.createdAt) || sameDay(t.checkInTime));
  }, [trucks]);

  const delays = trucks
    .filter((t) => t.status === 'en_espera' && minutesBetween(t.checkInTime) >= 30)
    .slice(0, 5);

  const agenda = trucks
    .filter((t) => t.status === 'agendado' || t.status === 'en_camino')
    .sort((a, b) => (a.scheduledArrival?.getTime() ?? 0) - (b.scheduledArrival?.getTime() ?? 0))
    .slice(0, 6);

  const timeline = today
    .slice()
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {metricCard('Total camiones', String(metrics.total))}
        {metricCard('En curso / espera', String(metrics.inCourse))}
        {metricCard('Espera promedio', `${metrics.avgWait} min`)}
        {metricCard('A tiempo', `${metrics.onTimePct}%`, 'Ingreso vs hora agendada')}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Retrasos</h3>
            <span className="text-xs text-slate-400">{delays.length} detectados</span>
          </div>
          <div className="space-y-2">
            {delays.length === 0 && <p className="text-sm text-slate-400">Sin retrasos hoy.</p>}
            {delays.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{t.clientName}</span>
                  <span className="text-xs text-rose-200">{formatDurationSince(t.checkInTime)} en espera</span>
                </div>
                <p className="text-xs text-slate-400">
                  {t.plate} - Anden {t.dockNumber} - {t.delayReason || t.notes || 'Retraso registrado'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Agenda proxima</h3>
            <span className="text-xs text-slate-400">{agenda.length} items</span>
          </div>
          <div className="space-y-2">
            {agenda.length === 0 && <p className="text-sm text-slate-400">Sin camiones agendados.</p>}
            {agenda.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{t.clientName}</span>
                  <span className="text-xs text-slate-300">
                    {t.scheduledArrival?.toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{t.plate} - {t.loadType ?? 'carga'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Linea de tiempo (hoy)</h3>
          <span className="text-xs text-slate-400">{timeline.length} eventos</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {timeline.map((t) => (
            <TruckCard key={t.id} truck={t} role="gerencia" readOnly />
          ))}
        </div>
      </div>
    </div>
  );
};
