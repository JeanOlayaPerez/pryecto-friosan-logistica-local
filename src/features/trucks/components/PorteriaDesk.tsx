import { useEffect, useMemo, useState } from 'react';
import { createTruck, subscribeAllTrucks, updateTruckStatus } from '../services/trucksApi';
import type { DockType, Truck, TruckStatus } from '../types';
import { useAuth } from '../../auth/AuthProvider';

export const PorteriaDesk = () => {
  const { user, role, logout, loading } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    clientName: '',
    plate: '',
    driverName: '',
    driverRut: '',
    loadType: 'carga' as 'carga' | 'descarga' | 'mixto',
    notes: '',
    dockType: 'recepcion' as DockType,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<'conos' | 'anden'>('conos');
  const [dockNumber, setDockNumber] = useState('');
  const [showAgenda, setShowAgenda] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAllTrucks(setTrucks);
    return () => unsub();
  }, []);

  const todayList = useMemo(() => {
    const today = new Date();
    const sameDay = (d?: Date | null) =>
      d &&
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return trucks
      .filter((t) => sameDay(t.createdAt ?? t.checkInGateAt ?? t.scheduledArrival))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }, [trucks]);

  const agendaList = useMemo(() => {
    return trucks
      .filter((t) => ['agendado', 'en_camino', 'en_porteria', 'en_espera'].includes(t.status))
      .sort((a, b) => (a.scheduledArrival?.getTime() ?? 0) - (b.scheduledArrival?.getTime() ?? 0));
  }, [trucks]);

  const statusLabel: Record<TruckStatus, string> = {
    agendado: 'Agendado',
    en_camino: 'En camino',
    en_porteria: 'En porteria',
    en_espera: 'En espera',
    en_curso: 'En curso',
    recepcionado: 'Recepcionado',
    almacenado: 'Almacenado',
    cerrado: 'Cerrado',
    terminado: 'Terminado',
  };

  const statusChip: Record<TruckStatus, string> = {
    agendado: 'bg-white/10 text-white border border-white/15',
    en_camino: 'bg-white/10 text-white border border-white/15',
    en_porteria: 'bg-amber-400/15 text-amber-100 border border-amber-300/40',
    en_espera: 'bg-amber-400/15 text-amber-100 border border-amber-300/40',
    en_curso: 'bg-sky-400/15 text-sky-100 border border-sky-300/40',
    recepcionado: 'bg-emerald-400/15 text-emerald-100 border border-emerald-300/40',
    almacenado: 'bg-emerald-400/15 text-emerald-100 border border-emerald-300/40',
    cerrado: 'bg-white/10 text-white border border-white/15',
    terminado: 'bg-emerald-400/15 text-emerald-100 border border-emerald-300/40',
  };

  const handleStatus = async (truckId: string, status: TruckStatus) => {
    setActionMsg(null);
    try {
      await updateTruckStatus(truckId, status, { userId: user?.id ?? 'system', role });
      setActionMsg(`Estado actualizado a ${statusLabel[status]}`);
    } catch (err) {
      console.error(err);
      setActionMsg('No se pudo actualizar el estado (permiso/red).');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      if (!user) throw new Error('Sin sesion');
      if (!form.companyName || !form.plate || !form.driverName || !form.driverRut) {
        throw new Error('Completa conductor, RUT, patente y empresa');
      }
      if (entryType === 'anden' && !dockNumber) {
        throw new Error('Selecciona un anden');
      }

      await createTruck(
        {
          companyName: form.companyName,
          clientName: form.companyName,
          plate: form.plate,
          driverName: form.driverName,
          driverRut: form.driverRut,
          dockType: form.dockType,
          dockNumber: entryType === 'anden' ? dockNumber || '0' : '0',
          entryType,
          loadType: form.loadType,
          scheduledArrival: new Date(),
          notes: form.notes,
          initialStatus: 'en_espera',
        },
        { userId: user.id, role },
      );
      setMessage('Camion registrado');
      setForm({
        companyName: '',
        clientName: '',
        plate: '',
        driverName: '',
        driverRut: '',
        loadType: form.loadType,
        notes: '',
        dockType: form.dockType,
      });
      setEntryType('conos');
      setDockNumber('');
    } catch (err) {
      console.error(err);
      setError('No se pudo registrar el camion. Revisa datos o conexion.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !role) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-200">
        Cargando rol...
      </div>
    );
  }

  if (role !== 'porteria' && role !== 'admin' && role !== 'operaciones' && role !== 'superadmin') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-slate-200">
        <p>No tienes acceso a Porteria.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-slate-100">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 space-y-6">
        <div className="mb-4 grid gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-accent/10 via-white/5 to-sky-500/10 p-4 shadow-lg shadow-accent/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Porteria</p>
              <h1 className="text-2xl font-semibold text-white">Ingreso de camiones</h1>
              <p className="text-sm text-slate-400">Captura rápida para guardia.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAgenda((v) => !v)}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/15"
              >
                {showAgenda ? 'Cerrar bitácora' : 'Bitácora de ingresos'}
              </button>
              {user && <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">{user.name}</span>}
              <button
                onClick={() => logout()}
                className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-slate-900 hover:brightness-110"
              >
                Salir
              </button>
            </div>
          </div>
          {!showAgenda && (
            <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Paso 1</p>
                <p className="text-white font-semibold">Conductor + RUT</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Paso 2</p>
                <p className="text-white font-semibold">Patente + Empresa</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Paso 3</p>
                <p className="text-white font-semibold">Carga / Descarga</p>
              </div>
            </div>
          )}
        </div>

        {showAgenda && (
          <div className="rounded-2xl border border-white/10 bg-surface-panel/80 p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Bitacora de ingresos</p>
                <h3 className="text-lg font-semibold text-white">Camiones agendados por Comercial</h3>
                <p className="text-xs text-slate-400">Marca el estado: en camino, en porteria o en espera.</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                {agendaList.length} en bitacora
              </span>
            </div>
            {actionMsg && <p className="mb-2 text-xs text-amber-100">{actionMsg}</p>}
            <div className="overflow-hidden rounded-xl border border-white/10">
              <div className="grid grid-cols-[120px,140px,1.1fr,160px,140px,240px] bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                <span>Agendada</span>
                <span>Patente</span>
                <span>Cliente / Conductor</span>
                <span>Estado</span>
                <span>Ult. cambio</span>
                <span>Acciones</span>
              </div>
              {agendaList.length === 0 && (
                <div className="px-3 py-4 text-sm text-slate-300">Sin camiones agendados.</div>
              )}
              <div className="divide-y divide-white/5 max-h-[340px] overflow-auto">
                {agendaList.map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-[120px,140px,1.1fr,160px,140px,240px] items-center bg-white/5 px-3 py-3 text-sm text-slate-100"
                  >
                    <span className="font-mono text-amber-100">
                      {t.scheduledArrival
                        ? t.scheduledArrival.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                        : '--'}
                  </span>
                  <span className="font-semibold tracking-[0.2em] text-white">{t.plate}</span>
                  <span className="text-sm text-white">
                    <span className="font-semibold">{t.clientName}</span>
                    <span className="text-slate-300"> • {t.driverName}</span>
                    {t.driverRut && <span className="text-slate-400"> • {t.driverRut}</span>}
                  </span>
                  <span className={`w-fit rounded-full px-2 py-1 text-[11px] ${statusChip[t.status]}`}>
                    {statusLabel[t.status]}
                  </span>
                  <span className="text-xs text-slate-300">
                    {t.updatedAt
                      ? t.updatedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                      : '--'}
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-white hover:bg-white/20"
                      onClick={() => handleStatus(t.id, 'en_camino')}
                    >
                      En camino
                    </button>
                    <button
                      className="rounded-full border border-amber-300/60 bg-amber-400/25 px-3 py-1 text-amber-50 hover:brightness-110"
                      onClick={() => handleStatus(t.id, 'en_porteria')}
                    >
                      En porteria
                    </button>
                    <button
                      className="rounded-full border border-sky-300/60 bg-sky-400/25 px-3 py-1 text-white hover:brightness-110"
                      onClick={() => handleStatus(t.id, 'en_espera')}
                    >
                      Espera anden
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        )}

        {!showAgenda && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-panel">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-300">
                  Nombre conductor *
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.driverName}
                    onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Rut
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.driverRut}
                    onChange={(e) => setForm({ ...form, driverRut: e.target.value })}
                    placeholder="12.345.678-9"
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Patente *
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white uppercase focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.plate}
                    onChange={(e) => setForm({ ...form, plate: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Empresa *
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value, clientName: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Cargar / Descargar
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.loadType}
                    onChange={(e) => setForm({ ...form, loadType: e.target.value as any })}
                  >
                    <option value="carga">Carga</option>
                    <option value="descarga">Descarga</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </label>
                <label className="text-sm text-slate-300">
                  Ingreso a
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as 'conos' | 'anden')}
                  >
                    <option value="conos">Conos</option>
                    <option value="anden">Anden</option>
                  </select>
                </label>
                {entryType === 'anden' && (
                  <label className="text-sm text-slate-300">
                    Anden (1-9)
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                      value={dockNumber}
                      onChange={(e) => setDockNumber(e.target.value)}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {Array.from({ length: 9 }, (_, i) => `${i + 1}`).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <label className="text-sm text-slate-300">
                Notas
                <textarea
                  className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              {message && <p className="text-sm text-emerald-400">{message}</p>}
              {error && <p className="text-sm text-rose-400">{error}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      companyName: '',
                      clientName: '',
                      plate: '',
                      driverName: '',
                      driverRut: '',
                      loadType: form.loadType,
                      notes: '',
                      dockType: form.dockType,
                    })
                  }
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? 'Guardando...' : 'Guardar ingreso'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Registro de hoy</p>
              <h3 className="text-lg font-semibold text-white">Camiones ingresados</h3>
              <p className="text-xs text-slate-400">Del mas reciente al mas antiguo</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
              {todayList.length} registros
            </span>
          </div>
          <div className="grid gap-3">
            {todayList.length === 0 && (
              <p className="text-sm text-slate-400">Aun no hay registros hoy.</p>
            )}
            {todayList.map((t) => {
              const isOpen = expandedId === t.id;
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-white/10 bg-surface-dark/80 p-3 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-white font-semibold">{t.companyName}</p>
                      <p className="text-xs text-slate-400">
                        {t.plate} - {t.driverName} - {t.loadType ?? 'carga'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {t.createdAt?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) ?? '--'}
                      </span>
                      <button
                        onClick={() => setExpandedId(isOpen ? null : t.id)}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 hover:bg-white/10"
                      >
                        {isOpen ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-2 grid gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                      <p><span className="text-slate-400">Nombre:</span> {t.driverName}</p>
                      <p><span className="text-slate-400">Rut:</span> {t.driverRut || '--'}</p>
                      <p><span className="text-slate-400">Patente:</span> {t.plate}</p>
                      <p><span className="text-slate-400">Empresa:</span> {t.companyName}</p>
                      <p><span className="text-slate-400">Carga/Descarga:</span> {t.loadType ?? 'carga'}</p>
                      <p><span className="text-slate-400">Notas:</span> {t.notes || '--'}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
