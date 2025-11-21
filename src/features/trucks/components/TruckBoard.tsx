import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  flagTruckDelay,
  resetTrucks,
  subscribeTrucksByDockType,
  updateTruckStatus,
} from '../services/trucksApi';
import type { DockType, Truck } from '../types';
import { TruckCard } from './TruckCard';
import { TruckForm } from './TruckForm';
import { useAuth } from '../../auth/AuthProvider';
import { formatDurationSince, isDelayed } from '../../../shared/utils/time';

const statusLabels = {
  en_espera: 'En espera',
  en_curso: 'En curso',
  terminado: 'Terminado',
};

const statusChip: Record<keyof typeof statusLabels, string> = {
  en_espera: 'bg-amber-400/10 text-amber-100 border border-amber-400/30',
  en_curso: 'bg-sky-400/10 text-sky-100 border border-sky-400/30',
  terminado: 'bg-emerald-400/10 text-emerald-100 border border-emerald-400/30',
};

const dockNumbers = Array.from({ length: 9 }, (_, i) => `${i + 1}`);

export const TruckBoard = () => {
  const { user, role } = useAuth();
  const [selectedDock, setSelectedDock] = useState<DockType>('recepcion');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [search, setSearch] = useState('');
  const [viewOnly, setViewOnly] = useState(role === 'comercial');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => setViewOnly(role === 'comercial'), [role]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeTrucksByDockType(selectedDock, (data) => {
      setTrucks(data);
      setLoading(false);
    });
    return () => {
      unsub();
    };
  }, [selectedDock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trucks;
    return trucks.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        t.plate.toLowerCase().includes(q) ||
        t.driverName.toLowerCase().includes(q) ||
        `${t.dockNumber}`.toLowerCase().includes(q),
    );
  }, [search, trucks]);

  const grouped = useMemo<Record<'en_espera' | 'en_curso' | 'terminado', Truck[]>>(
    () =>
      filtered.reduce(
        (acc, t) => {
          acc[t.status].push(t);
          return acc;
        },
        { en_espera: [], en_curso: [], terminado: [] } as Record<
          'en_espera' | 'en_curso' | 'terminado',
          Truck[]
        >,
      ),
    [filtered],
  );

  const canManage = (role === 'operaciones' || role === 'admin') && !viewOnly;

  const handleMove = async (
    truckId: string,
    status: 'en_espera' | 'en_curso' | 'terminado',
  ) => {
    if (!user?.id) return;
    await updateTruckStatus(truckId, status, user.id);
  };

  const handleDelay = async (truckId: string, notes: string) => {
    await flagTruckDelay(truckId, notes);
  };

  const stats = {
    total: filtered.length,
    en_espera: grouped.en_espera.length,
    en_curso: grouped.en_curso.length,
    terminado: grouped.terminado.length,
    delayed: filtered.filter(
      (t) => t.status === 'en_espera' && isDelayed(t.checkInTime, 30),
    ).length,
  };

  const todayHist = useMemo(() => {
    const today = new Date();
    const sameDay = (d?: Date | null) =>
      d &&
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return trucks
      .filter((t) => sameDay(t.checkInTime ?? t.createdAt))
      .sort((a, b) => (b.checkInTime?.getTime() ?? 0) - (a.checkInTime?.getTime() ?? 0));
  }, [trucks]);

  const delays = filtered
    .filter((t) => t.status === 'en_espera' && isDelayed(t.checkInTime, 30))
    .slice(0, 4);

  const dockSummary = dockNumbers.map((dock) => {
    const assigned = filtered.filter((t) => `${t.dockNumber}` === dock);
    const occupied = assigned.some((t) => t.status !== 'terminado');
    const waiting = assigned.filter((t) => t.status === 'en_espera').length;
    return { dock, count: assigned.length, waiting, occupied };
  });

  return (
    <div className="relative space-y-6">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
        <div className="inline-flex rounded-full border border-white/10 bg-surface-panel/70 p-1 text-sm shadow-sm shadow-accent/10">
          {(['recepcion', 'despacho'] as DockType[]).map((dock) => (
            <button
              key={dock}
              onClick={() => setSelectedDock(dock)}
              className={`rounded-full px-4 py-2 transition ${
                selectedDock === dock
                  ? 'bg-accent text-slate-900 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {dock === 'recepcion' ? 'Recepcion' : 'Despacho'}
            </button>
          ))}
        </div>

        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, patente, conductor o anden"
              className="w-full rounded-full border border-white/10 bg-surface-panel px-4 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(role === 'operaciones' || role === 'admin') && (
              <button
                onClick={() => setViewOnly((prev) => !prev)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  viewOnly
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-accent/40 bg-accent/90 text-slate-900'
                }`}
              >
                {viewOnly ? 'Salir de solo vista' : 'Modo solo vista'}
              </button>
            )}
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setEditingTruck(null);
                    setFormOpen(true);
                  }}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-accent/30 hover:brightness-110"
                >
                  + Nuevo camion
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm('Esto reinicia los datos locales. Continuar?')) return;
                    resetTrucks();
                    setFormOpen(false);
                    setEditingTruck(null);
                  }}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                >
                  Reset datos locales
                </button>
              </div>
            )}
            {role === 'comercial' && (
              <span className="text-xs text-slate-400">Rol comercial: solo lectura</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <InfoBadge label="Temperaturas camaras (1-9)" value="-18C promedio" />
        <InfoBadge
          label="Hora local"
          value={now.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        />
        <InfoBadge label="Andenes operativos" value="9" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total" value={stats.total} />
        <StatCard title="En espera" value={stats.en_espera} tone="amber" statusOn={stats.en_espera > 0} />
        <StatCard title="En curso" value={stats.en_curso} tone="sky" statusOn={stats.en_curso > 0} />
        <StatCard title="Terminados" value={stats.terminado} tone="emerald" statusOn />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DelaysPanel delayed={delays} delayedCount={stats.delayed} />
        <GridAndenes summary={dockSummary} />
        <HistoryToday items={todayHist} />
      </div>

      {loading ? (
        <div className="glass flex min-h-[300px] items-center justify-center rounded-2xl border border-white/10 text-slate-300">
          Cargando camiones...
        </div>
      ) : (
        <LayoutGroup>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map((statusKey) => {
              const list = grouped[statusKey];
              const colorClass =
                statusKey === 'en_espera'
                  ? 'border-amber-400/40 bg-amber-500/10'
                  : statusKey === 'en_curso'
                    ? 'border-sky-400/40 bg-sky-500/10'
                    : 'border-emerald-400/40 bg-emerald-500/10';
              return (
                <div key={statusKey} className={`space-y-3 rounded-3xl border px-4 py-3 shadow-panel ${colorClass}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-200">
                        {statusLabels[statusKey]}
                      </p>
                      <p className="text-2xl font-semibold text-white">{list.length}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs ${statusChip[statusKey]}`}>
                      Semaforo {statusLabels[statusKey]}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {list.map((truck) => (
                        <TruckCard
                          key={truck.id}
                          truck={truck}
                          role={role}
                          readOnly={viewOnly || role === 'comercial'}
                          onMoveToInProgress={
                            truck.status === 'en_espera'
                              ? () => handleMove(truck.id, 'en_curso')
                              : undefined
                          }
                          onMoveToDone={
                            truck.status === 'en_curso'
                              ? () => handleMove(truck.id, 'terminado')
                              : undefined
                          }
                          onMoveToWaiting={
                            truck.status !== 'en_espera'
                              ? () => handleMove(truck.id, 'en_espera')
                              : undefined
                          }
                          onMoveBackToCourse={
                            truck.status === 'terminado'
                              ? () => handleMove(truck.id, 'en_curso')
                              : undefined
                          }
                          onMarkDelayed={
                            truck.status === 'en_espera'
                              ? () =>
                                  handleDelay(
                                    truck.id,
                                    truck.notes ?? 'Retraso priorizado (control/temperatura)',
                                  )
                              : undefined
                          }
                          onEdit={
                            canManage
                              ? () => {
                                  setEditingTruck(truck);
                                  setFormOpen(true);
                                }
                              : undefined
                          }
                        />
                      ))}
                    </AnimatePresence>

                    {list.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-200">
                        Sin camiones en esta columna.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </LayoutGroup>
      )}

      {formOpen && (
        <TruckForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          initialTruck={editingTruck}
        />
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  tone,
  statusOn,
}: {
  title: string;
  value: number;
  tone?: 'amber' | 'sky' | 'emerald' | 'rose';
  statusOn?: boolean;
}) => {
  const color =
    tone === 'amber'
      ? 'from-amber-500/30 to-amber-400/10 text-amber-50'
      : tone === 'sky'
        ? 'from-sky-500/30 to-sky-400/10 text-sky-50'
        : tone === 'emerald'
          ? 'from-emerald-500/30 to-emerald-400/10 text-emerald-50'
          : tone === 'rose'
            ? 'from-rose-500/30 to-rose-400/10 text-rose-50'
            : 'from-white/10 to-white/5 text-white';
  const dot =
    tone === 'amber'
      ? 'bg-amber-400'
      : tone === 'sky'
        ? 'bg-sky-400'
        : tone === 'emerald'
          ? 'bg-emerald-400'
          : tone === 'rose'
            ? 'bg-rose-400'
            : 'bg-white';

  return (
    <div className={`glass rounded-2xl border border-white/10 bg-gradient-to-br ${color} p-4`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{title}</p>
        {statusOn !== undefined && (
          <span
            className={`h-2.5 w-2.5 rounded-full ${dot} ${
              statusOn ? 'shadow-[0_0_0_4px_rgba(0,0,0,0.05)]' : 'opacity-30'
            }`}
            aria-label="estado"
          />
        )}
      </div>
      <p className="text-3xl font-semibold text-white">{value}</p>
    </div>
  );
};

const InfoBadge = ({ label, value }: { label: string; value: string }) => (
  <div className="glass flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="text-base font-semibold text-white">{value}</p>
  </div>
);

const GridAndenes = ({
  summary,
}: {
  summary: Array<{ dock: string; count: number; waiting: number; occupied: boolean }>;
}) => {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Andenes (1-9)</p>
        <p className="text-xs text-slate-400">Ocupacion por anden</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {summary.map((dock) => (
          <motion.div
            key={dock.dock}
            layout
            className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200"
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">#{dock.dock}</span>
              <span className="text-xs text-slate-400">{dock.count} cam.</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  dock.occupied
                    ? 'bg-rose-400 shadow-[0_0_0_4px_rgba(248,113,113,0.25)]'
                    : 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]'
                }`}
                aria-label="estado anden"
              />
              <p className="text-xs text-slate-400">
                {dock.occupied ? 'Ocupado' : 'Libre'} · Espera: {dock.waiting}
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-amber-400/70 transition-all"
                style={{
                  width: `${Math.min(100, (dock.waiting / Math.max(1, dock.count || 1)) * 100)}%`,
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DelaysPanel = ({
  delayed,
  delayedCount,
}: {
  delayed: Truck[];
  delayedCount: number;
}) => {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Retrasos (+30m)</p>
        <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100">
          {delayedCount} en retraso
        </span>
      </div>
      <div className="space-y-2">
        {delayed.length === 0 && (
          <p className="text-sm text-slate-400">Sin retrasos en esta vista.</p>
        )}
        {delayed.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="flex items-start justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2"
          >
            <div>
              <p className="text-white font-semibold">{t.clientName}</p>
              <p className="text-xs text-slate-400">
                {t.plate} · Anden {t.dockNumber}
              </p>
              {t.notes && <p className="mt-1 text-xs text-rose-200">{t.notes}</p>}
            </div>
            <div className="text-right text-xs text-slate-300">
              <p>{formatDurationSince(t.checkInTime)} en espera</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const HistoryToday = ({ items }: { items: Truck[] }) => (
  <div className="glass rounded-2xl border border-white/10 p-4">
    <div className="mb-2 flex items-center justify-between">
      <p className="text-sm font-semibold text-white">Historial de hoy</p>
      <p className="text-xs text-slate-400">{items.length} ingresos</p>
    </div>
    <div className="space-y-2 max-h-64 overflow-auto pr-1">
      {items.length === 0 && <p className="text-sm text-slate-400">Sin ingresos registrados hoy.</p>}
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm"
        >
          <div className="space-y-0.5">
            <p className="text-white">{item.clientName}</p>
            <p className="text-xs text-slate-400">
              {item.plate} · Anden {item.dockNumber}
            </p>
          </div>
          <div className="text-right text-xs text-slate-300">
            <p>{formatDurationSince(item.checkInTime ?? item.createdAt)} atras</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-1 ${statusChip[item.status]}`}>
              {statusLabels[item.status]}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);
