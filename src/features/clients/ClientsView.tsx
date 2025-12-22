import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Navigate } from "react-router-dom";

type ClientRow = {
  id: string;
  name: string;
  estado: string;
  proceso: string;
  patente?: string;
  contacto?: string;
  correo?: string;
  notas?: string;
};

const mockData: ClientRow[] = [
  {
    id: "1",
    name: "Agroindustrial Pedegua S.A.",
    estado: "Carga",
    proceso: "Bitacora",
    patente: "",
    contacto: "Ana López",
    correo: "ana@pedegua.cl",
  },
  {
    id: "2",
    name: "Europastry Chile SpA",
    estado: "Carga",
    proceso: "Bitacora",
    patente: "",
    contacto: "Carlos Díaz",
    correo: "cdiaz@europastry.cl",
  },
  {
    id: "3",
    name: "FRIGORIFICO KARMAC SPA",
    estado: "Carga",
    proceso: "Bitacora",
    patente: "RRWD78",
    contacto: "María Soto",
    correo: "msoto@karmac.cl",
    notas: "Prioridad alta",
  },
  {
    id: "4",
    name: "Embonor S.A.",
    estado: "Descarga",
    proceso: "Sal. Opera",
    patente: "",
    contacto: "Leonardo Riquelme",
    correo: "leonardo@embonor.cl",
  },
];

export const ClientsView = () => {
  const { role } = useAuth();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mockData;
    return mockData.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q) ||
        c.proceso.toLowerCase().includes(q) ||
        (c.patente ?? "").toLowerCase().includes(q) ||
        (c.contacto ?? "").toLowerCase().includes(q),
    );
  }, [search]);

  if (!["clientes", "admin", "superadmin", "operaciones"].includes(role ?? "")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">FrioSan SPA</p>
            <h1 className="text-xl font-semibold text-slate-900">Directorio de empresas</h1>
            <p className="text-sm text-slate-500">Clientes y proveedores registrados.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
            <p className="text-xs text-slate-500">Empresas</p>
            <p className="text-lg font-semibold">{mockData.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
            <p className="text-xs text-slate-500">Con patente asignada</p>
            <p className="text-lg font-semibold">{mockData.filter((c) => c.patente).length}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Catálogo</p>
            <h2 className="text-lg font-semibold text-slate-900">Empresas activas</h2>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razón social, patente o contacto"
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr] bg-slate-100 text-[12px] uppercase tracking-[0.18em] text-slate-600">
            <span className="border-r border-slate-200 px-3 py-2">Razón Social</span>
            <span className="border-r border-slate-200 px-3 py-2">Estado</span>
            <span className="border-r border-slate-200 px-3 py-2">Proceso</span>
            <span className="border-r border-slate-200 px-3 py-2">Patente</span>
            <span className="border-r border-slate-200 px-3 py-2">Contacto</span>
            <span className="px-3 py-2">Acciones</span>
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500">Sin empresas que coincidan con el filtro.</div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr] border-t border-slate-200 text-sm text-slate-800"
            >
              <div className="border-r border-slate-200 px-3 py-3">
                <p className="font-semibold">{c.name}</p>
                {c.notas && <p className="text-xs text-slate-500">{c.notas}</p>}
              </div>
              <span className="border-r border-slate-200 px-3 py-3">{c.estado.toUpperCase()}</span>
              <span className="border-r border-slate-200 px-3 py-3">{c.proceso.toUpperCase()}</span>
              <span className="border-r border-slate-200 px-3 py-3 break-words">{c.patente || "—"}</span>
              <div className="border-r border-slate-200 px-3 py-3 break-words">
                <p>{c.contacto || "—"}</p>
                {c.correo && <p className="text-xs text-slate-500">{c.correo}</p>}
              </div>
              <div className="px-3 py-3">
                <button className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-200">
                  Ver ficha
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
