import { useEffect, useMemo, useState } from 'react';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck, TruckStatus } from '../types';
import { TruckCard } from './TruckCard';
import { formatDurationSince, minutesBetween } from '../../../shared/utils/time';

const formatHour = (d?: Date | null) => {
  if (!d) return '--:--';
  try {
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
};

const formatDate = (d?: Date | null) => {
  if (!d) return '--';
  try {
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '--';
  }
};

const metricCard = (title: string, value: string, desc?: string) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{title}</p>
    <p className="text-3xl font-semibold text-slate-900">{value}</p>
    {desc && <p className="text-sm text-slate-500">{desc}</p>}
  </div>
);

export const ManagerDashboard = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const unsub = subscribeAllTrucks(setTrucks);
    return () => unsub();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
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
    const nowValue = new Date();
    const sameDay = (d?: Date | null) =>
      d &&
      d.getFullYear() === nowValue.getFullYear() &&
      d.getMonth() === nowValue.getMonth() &&
      d.getDate() === nowValue.getDate();
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
    <div className="min-h-screen space-y-6 bg-gradient-to-b from-slate-100 via-slate-50 to-sky-50 px-3 pb-10 pt-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="flex items-center justify-between bg-sky-700 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 overflow-hidden rounded-md bg-white/10">
                <img src="/friosan-logo.png" alt="Friosan" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-sky-100">Friosan SPA</p>
                <p className="text-lg font-semibold">Panel de gerencia</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono tracking-wide">{formatDate(now)}</p>
              <p className="font-mono tracking-wide">{formatHour(now)}</p>
            </div>
          </div>
          <div className="bg-white px-5 py-3 text-sm text-slate-700">
            KPIs y línea de tiempo consolidada. Rol: gerencia (solo lectura).
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {metricCard('Total camiones', String(metrics.total))}
          {metricCard('En curso / espera', String(metrics.inCourse))}
          {metricCard('Espera promedio', `${metrics.avgWait} min`)}
          {metricCard('A tiempo', `${metrics.onTimePct}%`, 'Ingreso vs hora agendada')}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Retrasos</h3>
              <span className="text-xs text-slate-500">{delays.length} detectados</span>
            </div>
            <div className="space-y-2">
              {delays.length === 0 && <p className="text-sm text-slate-500">Sin retrasos hoy.</p>}
              {delays.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{t.clientName}</span>
                    <span className="text-xs text-rose-500">{formatDurationSince(t.checkInTime)} en espera</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {t.plate} - Anden {t.dockNumber} - {t.delayReason || t.notes || 'Retraso registrado'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Agenda próxima</h3>
              <span className="text-xs text-slate-500">{agenda.length} items</span>
            </div>
            <div className="space-y-2">
              {agenda.length === 0 && <p className="text-sm text-slate-500">Sin camiones agendados.</p>}
              {agenda.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{t.clientName}</span>
                    <span className="text-xs text-slate-600">
                      {t.scheduledArrival?.toLocaleString('es-CL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {t.plate} - {t.loadType ?? 'carga'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Línea de tiempo (hoy)</h3>
            <span className="text-xs text-slate-500">{timeline.length} eventos</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {timeline.map((t) => (
              <TruckCard key={t.id} truck={t} role="gerencia" readOnly />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
