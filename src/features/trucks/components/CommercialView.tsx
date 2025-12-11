import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { subscribeAllTrucks, updateTruckDetails } from '../services/trucksApi';
import type { Truck, TruckStatus } from '../types';
import { useAuth } from '../../auth/AuthProvider';

const dockNumbers = Array.from({ length: 9 }, (_, i) => `${i + 1}`);
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

const formatHour = (value?: Date | null) => {
  if (!value) return '--';
  try {
    return value.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--';
  }
};

export type Metrics = {
  pallets?: number;
  boxes?: number;
  kilos?: number;
  price?: number;
  items?: string[];
};

const parseMetrics = (notes?: string): Metrics => {
  if (!notes) return {};
  const lower = notes.toLowerCase();
  const number = (re: RegExp) => {
    const m = lower.match(re);
    if (!m) return undefined;
    const n = Number((m[1] ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };
  const pallets = number(/(\d+)\s*pallet/);
  const boxes = number(/(\d+)\s*caja/);
  const kilos = number(/(\d+(?:[\.,]\d+)?)\s*(?:kg|kilo)/);
  const price = number(/(\d+(?:[\.,]\d+)?)\s*(?:clp|\$)/);
  const items = notes.split(/,|;|\n/).map((t) => t.trim()).filter(Boolean);
  return { pallets, boxes, kilos, price, items };
};

export const CommercialView = () => {
  const { role } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ pallets: '', boxes: '', kilos: '', price: '', items: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const perDock = useMemo(
    () =>
      dockNumbers.map((dock) => {
        const list = filtered.filter((t) => `${t.dockNumber}` === dock);
        const ocupados = list.filter((t) => !['cerrado', 'terminado'].includes(t.status));
        const prioridad = list.find((t) => t.status === 'en_curso') ?? list[0] ?? null;
        return {
          dock,
          list,
          ocupado: ocupados.length > 0,
          prioridad,
        };
      }),
    [filtered],
  );

  const mercaderia = useMemo(
    () =>
      filtered
        .filter((t) => t.status !== 'cerrado' && t.status !== 'terminado')
        .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)),
    [filtered],
  );

  const metricsFromTruck = (t: Truck): Metrics => ({
    pallets: t.pallets ?? undefined,
    boxes: t.boxes ?? undefined,
    kilos: t.kilos ?? undefined,
    price: t.price ?? undefined,
    items: t.cargoItems && t.cargoItems.length ? t.cargoItems : parseMetrics(t.notes).items,
  });

  const startEdit = (t: Truck) => {
    const m = metricsFromTruck(t);
    setEditId(t.id);
    setForm({
      pallets: m.pallets?.toString() ?? '',
      boxes: m.boxes?.toString() ?? '',
      kilos: m.kilos?.toString() ?? '',
      price: m.price?.toString() ?? '',
      items: (m.items ?? []).join('\n'),
    });
    setSaveMsg(null);
    setSaveError(null);
  };

  const saveEdit = async (t: Truck) => {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      await updateTruckDetails(t.id, {
        pallets: form.pallets ? Number(form.pallets) : undefined,
        boxes: form.boxes ? Number(form.boxes) : undefined,
        kilos: form.kilos ? Number(form.kilos) : undefined,
        price: form.price ? Number(form.price) : undefined,
        cargoItems: form.items
          ? form.items
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      });
      setSaveMsg('Guardado');
      setEditId(null);
    } catch (err) {
      console.error(err);
      setSaveError('No se pudo guardar (permisos o red).');
    } finally {
      setSaving(false);
    }
  };

  if (role !== 'comercial' && role !== 'admin') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-slate-200">
        <p>Solo el rol comercial (o admin) puede ver este panel.</p>
      </div>
    );
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

      {listenerError && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {listenerError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {perDock.map((dock) => (
          <motion.div
            key={dock.dock}
            layout
            className={`glass rounded-2xl border px-4 py-3 shadow-panel ${
              dock.ocupado ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Anden</p>
                <h3 className="text-2xl font-semibold text-white">#{dock.dock}</h3>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{dock.list.length} camiones</p>
                <p>{dock.ocupado ? 'Ocupado' : 'Libre'}</p>
              </div>
            </div>
            {dock.list.length > 0 && (
              <div className="mt-3 space-y-2 text-xs">
                {dock.list.map((t) => {
                  const m = metricsFromTruck(t);
                  return (
                    <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">{t.clientName}</p>
                        <span className={`rounded-full px-3 py-1 text-[11px] ${chipStyle[t.status]}`}>
                          {statusLabel[t.status]}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {t.loadType ?? 'Carga/Descarga'} � {t.entryType ?? 'ingreso'}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-200">
                        <Info label="Pallets" value={m.pallets !== undefined ? `${m.pallets}` : 'Sin dato'} />
                        <Info label="Cajas" value={m.boxes !== undefined ? `${m.boxes}` : 'Sin dato'} />
                        <Info label="Kilos" value={m.kilos !== undefined ? `${m.kilos}` : 'Sin dato'} />
                        <Info label="Valor" value={m.price !== undefined ? `$${m.price}` : 'Sin dato'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {dock.prioridad && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <p className="text-white font-semibold">{dock.prioridad.clientName}</p>
                <p className="text-xs text-slate-400">
                  {dock.prioridad.plate} - {dock.prioridad.driverName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 ${chipStyle[dock.prioridad.status]}`}>
                    {statusLabel[dock.prioridad.status]}
                  </span>
                  {dock.prioridad.loadType && (
                    <span className="rounded-full bg-white/10 px-3 py-1 capitalize">
                      {dock.prioridad.loadType}
                    </span>
                  )}
                  {dock.prioridad.entryType && (
                    <span className="rounded-full bg-white/10 px-3 py-1">{dock.prioridad.entryType}</span>
                  )}
                </div>
                {dock.prioridad.notes && (
                  <p className="mt-2 text-xs text-slate-300 line-clamp-2">Notas: {dock.prioridad.notes}</p>
                )}
              </div>
            )}
            {dock.list.length === 0 && (
              <p className="mt-2 text-sm text-slate-400">Sin camiones asignados.</p>
            )}
          </motion.div>
        ))}
      </div>

      <div className="glass rounded-3xl border border-white/10 p-4 shadow-panel">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mercaderia en piso</p>
            <h3 className="text-xl font-semibold text-white">Detalle por camion</h3>
            <p className="text-xs text-slate-400">Lectura y edicion comercial: pallets, cajas, kilos y valor.</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
            {mercaderia.length} activos
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center text-slate-300">Cargando...</div>
        ) : mercaderia.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-300">
            No hay camiones en proceso para mostrar.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {mercaderia.map((truck) => {
                const metrics = metricsFromTruck(truck);
                const isEditing = editId === truck.id;
                return (
                  <motion.div
                    key={truck.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-white/10 bg-surface-panel/70 p-4 text-sm text-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-white">{truck.clientName}</p>
                        <p className="text-xs text-slate-400">
                          Anden {truck.dockNumber} � {truck.plate}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${chipStyle[truck.status]}`}>
                        {statusLabel[truck.status]}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <Info label="Carga/Descarga" value={truck.loadType ?? 'N/A'} />
                      <Info label="Ingreso" value={formatHour(truck.checkInTime ?? truck.createdAt)} />
                      <Info label="Conductor" value={truck.driverName} />
                      <Info label="Rut" value={truck.driverRut ?? '--'} />
                      <Info label="Tipo ingreso" value={truck.entryType ?? 'conos'} />
                      <Info label="Ult. cambio" value={formatHour(truck.updatedAt)} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                      <Info label="Pallets" value={metrics.pallets !== undefined ? `${metrics.pallets}` : 'Sin dato'} />
                      <Info label="Cajas" value={metrics.boxes !== undefined ? `${metrics.boxes}` : 'Sin dato'} />
                      <Info label="Kilos" value={metrics.kilos !== undefined ? `${metrics.kilos}` : 'Sin dato'} />
                      <Info label="Valor" value={metrics.price !== undefined ? `$${metrics.price}` : 'Sin dato'} />
                    </div>

                    {metrics.items && metrics.items.length > 0 && (
                      <div className="mt-2 space-y-1 rounded-xl border border-white/5 bg-white/5 p-3 text-xs">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Mercaderia declarada</p>
                        <ul className="list-disc space-y-1 pl-4 text-slate-200">
                          {metrics.items.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-accent/40 bg-accent/10 p-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <label className="text-slate-300">
                            Pallets
                            <input
                              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-2 py-1 text-white"
                              value={form.pallets}
                              onChange={(e) => setForm({ ...form, pallets: e.target.value })}
                              type="number"
                              min="0"
                            />
                          </label>
                          <label className="text-slate-300">
                            Cajas
                            <input
                              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-2 py-1 text-white"
                              value={form.boxes}
                              onChange={(e) => setForm({ ...form, boxes: e.target.value })}
                              type="number"
                              min="0"
                            />
                          </label>
                          <label className="text-slate-300">
                            Kilos
                            <input
                              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-2 py-1 text-white"
                              value={form.kilos}
                              onChange={(e) => setForm({ ...form, kilos: e.target.value })}
                              type="number"
                              min="0"
                            />
                          </label>
                          <label className="text-slate-300">
                            Valor (CLP)
                            <input
                              className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-2 py-1 text-white"
                              value={form.price}
                              onChange={(e) => setForm({ ...form, price: e.target.value })}
                              type="number"
                              min="0"
                            />
                          </label>
                        </div>
                        <label className="text-xs text-slate-300">
                          Items (uno por linea)
                          <textarea
                            className="mt-1 w-full rounded-lg border border-white/15 bg-surface-dark px-2 py-2 text-white"
                            rows={3}
                            value={form.items}
                            onChange={(e) => setForm({ ...form, items: e.target.value })}
                          />
                        </label>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white"
                            onClick={() => setEditId(null)}
                            disabled={saving}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-slate-900"
                            onClick={() => saveEdit(truck)}
                            disabled={saving}
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                        {saveMsg && <p className="text-xs text-emerald-200">{saveMsg}</p>}
                        {saveError && <p className="text-xs text-rose-200">{saveError}</p>}
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
                          onClick={() => startEdit(truck)}
                        >
                          Editar mercaderia
                        </button>
                      </div>
                    )}

                    {!metrics.items?.length && truck.notes === undefined && (
                      <p className="mt-2 text-xs text-slate-400">
                        Sin detalle de mercaderia. Completa la edicion para que el panel muestre el contenido.
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
    <p className="text-slate-100">{value}</p>
  </div>
);

