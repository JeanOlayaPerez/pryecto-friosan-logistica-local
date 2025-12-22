import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { createTruck, subscribeAllTrucks } from '../services/trucksApi';
import type { DockType, Truck, TruckStatus } from '../types';
import { useAuth } from '../../auth/AuthProvider';

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

const chipStyle: Record<TruckStatus, string> = {
  agendado: 'bg-white/10 text-white border border-white/10',
  en_camino: 'bg-white/10 text-white border border-white/10',
  en_porteria: 'bg-amber-400/15 text-amber-50 border border-amber-300/40',
  en_espera: 'bg-amber-400/15 text-amber-50 border border-amber-300/40',
  en_curso: 'bg-sky-400/15 text-sky-50 border border-sky-300/40',
  recepcionado: 'bg-emerald-400/15 text-emerald-50 border border-emerald-300/40',
  almacenado: 'bg-emerald-400/15 text-emerald-50 border border-emerald-300/40',
  cerrado: 'bg-white/10 text-white border border-white/10',
  terminado: 'bg-emerald-400/15 text-emerald-50 border border-emerald-300/40',
};

const typeDisplay = (t: Truck) => {
  const main = (t.loadType ?? 'carga').toUpperCase();
  const isDone = ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(t.status);
  return isDone ? `${main} / LISTO` : main;
};

