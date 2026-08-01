import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteTruck, subscribeAllTrucks, updateTruckStatus } from "../services/trucksApi";
import type { DockType, Truck, TruckStatus } from "../types";
import { useAuth } from "../../auth/AuthProvider";
import type { UserRole } from "../../auth/AuthProvider";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "../../auth/adminUsersApi";
import type { AdminUser } from "../../auth/adminUsersApi";
import { TruckForm } from "./TruckForm";

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

const allStatuses: TruckStatus[] = [
  "agendado",
  "en_camino",
  "en_porteria",
  "en_espera",
  "en_curso",
  "recepcionado",
  "almacenado",
  "cerrado",
  "terminado",
];

const allRoles = [
  "porteria",
  "recepcion",
  "operaciones",
  "calidad",
  "comercial",
  "gerencia",
  "visor",
  "clientes",
  "admin",
  "superadmin",
] as const satisfies readonly UserRole[];

const roleLabel: Record<UserRole, string> = {
  porteria: "Portería",
  recepcion: "Recepción",
  operaciones: "Operaciones",
  calidad: "Calidad",
  comercial: "Comercial",
  gerencia: "Gerencia",
  visor: "Visor",
  clientes: "Clientes",
  admin: "Admin",
  superadmin: "Super Admin",
};

type AccountForm = {
  name: string;
  email: string;
  role: UserRole;
  password: string;
};

const emptyAccountForm: AccountForm = {
  name: "",
  email: "",
  role: "porteria",
  password: "",
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

const dockLabel = (dockType: DockType) => (dockType === "recepcion" ? "Recepción" : "Despacho");

const metricCard = (title: string, value: string, desc?: string) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{title}</p>
    <p className="text-3xl font-semibold text-slate-900">{value}</p>
    {desc && <p className="text-sm text-slate-500">{desc}</p>}
  </div>
);

