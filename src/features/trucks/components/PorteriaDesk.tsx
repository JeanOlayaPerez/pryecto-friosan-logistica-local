import { useEffect, useMemo, useState } from "react";
import { createTruck, subscribeAllTrucks, updateTruckDetails, updateTruckStatus } from "../services/trucksApi";
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

const dockNumbers = Array.from({ length: 9 }, (_, i) => `${i + 1}`);

const normalizeDockNumber = (value: Truck["dockNumber"]) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = Number(raw.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 1 || numeric > 9) return null;
  return numeric;
};

const formatHour = (d?: Date | null) => {
  if (!d) return "--:--";
  try {
    return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "--:--";
  }
};

const formatDate = (d?: Date | null) => {
  if (!d) return "--";
  try {
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "--";
  }
};

const processLabel = (t: Truck) => {
  const load = (t.loadType ?? "carga").toUpperCase();
  const entry = (t.entryType ?? "conos").toUpperCase();
  return `${load} · ${entry}`;
};

const bitacoraLabel = (t: Truck) =>
  (typeof t.hasBitacora === "boolean" ? t.hasBitacora : Boolean(t.scheduledArrival))
    ? "Con"
    : "Sin";


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
  // Mostrar bitácora por defecto; el formulario solo para camión extra.
  const [showAgenda, setShowAgenda] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [dockSelectionId, setDockSelectionId] = useState<string | null>(null);
  const [dockSelectionValue, setDockSelectionValue] = useState("");
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

  const handleStatusChange = (truck: Truck, status: TruckStatus) => {
    if (status !== "en_curso") {
      if (dockSelectionId === truck.id) {
        setDockSelectionId(null);
        setDockSelectionValue("");
      }
      void handleStatus(truck.id, status);
      return;
    }

    const currentDock = normalizeDockNumber(truck.dockNumber);
    setDockSelectionId(truck.id);
    setDockSelectionValue(currentDock ? String(currentDock) : "");
    setActionMsg("Selecciona un anden para pasar a en curso.");
  };

  const handleDockAssign = async (truckId: string) => {
    setActionMsg(null);
    try {
      if (!dockSelectionValue) {
        setActionMsg("Selecciona un anden antes de continuar.");
        return;
      }
      const targetTruck = trucks.find((t) => t.id === truckId);
      if (!targetTruck) {
        setActionMsg("No se encontro el camion.");
        return;
      }
      const occupant = findDockOccupant(dockSelectionValue, targetTruck);
      if (occupant) {
        const label = occupant.plate ? `${occupant.clientName ?? "Camion"} (${occupant.plate})` : (occupant.clientName ?? "Camion");
        setActionMsg(`Anden ocupado por ${label}. Elige otro anden.`);
        return;
      }
      await updateTruckDetails(
        truckId,
        { entryType: "anden", dockNumber: dockSelectionValue },
        user ? { userId: user.id, role } : undefined,
      );
      await updateTruckStatus(truckId, "en_curso", { userId: user?.id ?? "system", role });
      setActionMsg(`Derivado a ${dockSelectionValue} y en curso`);
      setDockSelectionId(null);
      setDockSelectionValue("");
    } catch (err) {
      console.error(err);
      setActionMsg("No se pudo asignar el anden (permiso/red).");
    }
  };

  const findDockOccupant = (dockValue: string, truck: Truck) => {
    const dock = normalizeDockNumber(dockValue);
    if (!dock) return null;
    return (
      trucks.find(
        (other) =>
          other.id !== truck.id &&
          other.status === "en_curso" &&
          normalizeDockNumber(other.dockNumber) === dock,
      ) ?? null
    );
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
          hasBitacora: false,
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-sky-50 text-slate-900">
      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Encabezado tipo barra superior */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="flex items-center justify-between bg-sky-700 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 overflow-hidden rounded-md bg-white/10">
                <img src="/friosan-logo.png" alt="Friosan" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-100">Friosan · Porteria</p>
                <p className="text-lg font-semibold">Panel de porteria</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono tracking-wide">{formatDate(now)}</p>
              <p className="font-mono tracking-wide">{formatHour(now)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-sm">
            <span>
              <span className="font-semibold">Fecha:</span> {formatDate(now)}
            </span>
            <span>
              <span className="font-semibold">Usuario:</span> {user?.email ?? role?.toString().toUpperCase()}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAgenda((v) => !v)}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow border border-sky-200 hover:bg-sky-50"
              >
                {showAgenda ? "Ingresar camión extra" : "Volver a bitácora"}
              </button>
              <button
                onClick={() => logout()}
                className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-rose-600"
              >
                Salir
              </button>
            </div>
          </div>
        </div>

        {/* Bitácora */}
        {showAgenda && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Bitacora de ingresos</p>
                <p className="text-xs text-slate-500">Marca el estado: en camino, en portería o en espera.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
                {agendaList.length} en bitácora
              </span>
            </div>
            {actionMsg && <p className="mb-2 text-xs text-amber-700">{actionMsg}</p>}

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full table-fixed border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                    <th className="border border-slate-200 px-3 py-2 text-left w-[17%]">Razon social</th>
                    <th className="border border-slate-200 px-3 py-2 text-left w-[12%]">Patente</th>
                    <th className="border border-slate-200 px-3 py-2 text-left w-[17%]">Cliente / Conductor / Rut</th>
                    <th className="border border-slate-200 px-3 py-2 text-left w-[13%]">Proceso</th>
                    <th className="border border-slate-200 px-3 py-2 text-left w-[11%]">Agendada</th>
                    <th className="border border-slate-200 px-3 py-2 text-left w-[8%]">C/S Bitacora</th>
                    <th className="border border-slate-200 px-3 py-2 text-left w-[9%]">Ult. cambio</th>
                    <th className="border border-slate-200 px-3 py-2 text-left w-[13%]">Estado</th>
                  </tr>

                </thead>
                <tbody>
                  {agendaList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-sm text-slate-500">
                        No hay camiones en bitácora.
                      </td>
                    </tr>
                  )}
                  {agendaList.map((t, idx) => (
                    <tr
                      key={t.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                    >
                      <td className="border border-slate-200 px-3 py-3 align-top">
                        <p className="font-semibold text-slate-900 break-words">{t.clientName || "Sin cliente"}</p>
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top text-sm font-semibold uppercase tracking-[0.12em] text-slate-900 break-words">
                        {t.plate || "N/A"}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top text-sm text-slate-800 break-words">
                        <div className="space-y-0.5">
                          <p className="font-semibold">{t.driverName || "--"}</p>
                          {t.driverRut && <p className="text-slate-600 text-xs">{t.driverRut}</p>}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top text-sm text-slate-800 break-words">
                        {processLabel(t)}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top text-sm text-slate-700 break-words">
                        {t.scheduledArrival ? `${formatDate(t.scheduledArrival)} · ${formatHour(t.scheduledArrival)}` : "--"}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top text-sm text-slate-700">
                        {bitacoraLabel(t)}
                      </td>

                      <td className="border border-slate-200 px-3 py-3 align-top text-sm text-slate-700">
                        {t.updatedAt ? formatHour(t.updatedAt) : "--"}
                      </td>
                      <td className="border border-slate-200 px-3 py-3 align-top text-sm">
                        <div className="space-y-2">
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-800 shadow-sm"
                            value={t.status}
                            onChange={(e) => handleStatusChange(t, e.target.value as TruckStatus)}
                          >
                            <option value="en_camino">En camino</option>
                            <option value="en_porteria">En porteria</option>
                            <option value="en_espera">En espera</option>
                            <option value="en_curso">En curso</option>
                          </select>
                          <div
                            className={`flex w-full items-center justify-center rounded-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap ${statusChip[t.status]}`}
                          >
                            {statusLabel[t.status]}
                          </div>
                          {normalizeDockNumber(t.dockNumber) ? (
                            <div className="text-[11px] text-slate-500">
                              Anden: A-{normalizeDockNumber(t.dockNumber)}
                            </div>
                          ) : null}
                          {dockSelectionId === t.id && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                              <p className="mb-1 font-semibold text-slate-800">Selecciona anden</p>
                              <div className="flex items-center gap-2">
                                <select
                                  className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-800"
                                  value={dockSelectionValue}
                                  onChange={(e) => setDockSelectionValue(e.target.value)}
                                >
                                  <option value="">Elegir...</option>
                                  {dockNumbers.map((dock) => (
                                    <option key={dock} value={dock}>
                                      A-{dock}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDockAssign(t.id)}
                                  disabled={Boolean(dockSelectionValue && findDockOccupant(dockSelectionValue, t))}
                                  className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                  Asignar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDockSelectionId(null);
                                    setDockSelectionValue("");
                                  }}
                                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </div>
                              {dockSelectionValue && findDockOccupant(dockSelectionValue, t) && (
                                <p className="mt-1 text-[11px] text-rose-600">
                                  Anden ocupado por{" "}
                                  {findDockOccupant(dockSelectionValue, t)?.plate
                                    ? `${findDockOccupant(dockSelectionValue, t)?.clientName ?? "Camion"} (${findDockOccupant(dockSelectionValue, t)?.plate})`
                                    : `${findDockOccupant(dockSelectionValue, t)?.clientName ?? "Camion"}`}.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Formulario para camión extra */}
        {!showAgenda && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ingreso rápido</p>
                <h3 className="text-xl font-semibold text-slate-900">Camión no previsto</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
                Completa datos mínimos
              </span>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Nombre conductor *
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                    value={form.driverName}
                    onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Rut
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                    value={form.driverRut}
                    onChange={(e) => setForm({ ...form, driverRut: e.target.value })}
                    placeholder="12.345.678-9"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Patente *
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                    value={form.plate}
                    onChange={(e) => setForm({ ...form, plate: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Empresa *
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value, clientName: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Cargar / Descargar
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
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
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
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
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
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
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
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
                  className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-60"
                >
                  {submitting ? "Guardando..." : "Guardar ingreso"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Registro del día */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Registro de hoy</p>
              <h3 className="text-lg font-semibold text-slate-900">Camiones ingresados</h3>
              <p className="text-xs text-slate-500">Del más reciente al más antiguo</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
              {todayList.length} registros
            </span>
          </div>
          <div className="grid gap-3">
            {todayList.length === 0 && <p className="text-sm text-slate-500">Aún no hay registros hoy.</p>}
            {todayList.map((t) => {
              const isOpen = expandedId === t.id;
              return (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900">{t.companyName}</p>
                      <p className="text-xs text-slate-600">
                        {t.plate} · {t.driverName} · {t.loadType ?? "carga"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {t.createdAt?.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) ??
                          "--"}
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









