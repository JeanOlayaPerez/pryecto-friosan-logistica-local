import { useEffect, useMemo, useState } from "react";
import { createTruck, subscribeAllTrucks, updateTruckStatus } from "../services/trucksApi";
import type { DockType, Truck, TruckStatus } from "../types";
import { useAuth } from "../../auth/AuthProvider";

const statusLabel: Record<TruckStatus, string> = {
  agendado: "Agendado",
  en_camino: "En camino",
  en_porteria: "En porteria",
  en_espera: "En espera",
  en_curso: "En curso",
  recepcionado: "Recepcionado",
  almacenado: "Almacenado",
  cerrado: "Cerrado",
  terminado: "Terminado",
};

const statusChip: Record<TruckStatus, string> = {
  agendado: "bg-slate-100 text-slate-700 border border-slate-200",
  en_camino: "bg-slate-100 text-slate-700 border border-slate-200",
  en_porteria: "bg-amber-100 text-amber-800 border border-amber-200",
  en_espera: "bg-amber-100 text-amber-800 border border-amber-200",
  en_curso: "bg-sky-100 text-sky-800 border border-sky-200",
  recepcionado: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  almacenado: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  cerrado: "bg-slate-100 text-slate-700 border border-slate-200",
  terminado: "bg-emerald-100 text-emerald-800 border border-emerald-200",
};

