import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { ClientRecord, CreateClientInput } from "./types";
import { createClient, deleteClient, subscribeClients, updateClient } from "./clientsApi";

type FormState = {
  razonSocial: string;
  nombreEmpresa: string;
  correoContacto: string;
};

const emptyForm: FormState = {
  razonSocial: "",
  nombreEmpresa: "",
  correoContacto: "",
};

export const ClientsView = () => {
  const { role } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeClients(
      (data) => {
        setClients(data);
        setLoading(false);
        setError(null);
      },
      () => {
        setError("No se pudieron cargar los clientes.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.razonSocial.toLowerCase().includes(q) ||
        c.nombreEmpresa.toLowerCase().includes(q) ||
        (c.correoContacto ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      if (!form.razonSocial.trim()) throw new Error("Razón social es obligatoria");
      if (!form.nombreEmpresa.trim()) throw new Error("Nombre de empresa es obligatorio");
      const payload: CreateClientInput = {
        razonSocial: form.razonSocial,
        nombreEmpresa: form.nombreEmpresa,
        correoContacto: form.correoContacto,
      };
      if (editId) {
        await updateClient(editId, payload);
        setSaveMsg("Cliente actualizado");
      } else {
        await createClient(payload);
        setSaveMsg("Cliente creado");
      }
      setForm(emptyForm);
      setEditId(null);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 2500);
    }
  };

  const handleEdit = (c: ClientRecord) => {
    setEditId(c.id);
    setForm({
      razonSocial: c.razonSocial,
      nombreEmpresa: c.nombreEmpresa,
      correoContacto: c.correoContacto ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setSaveMsg(null);
    try {
      await deleteClient(id);
      setSaveMsg("Cliente eliminado");
    } catch (err) {
      setError("No se pudo eliminar el cliente");
    }
  };

  if (!["clientes", "admin", "superadmin", "operaciones"].includes(role ?? "")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">FrioSan SPA</p>
            <h1 className="text-xl font-semibold text-slate-900">{editId ? "Editar cliente" : "Agregar cliente"}</h1>
            <p className="text-sm text-slate-500">Directorio de empresas y contactos.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
            <p className="text-xs text-slate-500">Empresas</p>
            <p className="text-lg font-semibold">{clients.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md space-y-4"
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm text-slate-700">
              Razón social *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                required
              />
            </label>
            <label className="text-sm text-slate-700">
              Nombre de la empresa *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                value={form.nombreEmpresa}
                onChange={(e) => setForm({ ...form, nombreEmpresa: e.target.value })}
                required
              />
            </label>
            <label className="text-sm text-slate-700">
              Correo de contacto (opcional)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30"
                type="email"
                value={form.correoContacto}
                onChange={(e) => setForm({ ...form, correoContacto: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-500">
              {saveMsg && <span className="text-emerald-600">{saveMsg}</span>}
              {error && <span className="text-rose-600">{error}</span>}
            </div>
            <div className="flex gap-2">
              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm(emptyForm);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Cancelar edición
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Guardando..." : editId ? "Actualizar" : "Crear"}
              </button>
            </div>
          </div>
        </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Catálogo</p>
              <h2 className="text-lg font-semibold text-slate-900">Empresas activas</h2>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por razón social, nombre o correo"
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="grid grid-cols-[1.6fr,1.6fr,1.6fr,0.8fr] bg-slate-100 text-[12px] uppercase tracking-[0.18em] text-slate-600">
            <span className="border-r border-slate-200 px-3 py-2">Razón Social</span>
            <span className="border-r border-slate-200 px-3 py-2">Nombre empresa</span>
            <span className="border-r border-slate-200 px-3 py-2">Correo contacto</span>
            <span className="px-3 py-2">Acciones</span>
          </div>
          {loading && <div className="px-4 py-6 text-sm text-slate-500">Cargando...</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500">Sin empresas que coincidan con el filtro.</div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1.6fr,1.6fr,1.6fr,0.8fr] border-t border-slate-200 text-sm text-slate-800"
            >
              <div className="border-r border-slate-200 px-3 py-3 break-words">
                <p className="font-semibold">{c.razonSocial}</p>
              </div>
              <div className="border-r border-slate-200 px-3 py-3 break-words">
                <p className="font-semibold">{c.nombreEmpresa}</p>
              </div>
              <div className="border-r border-slate-200 px-3 py-3 break-words">
                <p>{c.correoContacto || "—"}</p>
              </div>
              <div className="px-3 py-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleEdit(c)}
                  className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