export const AdminPanel = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<"todos" | DockType>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | TruckStatus>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMsg, setAccountMsg] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    setAccountError(null);
    try {
      setAccounts(await listAdminUsers());
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas.");
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (role !== "superadmin") return;
    const unsub = subscribeAllTrucks(
      (data) => {
        setListenerError(null);
        setTrucks(data);
      },
      (err) => {
        console.error(err);
        setListenerError("No se pudieron cargar los camiones (permisos o red).");
      },
    );
    return () => unsub();
  }, [role]);

  useEffect(() => {
    if (role === "superadmin") void loadAccounts();
  }, [role]);

  const stats = useMemo(() => {
    const today = new Date();
    const sameDay = (d?: Date | null) =>
      d &&
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const total = trucks.length;
    const recepcion = trucks.filter((t) => t.dockType === "recepcion").length;
    const despacho = trucks.filter((t) => t.dockType === "despacho").length;
    const activos = trucks.filter((t) => t.status !== "cerrado" && t.status !== "terminado").length;
    const hoy = trucks.filter(
      (t) => sameDay(t.createdAt) || sameDay(t.checkInGateAt) || sameDay(t.checkInTime),
    ).length;
    return { total, recepcion, despacho, activos, hoy };
  }, [trucks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trucks.filter((t) => {
      if (areaFilter !== "todos" && t.dockType !== areaFilter) return false;
      if (statusFilter !== "todos" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (t.clientName ?? "").toLowerCase().includes(q) ||
        (t.companyName ?? "").toLowerCase().includes(q) ||
        (t.plate ?? "").toLowerCase().includes(q) ||
        (t.driverName ?? "").toLowerCase().includes(q) ||
        `${t.dockNumber ?? ""}`.toLowerCase().includes(q)
      );
    });
  }, [trucks, search, areaFilter, statusFilter]);

  const handleStatusChange = async (truck: Truck, status: TruckStatus) => {
    if (!user) return;
    setActionMsg(null);
    try {
      await updateTruckStatus(truck.id, status, { userId: user.id, role });
      setActionMsg(`Estado de ${truck.plate || truck.clientName} actualizado a ${statusLabel[status]}.`);
    } catch (err) {
      console.error(err);
      setActionMsg("No se pudo actualizar el estado (revisa permisos o conexión).");
    }
  };

  const handleDelete = async (truck: Truck) => {
    const ok = window.confirm("Eliminar camion? Esta accion no se puede deshacer.");
    if (!ok) return;
    setActionMsg(null);
    try {
      await deleteTruck(truck.id);
      setActionMsg("Camión eliminado.");
    } catch (err) {
      console.error(err);
      setActionMsg("No se pudo eliminar el camión (revisa permisos o conexión).");
    }
  };

  const resetAccountForm = () => {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountError(null);
    setAccountMsg(null);
    setAccountSaving(true);
    try {
      if (editingAccountId) {
        const current = accounts.find((account) => account.uid === editingAccountId);
        await updateAdminUser(editingAccountId, {
          ...accountForm,
          password: accountForm.password || undefined,
          disabled: current?.disabled ?? false,
        });
        setAccountMsg("Cuenta actualizada correctamente.");
      } else {
        await createAdminUser(accountForm);
        setAccountMsg("Cuenta creada correctamente. Ya puede iniciar sesión.");
      }
      resetAccountForm();
      await loadAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudo guardar la cuenta.");
    } finally {
      setAccountSaving(false);
    }
  };

  const startEditingAccount = (account: AdminUser) => {
    setAccountError(null);
    setAccountMsg(null);
    setEditingAccountId(account.uid);
    setAccountForm({
      name: account.name,
      email: account.email,
      role: account.role ?? "porteria",
      password: "",
    });
  };

  const handleToggleAccount = async (account: AdminUser) => {
    if (!account.role) {
      setAccountError("Primero edita la cuenta y asígnale un rol válido.");
      return;
    }
    const nextDisabled = !account.disabled;
    if (
      nextDisabled &&
      !window.confirm(`¿Deshabilitar la cuenta de ${account.name}? No podrá iniciar sesión.`)
    ) {
      return;
    }
    setAccountSaving(true);
    setAccountError(null);
    setAccountMsg(null);
    try {
      await updateAdminUser(account.uid, {
        name: account.name,
        email: account.email,
        role: account.role,
        disabled: nextDisabled,
      });
      setAccountMsg(nextDisabled ? "Cuenta deshabilitada." : "Cuenta habilitada.");
      await loadAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudo cambiar el estado de la cuenta.");
    } finally {
      setAccountSaving(false);
    }
  };

  const handleDeleteAccount = async (account: AdminUser) => {
    const confirmed = window.confirm(
      `¿Eliminar permanentemente la cuenta de ${account.name} (${account.email})? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    setAccountSaving(true);
    setAccountError(null);
    setAccountMsg(null);
    try {
      await deleteAdminUser(account.uid);
      if (editingAccountId === account.uid) resetAccountForm();
      setAccountMsg("Cuenta eliminada.");
      await loadAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
    } finally {
      setAccountSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Cargando...
      </div>
    );
  }

  if (role !== "superadmin") {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <p>No tienes acceso a este panel.</p>
      </div>
    );
  }

  const quickLinks = [
    { label: "Tablero", to: "/recepcion" },
    { label: "Visor general", to: "/visor" },
    { label: "Reportes", to: "/gerencia" },
    { label: "Informes seguridad", to: "/admin/informes-seguridad" },
    { label: "Clientes", to: "/clientes" },
    { label: "Calidad", to: "/calidad" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-sky-50 text-slate-900">
      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Encabezado */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="flex items-center justify-between bg-sky-700 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 overflow-hidden rounded-md bg-white/10">
                <img src="/friosan-logo.png" alt="Friosan" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-100">Friosan SPA</p>
                <p className="text-lg font-semibold">Panel de Administración</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono tracking-wide">{formatDate(now)}</p>
              <p className="font-mono tracking-wide">{formatHour(now)}</p>
            </div>
          </div>
          <div className="bg-white px-4 py-4">
            <p className="text-2xl font-semibold text-slate-900">
              Bienvenido, {user?.name ?? "Administrador"}
            </p>
            <p className="text-sm text-slate-500">Acceso total del sistema · Superadministrador</p>
          </div>
        </div>

        {listenerError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {listenerError}
          </div>
        )}

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {metricCard("Total camiones", String(stats.total))}
          {metricCard("En Recepción", String(stats.recepcion))}
          {metricCard("En Despacho", String(stats.despacho))}
          {metricCard("Activos", String(stats.activos), "No cerrados / terminados")}
          {metricCard("Hoy", String(stats.hoy), "Creados o ingresados hoy")}
        </div>

        {/* Gestión de camiones */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Control total</p>
              <h3 className="text-lg font-semibold text-slate-900">Gestión de camiones (todas las áreas)</h3>
              <p className="text-xs text-slate-500">
                Edita, cambia el estado o elimina cualquier ingreso de recepción y despacho.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
              {filtered.length} camiones
            </span>
          </div>

          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              placeholder="Buscar cliente, patente, conductor o andén..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value as "todos" | DockType)}
            >
              <option value="todos">Todas las áreas</option>
              <option value="recepcion">Recepción</option>
              <option value="despacho">Despacho</option>
            </select>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "todos" | TruckStatus)}
            >
              <option value="todos">Todos los estados</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
          </div>

          {actionMsg && <p className="mb-2 text-xs text-amber-700">{actionMsg}</p>}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                  <th className="border border-slate-200 px-3 py-2 text-left">Empresa / Cliente</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Patente</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Conductor</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Área</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Andén</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Estado</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Últ. actualización</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-sm text-slate-500">
                      No hay camiones que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {filtered.map((t, idx) => (
                  <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm">
                      <p className="font-semibold text-slate-900 break-words">
                        {t.companyName || t.clientName || "Sin cliente"}
                      </p>
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm font-semibold uppercase tracking-[0.1em] text-slate-900">
                      {t.plate || "--"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm text-slate-800 break-words">
                      {t.driverName || "--"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm text-slate-800">
                      {dockLabel(t.dockType)}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm text-slate-800">
                      {t.dockNumber && `${t.dockNumber}` !== "0" ? `A-${t.dockNumber}` : "--"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap ${statusChip[t.status]}`}
                      >
                        {statusLabel[t.status]}
                      </span>
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm text-slate-700 whitespace-nowrap">
                      {t.updatedAt ? `${formatDate(t.updatedAt)} · ${formatHour(t.updatedAt)}` : "--"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-top text-sm">
                      <div className="flex min-w-[180px] flex-col gap-2">
                        <select
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-800 shadow-sm"
                          value={t.status}
                          onChange={(e) => void handleStatusChange(t, e.target.value as TruckStatus)}
                        >
                          {allStatuses.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel[s]}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTruck(t);
                              setFormOpen(true);
                            }}
                            className="flex-1 rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(t)}
                            className="flex-1 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-rose-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gestión de cuentas de empleados */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Administración</p>
              <h3 className="text-lg font-semibold text-slate-900">Gestión de cuentas de empleados</h3>
              <p className="text-xs text-slate-500">
                Crea, edita, habilita o deshabilita el acceso de cada usuario.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAccounts()}
              disabled={accountsLoading || accountSaving}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accountsLoading ? "Actualizando..." : "Actualizar lista"}
            </button>
          </div>

          {accountError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {accountError}
            </div>
          )}
          {accountMsg && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {accountMsg}
            </div>
          )}

          <form
            onSubmit={(event) => void handleAccountSubmit(event)}
            className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">
                {editingAccountId ? "Editar cuenta" : "Nueva cuenta"}
              </h4>
              {editingAccountId && (
                <button
                  type="button"
                  onClick={resetAccountForm}
                  disabled={accountSaving}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                >
                  Cancelar edición
                </button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Nombre
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder="Nombre del empleado"
                  value={accountForm.name}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, name: event.target.value }))
                  }
                  maxLength={100}
                  disabled={accountSaving}
                  required
                />
              </label>
              <label className="text-sm text-slate-700">
                Correo
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder="correo@friosan.cl"
                  value={accountForm.email}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, email: event.target.value }))
                  }
                  maxLength={254}
                  disabled={accountSaving}
                  required
                />
              </label>
              <label className="text-sm text-slate-700">
                Rol
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  value={accountForm.role}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      role: event.target.value as UserRole,
                    }))
                  }
                  disabled={accountSaving || editingAccountId === user?.id}
                >
                  {allRoles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                {editingAccountId ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder={editingAccountId ? "Dejar vacío para conservar" : "Mínimo 8 caracteres"}
                  value={accountForm.password}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, password: event.target.value }))
                  }
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  disabled={accountSaving}
                  required={!editingAccountId}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={accountSaving}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accountSaving
                  ? "Guardando..."
                  : editingAccountId
                    ? "Guardar cambios"
                    : "Crear cuenta"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  <th className="border border-slate-200 px-3 py-2 text-left">Empleado</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Rol</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Estado</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Último acceso</th>
                  <th className="border border-slate-200 px-3 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {accountsLoading && accounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                      Cargando cuentas...
                    </td>
                  </tr>
                )}
                {!accountsLoading && accounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                      No se encontraron cuentas registradas.
                    </td>
                  </tr>
                )}
                {accounts.map((account, index) => {
                  const isCurrentAccount = account.uid === user?.id;
                  return (
                    <tr key={account.uid} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="border border-slate-200 px-3 py-2 align-top text-sm">
                        <p className="font-semibold text-slate-900">
                          {account.name} {isCurrentAccount && <span className="text-xs text-sky-700">(tú)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{account.email || "Sin correo"}</p>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 align-top text-sm text-slate-700">
                        {account.role ? roleLabel[account.role] : (
                          <span className="font-semibold text-rose-600">Sin rol válido</span>
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 align-top text-sm">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${
                            account.disabled
                              ? "border-slate-300 bg-slate-100 text-slate-600"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {account.disabled ? "Deshabilitada" : "Activa"}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-600 whitespace-nowrap">
                        {account.lastSignInAt
                          ? new Date(account.lastSignInAt).toLocaleString("es-CL", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "Sin ingresos"}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 align-top text-sm">
                        <div className="flex min-w-[245px] flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingAccount(account)}
                            disabled={accountSaving}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleAccount(account)}
                            disabled={accountSaving || isCurrentAccount || !account.role}
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {account.disabled ? "Habilitar" : "Deshabilitar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteAccount(account)}
                            disabled={accountSaving || isCurrentAccount}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Navegación</p>
            <h3 className="text-lg font-semibold text-slate-900">Accesos rápidos</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => navigate(link.to)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow border border-sky-200 hover:bg-sky-50"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {formOpen && (
        <TruckForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingTruck(null);
          }}
          initialTruck={editingTruck}
        />
      )}
    </div>
  );
};