export const PorteriaDesk = () => {
  const { user, role, logout, loading } = useAuth();
  const [form, setForm] = useState({
    companyName: "",
    clientName: "",
    plate: "",
    driverName: "",
    driverRut: "",
    loadType: "carga" as "carga" | "descarga" | "mixto",
    notes: "",
    dockType: "recepcion" as DockType,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<"conos" | "anden">("conos");
  const [dockNumber, setDockNumber] = useState("");
  // Mostrar la bitacora por defecto; el formulario se usa solo para camiones no planificados
  const [showAgenda, setShowAgenda] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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
      .filter((t) => ["agendado", "en_camino", "en_porteria", "en_espera"].includes(t.status))
      .sort((a, b) => (a.scheduledArrival?.getTime() ?? 0) - (b.scheduledArrival?.getTime() ?? 0));
  }, [trucks]);

  const handleStatus = async (truckId: string, status: TruckStatus) => {
    setActionMsg(null);
    try {
      await updateTruckStatus(truckId, status, { userId: user?.id ?? "system", role });
      setActionMsg(`Estado actualizado a ${statusLabel[status]}`);
    } catch (err) {
      console.error(err);
      setActionMsg("No se pudo actualizar el estado (permiso/red).");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      if (!user) throw new Error("Sin sesion");
      if (!form.companyName || !form.plate || !form.driverName || !form.driverRut) {
        throw new Error("Completa conductor, RUT, patente y empresa");
      }
      if (entryType === "anden" && !dockNumber) {
        throw new Error("Selecciona un anden");
      }

      await createTruck(
        {
          companyName: form.companyName,
          clientName: form.companyName,
          plate: form.plate,
          driverName: form.driverName,
          driverRut: form.driverRut,
          dockType: form.dockType,
          dockNumber: entryType === "anden" ? dockNumber || "0" : "0",
          entryType,
          loadType: form.loadType,
          scheduledArrival: new Date(),
          notes: form.notes,
          initialStatus: "en_espera",
        },
        { userId: user.id, role },
      );
      setMessage("Camion registrado");
      setForm({
        companyName: "",
        clientName: "",
        plate: "",
        driverName: "",
        driverRut: "",
        loadType: form.loadType,
        notes: "",
        dockType: form.dockType,
      });
      setEntryType("conos");
      setDockNumber("");
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el camion. Revisa datos o conexion.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !role) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Cargando rol...
      </div>
    );
  }

  if (role !== "porteria" && role !== "admin" && role !== "operaciones" && role !== "superadmin") {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <p>No tienes acceso a Porteria.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-md md:grid-cols-[1.4fr,1fr,1fr]">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">FrioSan SPA</p>
            <p className="text-sm font-semibold text-slate-900">Centro de distribución frigorífica</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Fecha</p>
            <p className="font-mono text-sm text-slate-800">
              {now.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Hora:</p>
            <p className="font-mono text-sm text-slate-800">
              {now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-xs text-slate-500">Temperatura:</p>
            <p className="font-mono text-sm text-slate-800">12°C (Pudahuel)</p>
          </div>
        </div>

        <div className="mb-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Porteria · FrioSan SPA</p>
              <h1 className="text-2xl font-semibold text-slate-900">Bitacora de camiones</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAgenda((v) => !v)}
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-200"
              >
                {showAgenda ? "Ingresar camion" : "Volver a bitacora"}
              </button>
              <button
                onClick={() => logout()}
                className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm hover:brightness-110"
              >
                Salir
              </button>
            </div>
          </div>
          {!showAgenda && (
            <div className="grid grid-cols-3 gap-3 text-sm text-slate-500">
              <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Paso 1</p>
                <p className="font-semibold text-slate-900">Conductor + RUT</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Paso 2</p>
                <p className="font-semibold text-slate-900">Patente + Empresa</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Paso 3</p>
                <p className="font-semibold text-slate-900">Carga / Descarga</p>
              </div>
            </div>
          )}
        </div>

        {showAgenda && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Bitacora de ingresos</p>
                <h3 className="text-lg font-semibold text-slate-900">Camiones agendados por Comercial</h3>
                <p className="text-xs text-slate-500">Marca el estado: en camino, en porteria o en espera.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
                {agendaList.length} en bitacora
              </span>
            </div>
            {actionMsg && <p className="mb-2 text-xs text-amber-700">{actionMsg}</p>}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[0.9fr,0.9fr,1.4fr,1fr,1.1fr,0.9fr,1fr] bg-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                <span className="border-r border-slate-200 px-3 py-2">Agendada</span>
                <span className="border-r border-slate-200 px-3 py-2">Patente</span>
                <span className="border-r border-slate-200 px-3 py-2">Cliente / Conductor / Rut</span>
                <span className="border-r border-slate-200 px-3 py-2">Ult. cambio</span>
                <span className="border-r border-slate-200 px-3 py-2">Acciones</span>
                <span className="border-r border-slate-200 px-3 py-2">T. Porteria</span>
                <span className="px-3 py-2">Estado</span>
              </div>
              {agendaList.length === 0 && (
                <div className="border-t border-slate-200 px-3 py-4 text-sm text-slate-500">Sin camiones agendados.</div>
              )}
              <div className="max-h-[360px] overflow-y-auto overflow-x-hidden bg-white">
                {agendaList.map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-[0.9fr,0.9fr,1.4fr,1fr,1.1fr,0.9fr,1fr] border-t border-slate-200 text-sm text-slate-800"
                  >
                    <span className="border-r border-slate-200 px-3 py-3 font-mono text-slate-700 break-words">
                      {t.scheduledArrival
                        ? t.scheduledArrival.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                        : "--"}
                    </span>
                    <span className="border-r border-slate-200 px-3 py-3 font-semibold tracking-[0.15em] text-slate-900 break-words">
                      {t.plate}
                    </span>
                    <div className="border-r border-slate-200 px-3 py-3 flex flex-col gap-0.5 text-sm text-slate-800 break-words">
                      <span className="font-semibold">{t.clientName}</span>
                      <span className="text-slate-600">{t.driverName}</span>
                      {t.driverRut && <span className="text-slate-500">{t.driverRut}</span>}
                    </div>
                    <span className="border-r border-slate-200 px-3 py-3 text-xs text-slate-600 break-words">
                      {t.updatedAt
                        ? t.updatedAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                        : "--"}
                    </span>
                    <div className="border-r border-slate-200 px-3 py-3 text-xs break-words">
                      <div className={`w-fit rounded-full px-2 py-1 text-[11px] ${statusChip[t.status]}`}>
                        {statusLabel[t.status]}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Actualiza para notificar otras vistas.</p>
                    </div>
                    <span className="border-r border-slate-200 px-3 py-3 text-xs text-slate-600 break-words">
                      {t.updatedAt && t.checkInGateAt
                        ? `${Math.max(
                            0,
                            Math.round((t.updatedAt.getTime() - t.checkInGateAt.getTime()) / 60000),
                          )} min`
                        : "--"}
                    </span>
                    <div className="px-3 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-800"
                        value={t.status}
                        onChange={(e) => handleStatus(t.id, e.target.value as TruckStatus)}
                      >
                        <option value="en_camino">En camino</option>
                        <option value="en_porteria">En porteria</option>
                        <option value="en_espera">En espera</option>
                        <option value="en_curso">En curso</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!showAgenda && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Nombre conductor *
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.driverName}
                    onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Rut
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.driverRut}
                    onChange={(e) => setForm({ ...form, driverRut: e.target.value })}
                    placeholder="12.345.678-9"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Patente *
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.plate}
                    onChange={(e) => setForm({ ...form, plate: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Empresa *
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value, clientName: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Cargar / Descargar
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={form.loadType}
                    onChange={(e) => setForm({ ...form, loadType: e.target.value as any })}
                  >
                    <option value="carga">Carga</option>
                    <option value="descarga">Descarga</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  Ingreso a
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as "conos" | "anden")}
                  >
                    <option value="conos">Conos</option>
                    <option value="anden">Anden</option>
                  </select>
                </label>
                {entryType === "anden" && (
                  <label className="text-sm text-slate-700">
                    Anden (1-9)
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
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

              <label className="text-sm text-slate-700">
                Notas
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              {message && <p className="text-sm text-emerald-600">{message}</p>}
              {error && <p className="text-sm text-rose-600">{error}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      companyName: "",
                      clientName: "",
                      plate: "",
                      driverName: "",
                      driverRut: "",
                      loadType: form.loadType,
                      notes: "",
                      dockType: form.dockType,
                    })
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? "Guardando..." : "Guardar ingreso"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Registro de hoy</p>
              <h3 className="text-lg font-semibold text-slate-900">Camiones ingresados</h3>
              <p className="text-xs text-slate-500">Del mas reciente al mas antiguo</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
              {todayList.length} registros
            </span>
          </div>
          <div className="grid gap-3">
            {todayList.length === 0 && <p className="text-sm text-slate-500">Aun no hay registros hoy.</p>}
            {todayList.map((t) => {
              const isOpen = expandedId === t.id;
              return (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900">{t.companyName}</p>
                      <p className="text-xs text-slate-600">
                        {t.plate} - {t.driverName} - {t.loadType ?? "carga"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {t.createdAt?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) ?? "--"}
                      </span>
                      <button
                        onClick={() => setExpandedId(isOpen ? null : t.id)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-100"
                      >
                        {isOpen ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                      <p>
                        <span className="text-slate-500">Nombre:</span> {t.driverName}
                      </p>
                      <p>
                        <span className="text-slate-500">Rut:</span> {t.driverRut || "--"}
                      </p>
                      <p>
                        <span className="text-slate-500">Patente:</span> {t.plate}
                      </p>
                      <p>
                        <span className="text-slate-500">Empresa:</span> {t.companyName}
                      </p>
                      <p>
                        <span className="text-slate-500">Carga/Descarga:</span> {t.loadType ?? "carga"}
                      </p>
                      <p>
                        <span className="text-slate-500">Notas:</span> {t.notes || "--"}
                      </p>
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
