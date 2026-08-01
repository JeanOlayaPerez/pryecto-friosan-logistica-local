import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { whatsappReportsSeed } from '../data/whatsappReportsSeed';
import {
  importSecurityReports,
  seedToReport,
  subscribeSecurityReports,
} from '../services/securityReportsApi';
import type { SecurityReport, SecurityReportCategory, SecurityReportSeed } from '../types';

const categoryLabel: Record<SecurityReportCategory, string> = {
  truck_entry: 'Ingreso de camión',
  truck_exit: 'Salida de camión',
  security_round: 'Ronda / control',
  shift_change: 'Cambio de guardia',
  personnel: 'Personal',
  facility: 'Instalación',
  transport: 'Transporte de personal',
};

const categoryTone: Record<SecurityReportCategory, string> = {
  truck_entry: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  truck_exit: 'border-sky-200 bg-sky-50 text-sky-800',
  security_round: 'border-violet-200 bg-violet-50 text-violet-800',
  shift_change: 'border-amber-200 bg-amber-50 text-amber-800',
  personnel: 'border-slate-200 bg-slate-100 text-slate-700',
  facility: 'border-orange-200 bg-orange-50 text-orange-800',
  transport: 'border-cyan-200 bg-cyan-50 text-cyan-800',
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (report: SecurityReport) => {
  const date = report.occurredAt.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (report.timePrecision === 'date') return `${date} · hora no recuperada`;
  return `${date} · ${report.occurredAt.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
};

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const SecurityReportsView = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [saved, setSaved] = useState<SecurityReport[]>([]);
  const [privateSeed, setPrivateSeed] = useState<SecurityReportSeed[]>([]);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | SecurityReportCategory>('all');
  const [selectedDay, setSelectedDay] = useState('');
  const [onlyReview, setOnlyReview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'superadmin') return;
    return subscribeSecurityReports(
      (items) => {
        setSaved(items);
        setListenerError(null);
      },
      () => setListenerError('No se pudo consultar la colección securityReports. Puedes revisar los registros recuperados y desplegar las reglas antes de importar.'),
    );
  }, [role]);

  const stagedSeed = useMemo(() => [...whatsappReportsSeed, ...privateSeed], [privateSeed]);

  const reports = useMemo(() => {
    const merged = new Map<string, SecurityReport>();
    stagedSeed.forEach((item) => merged.set(item.id, seedToReport(item)));
    saved.forEach((item) => merged.set(item.id, item));
    return [...merged.values()].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }, [saved, stagedSeed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (category !== 'all' && report.category !== category) return false;
      if (selectedDay && toDateInput(report.occurredAt) !== selectedDay) return false;
      if (onlyReview && report.review !== 'review') return false;
      if (!q) return true;
      return [
        report.title,
        report.details,
        report.personName,
        report.identifier,
        report.plate,
        report.company,
        report.client,
        report.sourceText,
      ].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [reports, search, category, selectedDay, onlyReview]);

  const stats = useMemo(
    () => ({
      total: reports.length,
      entries: reports.filter((item) => item.category === 'truck_entry').length,
      exits: reports.filter((item) => item.category === 'truck_exit').length,
      controls: reports.filter((item) => item.category === 'security_round').length,
      review: reports.filter((item) => item.review === 'review').length,
      saved: reports.filter((item) => item.persisted).length,
    }),
    [reports],
  );

  const handleImport = async () => {
    setImporting(true);
    setMessage(null);
    try {
      if (stagedSeed.length === 0) {
        setMessage('Selecciona primero un archivo JSON privado con los registros a importar.');
        return;
      }
      const imported = await importSecurityReports(stagedSeed);
      setMessage(`${imported} registros guardados o actualizados sin duplicados.`);
    } catch (error) {
      console.error(error);
      setMessage('No se pudo importar. Despliega primero las reglas de Firestore y confirma la sesión de Super Admin.');
    } finally {
      setImporting(false);
    }
  };

  const handlePrivateFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('El archivo no contiene registros.');
      }
      const valid = parsed.every((item) => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as Partial<SecurityReportSeed>;
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.occurredAt === 'string' &&
          typeof candidate.category === 'string' &&
          typeof candidate.title === 'string' &&
          typeof candidate.details === 'string'
        );
      });
      if (!valid) throw new Error('Formato de registros inválido.');
      setPrivateSeed(parsed as SecurityReportSeed[]);
      setMessage(`${parsed.length} registros privados preparados. Revisa los filtros y confirma la importación.`);
    } catch (error) {
      console.error(error);
      setPrivateSeed([]);
      setMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo JSON.');
    } finally {
      event.target.value = '';
    }
  };

  const exportCsv = () => {
    const headers = ['fecha', 'hora', 'categoria', 'persona', 'rut_id', 'patente', 'empresa', 'cliente', 'operacion', 'anden', 'detalle', 'revision', 'guardado'];
    const rows = filtered.map((report) => [
      toDateInput(report.occurredAt),
      report.timePrecision === 'date'
        ? ''
        : report.occurredAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
      categoryLabel[report.category],
      report.personName,
      report.identifier,
      report.plate,
      report.company,
      report.client,
      report.operation,
      report.dock,
      report.details,
      report.review === 'review' ? 'requiere revisión' : 'verificado',
      report.persisted ? 'sí' : 'pendiente',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `informes-seguridad-${selectedDay || 'todos'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (role !== 'superadmin') {
    return <div className="flex h-[60vh] items-center justify-center text-slate-500">No tienes acceso a esta bitácora.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-sky-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-sky-800 px-5 py-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Super Admin · Fuente WhatsApp</p>
              <h1 className="text-2xl font-semibold">Bitácora de seguridad e ingresos</h1>
              <p className="mt-1 text-sm text-sky-100">GGSS-ReporteSeguridadFriosan</p>
            </div>
            <button type="button" onClick={() => navigate('/admin')} className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Volver al panel
            </button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ['Recuperados', stats.total],
              ['Ingresos', stats.entries],
              ['Salidas', stats.exits],
              ['Rondas', stats.controls],
              ['Por revisar', stats.review],
              ['En Firestore', stats.saved],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Importación recuperada</h2>
              <p className="max-w-3xl text-sm text-slate-600">
                Los registros históricos están separados de los camiones activos. Por privacidad, los nombres y RUT reales no se guardan en el repositorio público: se cargan desde un JSON privado y se envían directamente a Firestore.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100">
                Seleccionar JSON privado
                <input type="file" accept=".json,application/json" onChange={handlePrivateFile} className="sr-only" />
              </label>
              <button type="button" onClick={exportCsv} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Exportar CSV ({filtered.length})
              </button>
              <button type="button" onClick={handleImport} disabled={importing || stagedSeed.length === 0} className="rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">
                {importing ? 'Importando…' : 'Importar / sincronizar en Firestore'}
              </button>
            </div>
          </div>
          {(message || listenerError) && (
            <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${message?.includes('guardados') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {message ?? listenerError}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50">
          <div className="grid gap-3 md:grid-cols-4">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar persona, RUT, empresa o detalle…" className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100" />
            <select value={category} onChange={(event) => setCategory(event.target.value as 'all' | SecurityReportCategory)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100">
              <option value="all">Todas las categorías</option>
              {Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100" />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={onlyReview} onChange={(event) => setOnlyReview(event.target.checked)} className="h-4 w-4 accent-amber-600" />
              Solo requiere revisión
            </label>
          </div>
        </section>

        <section className="space-y-3">
          {filtered.map((report) => (
            <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryTone[report.category]}`}>{categoryLabel[report.category]}</span>
                    <span className="text-xs font-medium text-slate-500">{formatDate(report)}</span>
                    {report.review === 'review' && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Requiere revisión</span>}
                    {report.persisted && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Guardado</span>}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{report.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{report.details}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                    {report.identifier && <span><b>RUT/ID:</b> {report.identifier}</span>}
                    {report.plate && <span><b>Patente:</b> {report.plate}</span>}
                    {report.company && <span><b>Empresa:</b> {report.company}</span>}
                    {report.client && <span><b>Cliente:</b> {report.client}</span>}
                    {report.operation && <span><b>Operación:</b> {report.operation}</span>}
                    {report.dock && <span><b>Andén:</b> {report.dock}</span>}
                    <span><b>Reporta:</b> {report.reporter}</span>
                    {report.hasEvidence && <span><b>Evidencia:</b> foto/guía indicada en WhatsApp</span>}
                  </div>
                  <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <summary className="cursor-pointer font-semibold text-slate-700">Texto fuente</summary>
                    <p className="mt-2">{report.sourceText}</p>
                  </details>
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">No hay registros para estos filtros.</div>}
        </section>
      </div>
    </div>
  );
};
