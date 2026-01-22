import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { createTruck, subscribeAllTrucks } from "../services/trucksApi";
import type { DockType, Truck, TruckStatus } from "../types";
import { useAuth } from "../../auth/AuthProvider";

const statusLabel: Record<TruckStatus, string> = {
  agendado: "Agendado",
  en_camino: "En camino",
  en_porteria: "Porteria",
  en_espera: "En espera",
  en_curso: "En curso",
  recepcionado: "Recepcionado",
  almacenado: "Almacenado",
  cerrado: "Cerrado",
  terminado: "Terminado",
};

const chipStyle: Record<TruckStatus, string> = {
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

const typeDisplay = (t: Truck) => {
  const main = (t.loadType ?? "carga").toUpperCase();
  const isDone = ["recepcionado", "almacenado", "cerrado", "terminado"].includes(t.status);
  return isDone ? `${main} / LISTO` : main;
};

const sameDay = (a?: Date | null, b?: Date | null) => {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

export const CommercialView = () => {
  const { role } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [planDate, setPlanDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [createForm, setCreateForm] = useState({
    clientName: "",
    dockType: "recepcion" as DockType,
    scheduledArrival: "",
    hasBitacora: true,
    loadType: "carga",
    notes: "",
  });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const scheduledInputRef = useRef<HTMLInputElement | null>(null);
  const canEdit = role === "comercial" || role === "admin" || role === "superadmin";
  const fallbackHome = role === "porteria" ? "/porteria" : role === "recepcion" ? "/recepcion" : "/";

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
        setListenerError("No se pudieron cargar los camiones (permisos o red).");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trucks;
    return trucks.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        `${t.dockNumber}`.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
    );
  }, [search, trucks]);

  const mercaderia = useMemo(
    () =>
      filtered
        .filter((t) => t.status !== "cerrado" && t.status !== "terminado")
        .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)),
    [filtered]
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
      if (!createForm.clientName.trim()) {
        throw new Error("Completa el cliente.");
      }
      if (!createForm.scheduledArrival) {
        throw new Error("Ingresa una fecha y hora agendada.");
      }
      const scheduled = new Date(createForm.scheduledArrival);
      if (Number.isNaN(scheduled.getTime())) {
        throw new Error("Fecha/hora agendada invalida.");
      }
      await createTruck({
        companyName: createForm.clientName.trim(),
        clientName: createForm.clientName.trim(),
        plate: "",
        driverName: "",
        driverRut: undefined,
        dockType: createForm.dockType,
        dockNumber: "0",
        scheduledArrival: scheduled,
        hasBitacora: createForm.hasBitacora,
        loadType: createForm.loadType as "carga" | "descarga" | "mixto",
        notes: createForm.notes.trim(),
        initialStatus: "agendado",
      });
      setCreateMsg("Camion agendado en la plantilla.");
      setCreateForm((prev) => ({ ...prev, notes: "" }));
      const d = new Date(scheduled);
      d.setHours(0, 0, 0, 0);
      setPlanDate(d);
    } catch (err: any) {
      setCreateError(err?.message ?? "No se pudo agendar el camion.");
    } finally {
      setCreating(false);
    }
  };

  const openSchedulePicker = () => {
    const el = scheduledInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.focus();
        el.click();
      }
    } catch (err) {
      console.warn("No se pudo abrir el calendario", err);
    }
  };

  if (role === "porteria") return <Navigate to="/porteria" replace />;
  if (role !== "comercial" && role !== "admin" && role !== "operaciones" && role !== "superadmin") {
    return <Navigate to={fallbackHome} replace />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-b from-slate-100 via-slate-50 to-sky-50 px-3 pb-10 pt-4 text-slate-900">
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
        <div className="flex flex-col gap-3 bg-sky-700 px-5 py-4 text-white md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-100">Panel comercial</p>
            <h2 className="text-2xl font-bold text-white">Mercaderia por andenes</h2>
            <p className="text-sm text-sky-100">Visibilidad en vivo de carga/descarga y contenido esperado.</p>
          </div>
          <div className="flex flex-1 items-center gap-3 md:max-w-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, notas o anden"
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-sky-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-amber-50 px-5 py-3 text-xs text-slate-700">
          <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
            {now.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "short" })}
          </span>
          <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
            {now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="rounded-full border border-amber-200 bg-white px-3 py-1">Activos: {mercaderia.length}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Plantilla diaria (comercial)</p>
            <h3 className="text-xl font-semibold text-slate-900">Agendar camiones del dia</h3>
            <p className="text-sm text-slate-600">Ingresa los camiones previstos. Porteria luego solo marcara su ingreso y avance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-600">
              Dia a mostrar
              <input
                type="date"
                className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
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
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {plantilla.length} camiones agendados
            </span>
          </div>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-slate-600">
              Cliente
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                value={createForm.clientName}
                onChange={(e) => setCreateForm({ ...createForm, clientName: e.target.value })}
                required
              />
            </label>
            <label className="text-xs text-slate-600">
              Fecha y hora agendada
              <div className="relative mt-1">
                <input
                  ref={scheduledInputRef}
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-slate-900 focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  value={createForm.scheduledArrival}
                  onChange={(e) => setCreateForm({ ...createForm, scheduledArrival: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={openSchedulePicker}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
                  aria-label="Abrir calendario"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v2H2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6Zm-4 2a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm-4 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H10Zm-4 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H6Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </label>
            <label className="text-xs text-slate-600">
              Bitacora
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                value={createForm.hasBitacora ? "con" : "sin"}
                onChange={(e) => setCreateForm({ ...createForm, hasBitacora: e.target.value === "con" })}
              >
                <option value="con">Con bitacora</option>
                <option value="sin">Sin bitacora</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Tipo carga
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                value={createForm.loadType}
                onChange={(e) => setCreateForm({ ...createForm, loadType: e.target.value })}
              >
                <option value="carga">Carga</option>
                <option value="descarga">Descarga</option>
                <option value="mixto">Mixto</option>
              </select>
            </label>
            <label className="text-xs text-slate-600 md:col-span-2 lg:col-span-3">
              Notas (opcional)
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              Estado inicial: <span className="text-slate-900">Agendado</span>. Porteria avanzara el flujo.
            </div>
            <div className="flex items-center gap-2">
              {createMsg && <span className="text-xs text-emerald-600">{createMsg}</span>}
              {createError && <span className="text-xs text-rose-600">{createError}</span>}
              <button
                type="submit"
                disabled={creating}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-200/60 hover:bg-sky-600 disabled:opacity-60"
              >
                {creating ? "Guardando..." : "Agregar a plantilla"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[160px,1.3fr,0.9fr,1.3fr] bg-slate-100 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-600">
            <span>Hora agendada</span>
            <span>Cliente</span>
            <span>Tipo carga</span>
            <span>Estado / Notas</span>
          </div>
          {loading ? (
            <div className="flex min-h-[120px] items-center justify-center text-sm text-slate-500">Cargando...</div>
          ) : plantilla.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Sin camiones agendados para este dia.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {plantilla.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[160px,1.3fr,0.9fr,1.3fr] items-center px-4 py-3 text-sm text-slate-800 odd:bg-white even:bg-slate-50"
                >
                  <span className="font-mono text-amber-600">
                    {t.scheduledArrival
                      ? t.scheduledArrival.toLocaleString("es-CL", { hour: "2-digit", minute: "2-digit" })
                      : "--"}
                  </span>
                  <span className="font-semibold text-slate-900">{t.clientName}</span>
                  <span className="text-xs text-slate-700">{typeDisplay(t)}</span>
                  <span className="flex flex-col gap-1 text-xs text-slate-700">
                    <span className={`w-fit rounded-full px-2 py-1 text-[11px] ${chipStyle[t.status]}`}>
                      {statusLabel[t.status]}
                    </span>
                    <span className="text-slate-500 line-clamp-2">{t.notes || "-"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {listenerError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {listenerError}
        </div>
      )}
    </div>
  );
};