const sameDay = (a?: Date | null, b?: Date | null) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export const CommercialView = () => {
  const { role } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [planDate, setPlanDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [createForm, setCreateForm] = useState({
    clientName: '',
    plate: '',
    driverName: '',
    driverRut: '',
    dockType: 'recepcion' as DockType,
    scheduledArrival: '',
    loadType: 'carga',
    notes: '',
  });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const canEdit = role === 'comercial' || role === 'admin' || role === 'superadmin';
  const fallbackHome =
    role === 'porteria' ? '/porteria' : role === 'recepcion' ? '/recepcion' : '/';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = subscribeAllTrucks(
      (data) => {
        setListenerError(null);
        setTrucks(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setListenerError('No se pudieron cargar los camiones (permisos o red).');
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trucks;
    return trucks.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        t.plate.toLowerCase().includes(q) ||
        t.driverName.toLowerCase().includes(q) ||
        `${t.dockNumber}`.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q),
    );
  }, [search, trucks]);

  const mercaderia = useMemo(
    () =>
      filtered
        .filter((t) => t.status !== 'cerrado' && t.status !== 'terminado')
        .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)),
    [filtered],
  );

  const plantilla = useMemo(() => {
    return filtered
      .filter((t) => sameDay(t.scheduledArrival, planDate))
      .sort((a, b) => (a.scheduledArrival?.getTime() ?? 0) - (b.scheduledArrival?.getTime() ?? 0));
  }, [filtered, planDate]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    setCreating(true);
    setCreateMsg(null);
    setCreateError(null);
    try {
      if (!createForm.clientName.trim() || !createForm.plate.trim() || !createForm.driverName.trim()) {
        throw new Error('Completa cliente, patente y conductor.');
      }
      if (!createForm.scheduledArrival) {
        throw new Error('Ingresa una fecha y hora agendada.');
      }
      const scheduled = new Date(createForm.scheduledArrival);
      if (Number.isNaN(scheduled.getTime())) {
        throw new Error('Fecha/hora agendada invalida.');
      }
      await createTruck({
        companyName: createForm.clientName.trim(),
        clientName: createForm.clientName.trim(),
        plate: createForm.plate.trim().toUpperCase(),
        driverName: createForm.driverName.trim(),
        driverRut: createForm.driverRut.trim() || undefined,
        dockType: createForm.dockType,
        dockNumber: '0',
        scheduledArrival: scheduled,
        loadType: createForm.loadType as 'carga' | 'descarga' | 'mixto',
        notes: createForm.notes.trim(),
        initialStatus: 'agendado',
      });
      setCreateMsg('Camion agendado en la plantilla.');
      setCreateForm((prev) => ({
        ...prev,
        plate: '',
        driverName: '',
        driverRut: '',
        notes: '',
      }));
      const d = new Date(scheduled);
      d.setHours(0, 0, 0, 0);
      setPlanDate(d);
    } catch (err: any) {
      setCreateError(err?.message ?? 'No se pudo agendar el camion.');
    } finally {
      setCreating(false);
    }
  };

  if (role === 'porteria') return <Navigate to="/porteria" replace />;
  if (role !== 'comercial' && role !== 'admin' && role !== 'operaciones' && role !== 'superadmin') {
    return <Navigate to={fallbackHome} replace />;
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-sky-500/10 via-fuchsia-500/10 to-emerald-500/10 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_25%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.1),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.1),transparent_25%)]" />
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Panel comercial</p>
            <h2 className="text-2xl font-bold text-white">Mercaderia por andenes</h2>
            <p className="text-sm text-slate-200">
              Visibilidad en vivo de carga/descarga y contenido esperado en los 9 andenes.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              <span className="rounded-full bg-white/10 px-3 py-1">
                {now.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'short' })}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Activos: {mercaderia.length}
              </span>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-3 md:max-w-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, patente, conductor, notas o anden"
              className="w-full rounded-full border border-white/10 bg-surface-panel px-4 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
      </div>
    </div>

    <div className="glass rounded-3xl border border-white/10 p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Plantilla diaria (comercial)</p>
          <h3 className="text-xl font-semibold text-white">Agendar camiones del día</h3>
          <p className="text-sm text-slate-400">
            Ingresa los camiones previstos. Portería luego solo marcará su ingreso y avance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-300">
            Día a mostrar
            <input
              type="date"
              className="mt-1 rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-sm text-white"
              value={planDate.toISOString().slice(0, 10)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!Number.isNaN(d.getTime())) {
                  d.setHours(0, 0, 0, 0);
                  setPlanDate(d);
                }
              }}
            />
          </label>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
            {plantilla.length} camiones agendados
          </span>
        </div>
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleCreate}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-300">
            Cliente
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-white"
              value={createForm.clientName}
              onChange={(e) => setCreateForm({ ...createForm, clientName: e.target.value })}
              required
            />
          </label>
          <label className="text-xs text-slate-300">
            Patente
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-white"
              value={createForm.plate}
              onChange={(e) => setCreateForm({ ...createForm, plate: e.target.value })}
              required
            />
          </label>
          <label className="text-xs text-slate-300">
            Conductor
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-white"
              value={createForm.driverName}
              onChange={(e) => setCreateForm({ ...createForm, driverName: e.target.value })}
              required
            />
          </label>
          <label className="text-xs text-slate-300">
            Rut conductor (opcional)
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-white"
              value={createForm.driverRut}
              onChange={(e) => setCreateForm({ ...createForm, driverRut: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-300">
            Fecha y hora agendada
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-white"
              value={createForm.scheduledArrival}
              onChange={(e) => setCreateForm({ ...createForm, scheduledArrival: e.target.value })}
              required
            />
          </label>
          <label className="text-xs text-slate-300">
            Tipo carga
            <select
              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-white"
              value={createForm.loadType}
              onChange={(e) => setCreateForm({ ...createForm, loadType: e.target.value })}
            >
              <option value="carga">Carga</option>
              <option value="descarga">Descarga</option>
              <option value="mixto">Mixto</option>
            </select>
          </label>
          <label className="text-xs text-slate-300 md:col-span-2 lg:col-span-3">
            Notas (opcional)
            <textarea
              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-3 py-2 text-white"
              rows={2}
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            Estado inicial: <span className="text-white">Agendado</span>. Portería avanzará el flujo.
          </div>
          <div className="flex items-center gap-2">
            {createMsg && <span className="text-xs text-emerald-300">{createMsg}</span>}
            {createError && <span className="text-xs text-rose-300">{createError}</span>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-accent/30 hover:brightness-110 disabled:opacity-60"
            >
              {creating ? 'Guardando...' : 'Agregar a plantilla'}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[140px,140px,1fr,1fr,1fr,0.9fr,1.2fr] bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300">
          <span>Hora agendada</span>
          <span>Patente</span>
          <span>Cliente</span>
          <span>Conductor</span>
          <span>Rut</span>
          <span>Tipo carga</span>
          <span>Estado / Notas</span>
        </div>
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-slate-300">Cargando...</div>
        ) : plantilla.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-300">Sin camiones agendados para este dia.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {plantilla.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[140px,140px,1fr,1fr,1fr,0.9fr,1.2fr] items-center bg-white/5 px-4 py-3 text-sm text-slate-100"
              >
                <span className="font-mono text-amber-100">
                  {t.scheduledArrival
                    ? t.scheduledArrival.toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit' })
                    : '--'}
                </span>
                <span className="font-semibold tracking-[0.2em] text-white">{t.plate}</span>
                <span className="font-semibold text-white">{t.clientName}</span>
                <span className="text-xs text-slate-200">{t.driverName}</span>
                <span className="text-xs text-slate-200">{t.driverRut || '—'}</span>
                <span className="text-xs text-slate-200">{typeDisplay(t)}</span>
                <span className="flex flex-col gap-1 text-xs text-slate-200">
                  <span className={`w-fit rounded-full px-2 py-1 text-[11px] ${chipStyle[t.status]}`}>
                    {statusLabel[t.status]}
                  </span>
                  <span className="text-slate-300 line-clamp-2">{t.notes || '—'}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {listenerError && (
      <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {listenerError}
      </div>
    )}

    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
    <p className="text-slate-100">{value}</p>
  </div>
);
