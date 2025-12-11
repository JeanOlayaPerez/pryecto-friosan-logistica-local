import { motion } from 'framer-motion';
import type { Truck, TruckStatus } from '../types';
import { formatDurationSince, isDelayed } from '../../../shared/utils/time';
import type { UserRole } from '../../auth/AuthProvider';

type ActionButton = {
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'ghost';
  onClick: () => void;
  danger?: boolean;
};

type Props = {
  truck: Truck;
  role: UserRole | null;
  actions?: ActionButton[];
  readOnly?: boolean;
};

const formatHour = (value?: unknown) => {
  if (!value) return '--';
  try {
    const date = value instanceof Date ? value : new Date(value as any);
    if (!date || Number.isNaN(date.getTime())) return '--';
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--';
  }
};

const statusMeta: Record<
  TruckStatus,
  { label: string; color: string; chip: string; glow: string }
> = {
  agendado: {
    label: 'Agendado',
    color: 'text-slate-200',
    chip: 'bg-white/10 text-white',
    glow: 'shadow-[0_0_0_3px_rgba(255,255,255,0.15)]',
  },
  en_camino: {
    label: 'En camino',
    color: 'text-slate-200',
    chip: 'bg-white/10 text-white',
    glow: 'shadow-[0_0_0_3px_rgba(255,255,255,0.15)]',
  },
  en_porteria: {
    label: 'En porteria',
    color: 'text-amber-200',
    chip: 'bg-amber-400/15 text-amber-100',
    glow: 'shadow-[0_0_0_3px_rgba(251,191,36,0.18)]',
  },
  en_espera: {
    label: 'En espera',
    color: 'text-amber-200',
    chip: 'bg-amber-400/15 text-amber-100',
    glow: 'shadow-[0_0_0_3px_rgba(251,191,36,0.18)]',
  },
  en_curso: {
    label: 'En curso',
    color: 'text-sky-200',
    chip: 'bg-sky-400/15 text-sky-100',
    glow: 'shadow-[0_0_0_3px_rgba(56,189,248,0.18)]',
  },
  recepcionado: {
    label: 'Recepcionado',
    color: 'text-emerald-200',
    chip: 'bg-emerald-400/15 text-emerald-100',
    glow: 'shadow-[0_0_0_3px_rgba(52,211,153,0.18)]',
  },
  almacenado: {
    label: 'Almacenado',
    color: 'text-emerald-200',
    chip: 'bg-emerald-400/15 text-emerald-100',
    glow: 'shadow-[0_0_0_3px_rgba(52,211,153,0.18)]',
  },
  cerrado: {
    label: 'Cerrado',
    color: 'text-slate-200',
    chip: 'bg-white/10 text-white',
    glow: 'shadow-[0_0_0_3px_rgba(255,255,255,0.15)]',
  },
  terminado: {
    label: 'Terminado',
    color: 'text-emerald-200',
    chip: 'bg-emerald-400/15 text-emerald-100',
    glow: 'shadow-[0_0_0_3px_rgba(52,211,153,0.18)]',
  },
};

const etaText = (truck: Truck) => {
  if (truck.status === 'en_curso') {
    const base = truck.processStartTime ?? truck.checkInTime ?? truck.scheduledArrival;
    const eta = base ? new Date(new Date(base).getTime() + 45 * 60 * 1000) : null;
    return eta ? `ETA ~ ${formatHour(eta)}` : 'En proceso';
  }
  if (truck.status === 'en_espera') return 'Esperando turno';
  if (truck.status === 'en_porteria') return 'En control de porteria';
  if (truck.status === 'recepcionado' || truck.status === 'almacenado' || truck.status === 'cerrado')
    return 'Finalizado';
  return 'Programado';
};

const actionToneClass = (tone?: ActionButton['tone']) => {
  if (tone === 'success') return 'bg-emerald-400/80 text-emerald-950 hover:brightness-110';
  if (tone === 'warning') return 'border border-amber-400/50 bg-amber-400/20 text-amber-50';
  if (tone === 'ghost') return 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10';
  return 'bg-amber-400/80 text-slate-900 hover:brightness-110';
};

export const TruckCard = ({ truck, role, actions = [], readOnly = false }: Props) => {
  const delayed = truck.status === 'en_espera' && isDelayed(truck.checkInTime, 30);
  const badge = statusMeta[truck.status] ?? statusMeta.en_espera;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`glass rounded-2xl border p-4 shadow-panel ${
        delayed ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/5'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${badge.chip} ${badge.glow} border border-white/10`}
              aria-label="status"
            />
            <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${badge.color}`}>
              {badge.label}
            </p>
          </div>
          <h3 className="text-xl font-semibold text-white">{truck.clientName}</h3>
          <div className="flex flex-wrap gap-2 text-sm text-slate-300">
            <span className="rounded-lg bg-white/5 px-3 py-1 font-semibold text-white">
              {truck.plate}
            </span>
            <span className="rounded-lg bg-white/5 px-3 py-1">{truck.driverName}</span>
            <span className="rounded-lg bg-white/5 px-3 py-1">
              {truck.entryType === 'conos' ? 'Conos' : `Anden ${truck.dockNumber}`}
            </span>
            {truck.loadType && (
              <span className="rounded-lg bg-white/5 px-3 py-1 capitalize">{truck.loadType}</span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>Agendado</p>
          <p className="text-sm text-white">{formatHour(truck.scheduledArrival)}</p>
        </div>
      </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
          <Info label="Ingreso porteria" value={formatHour(truck.checkInGateAt)} />
          <Info label="Ingreso anden" value={formatHour(truck.checkInTime)} />
        <Info
          label={truck.status === 'en_curso' ? 'En proceso' : 'Espera'}
          value={
            truck.status === 'en_curso' && truck.processStartTime
              ? formatDurationSince(truck.processStartTime)
              : truck.checkInTime
                ? formatDurationSince(truck.checkInTime)
                : '--'
          }
        />
        <Info label="ETA" value={etaText(truck)} />
        <Info label="Ultima actualizacion" value={formatHour(truck.updatedAt)} />
      </div>

      {truck.notes && (
        <div className="mt-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200">
          {truck.notes}
        </div>
      )}

      {delayed && (
        <p className="mt-2 text-xs font-medium text-rose-300">
          Retraso: {formatDurationSince(truck.checkInTime)}
        </p>
      )}

      {!readOnly && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${actionToneClass(action.tone)}`}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {role && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">
          Rol: {role}
        </p>
      )}
    </motion.div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase text-slate-500">{label}</p>
    <p className="text-slate-100">{value}</p>
  </div>
);
