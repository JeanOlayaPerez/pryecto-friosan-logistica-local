import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { createTruck, updateTruckDetails } from '../services/trucksApi';
import type { DockType, Truck } from '../types';

type TruckFormProps = {
  open: boolean;
  onClose: () => void;
  initialTruck?: Truck | null;
};

const initialState = {
  clientName: '',
  plate: '',
  driverName: '',
  dockType: 'recepcion' as DockType,
  dockNumber: '',
  scheduledArrival: '',
  notes: '',
};

export const TruckForm = ({ open, onClose, initialTruck }: TruckFormProps) => {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialTruck) {
      setForm({
        clientName: initialTruck.clientName,
        plate: initialTruck.plate,
        driverName: initialTruck.driverName,
        dockType: initialTruck.dockType,
        dockNumber: String(initialTruck.dockNumber),
        scheduledArrival: initialTruck.scheduledArrival
          ? new Date(initialTruck.scheduledArrival).toISOString().slice(0, 16)
          : '',
        notes: initialTruck.notes ?? '',
      });
    } else {
      setForm(initialState);
    }
  }, [initialTruck]);

  const mode = useMemo(() => (initialTruck ? 'edit' : 'create'), [initialTruck]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!form.clientName || !form.plate || !form.driverName || !form.scheduledArrival) {
        throw new Error('Completa los campos obligatorios');
      }

      if (mode === 'create') {
        await createTruck({
          clientName: form.clientName,
          plate: form.plate,
          driverName: form.driverName,
          dockType: form.dockType,
          dockNumber: form.dockNumber,
          scheduledArrival: form.scheduledArrival,
          notes: form.notes,
        });
      } else if (initialTruck) {
        await updateTruckDetails(initialTruck.id, {
          clientName: form.clientName,
          plate: form.plate,
          driverName: form.driverName,
          dockType: form.dockType,
          dockNumber: form.dockNumber,
          scheduledArrival: form.scheduledArrival,
          notes: form.notes,
        });
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError('Revisa los datos e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface-panel p-6 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {mode === 'create' ? 'Nuevo camión' : 'Editar camión'}
            </p>
            <h3 className="text-xl font-semibold text-white">
              {mode === 'create' ? 'Crear camión' : 'Actualizar camión'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/5 px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Cliente *
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                required
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
              Conductor *
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={form.driverName}
                onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                required
              />
            </label>

            <label className="text-sm text-slate-300">
              Dock *
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={form.dockNumber}
                onChange={(e) => setForm({ ...form, dockNumber: e.target.value })}
                required
              />
            </label>

            <label className="text-sm text-slate-300">
              Tipo de dock *
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={form.dockType}
                onChange={(e) => setForm({ ...form, dockType: e.target.value as DockType })}
              >
                <option value="recepcion">Recepción</option>
                <option value="despacho">Despacho</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Hora agendada *
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={form.scheduledArrival}
                onChange={(e) => setForm({ ...form, scheduledArrival: e.target.value })}
                required
              />
            </label>
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

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
