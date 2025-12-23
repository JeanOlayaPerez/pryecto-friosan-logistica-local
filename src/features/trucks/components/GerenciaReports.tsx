import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck } from '../types';
import { useAuth } from '../../auth/AuthProvider';
import { minutesBetween } from '../../../shared/utils/time';

type ReportType = 'cliente' | 'dia' | 'anden';

const formatDateInput = (d?: Date | null) => {
  if (!d) return '';
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const timeOrDash = (d?: Date | null) =>
  d ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
const dateOrDash = (d?: Date | null) =>
  d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '--';

export const GerenciaReports = () => {
  const { role } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('cliente');
  const [search, setSearch] = useState('');
  const [dock, setDock] = useState('');
  const [day, setDay] = useState<string>(() => formatDateInput(new Date()));
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const unsub = subscribeAllTrucks(
      (data) => {
        setListenerError(null);
        setTrucks(data);
      },
      (err) => {
        console.error(err);
        setListenerError('No se pudieron cargar los camiones (permisos o red).');
      },
    );
    return () => unsub();
  }, []);

  if (role !== 'gerencia' && role !== 'admin' && role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const dayDate = day ? new Date(day) : null;
    if (dayDate) dayDate.setHours(0, 0, 0, 0);
    return trucks.filter((t) => {
      const matchesTerm =
        !term ||
        t.clientName.toLowerCase().includes(term) ||
        t.plate.toLowerCase().includes(term) ||
        t.driverName.toLowerCase().includes(term);
      const matchesDock = !dock || `${t.dockNumber}` === dock;
      const matchesDay =
        !dayDate ||
        (t.scheduledArrival &&
          t.scheduledArrival.getFullYear() === dayDate.getFullYear() &&
          t.scheduledArrival.getMonth() === dayDate.getMonth() &&
          t.scheduledArrival.getDate() === dayDate.getDate());
      return matchesTerm && matchesDock && matchesDay;
    });
  }, [trucks, search, dock, day]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const delayed = filtered.filter((t) => minutesBetween(t.checkInTime, new Date()) >= 30 && t.status === 'en_espera')
      .length;
    const enCurso = filtered.filter((t) => t.status === 'en_curso').length;
    const finalizados = filtered.filter((t) =>
      ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(t.status),
    ).length;
    const promEspera = (() => {
      const waits = filtered
        .filter((t) => t.checkInGateAt && t.checkInTime)
        .map((t) => minutesBetween(t.checkInGateAt!, t.checkInTime!));
      if (!waits.length) return 0;
      return Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
    })();
    return { total, delayed, enCurso, finalizados, promEspera };
  }, [filtered]);

  const rowsForReport = filtered.slice(0, 50).map((t, idx) => {
    const bitDate = dateOrDash(t.scheduledArrival);
    const bitHour = timeOrDash(t.scheduledArrival);
    const inDate = dateOrDash(t.checkInGateAt);
    const inHour = timeOrDash(t.checkInGateAt);
    const outDate = dateOrDash(t.updatedAt);
    const outHour = timeOrDash(t.updatedAt);
    const proceso = `${(t.loadType ?? 'carga').toUpperCase()} / ${(t.entryType ?? 'conos').toUpperCase()}`;
    const gate = t.dockNumber ? `A-${t.dockNumber}` : '--';
    const hrsTotales =
      t.checkInGateAt && t.updatedAt
        ? `${Math.max(0, Math.floor((t.updatedAt.getTime() - t.checkInGateAt.getTime()) / 3600000))}h`
        : '--';
    return {
      idx: idx + 1,
      empresa: t.clientName,
      bitacora: bitDate !== '--',
      bitDate,
      bitHour,
      inDate,
      inHour,
      outDate,
      outHour,
      proceso,
      plate: t.plate,
      gate,
      hrsTotales,
    };
  });

  const buildEmailBody = () => {
    const lines = rowsForReport
      .map(
        (r) =>
          `${r.idx}. ${r.empresa} | Bitacora: ${r.bitDate} ${r.bitHour} | Ingreso: ${r.inDate} ${r.inHour} | Salida: ${r.outDate} ${r.outHour} | Proceso: ${r.proceso} | Patente: ${r.plate} | Anden: ${r.gate} | Hrs: ${r.hrsTotales}`,
      )
      .join('\n');
    return `Informe logistico - ${new Date().toLocaleString('es-CL')}\nTotal: ${metrics.total} | En curso: ${
      metrics.enCurso
    } | Finalizados: ${metrics.finalizados} | Retrasos: ${metrics.delayed} | Prom espera: ${
      metrics.promEspera
    } min\n\n${lines || 'Sin filas con los filtros aplicados.'}`;
  };

  const handleSend = () => {
    if (!emailTo.trim()) {
      setSendMsg('Ingresa un correo de destino');
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      const subject = encodeURIComponent('Informe logistico - Friosan');
      const body = encodeURIComponent(buildEmailBody());
      window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
      setSendMsg('Abriendo cliente de correo con el informe.');
    } catch (err) {
      console.error(err);
      setSendMsg('No se pudo abrir el correo. Copia el cuerpo manualmente.');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPdf = () => {
    setDownloading(true);
    try {
      const rowsHtml = rowsForReport
        .map(
          (r) => `<tr>
            <td>${r.idx}</td>
            <td>${r.empresa}</td>
            <td>${r.bitacora ? 'Si' : 'No'}</td>
            <td>${r.bitDate}</td>
            <td>${r.bitHour}</td>
            <td>${r.inDate}</td>
            <td>${r.inHour}</td>
            <td>${r.outDate}</td>
            <td>${r.outHour}</td>
            <td>${r.proceso}</td>
            <td>${r.plate}</td>
            <td>${r.gate}</td>
            <td>${r.hrsTotales}</td>
          </tr>`,
        )
        .join('');

      const html = `
      <html>
      <head>
        <title>Informe logistico</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
          h1 { margin: 0 0 12px 0; }
          .subtitle { margin: 0 0 16px 0; color: #475569; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; }
          th { background: #6b9eab; color: #fff; text-transform: uppercase; letter-spacing: 0.06em; }
          tbody tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>Informe logistico</h1>
        <p class="subtitle">Generado: ${new Date().toLocaleString('es-CL')} · Registros: ${filtered.length}</p>
        <table>
          <thead>
            <tr>
              <th>Cód. Usuario</th>
              <th>Empresa</th>
              <th>Con Bitácora</th>
              <th>F. Bitácora</th>
              <th>H. Bitácora</th>
              <th>F. Ingreso</th>
              <th>H. Ingreso</th>
              <th>F. Salida</th>
              <th>H. Salida</th>
              <th>Proceso</th>
              <th>Patente</th>
              <th>Andén</th>
              <th>Hrs Totales</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="13">Sin datos para exportar.</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>`;

      const popup = window.open('', '_blank', 'width=1200,height=900');
      if (!popup) throw new Error('No se pudo abrir la ventana de impresión.');
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
      popup.close();
      setSendMsg('Se generó la vista de impresión. Guarda como PDF.');
    } catch (err) {
      console.error(err);
      setSendMsg('No se pudo generar el PDF. Usa la vista previa o imprime la página.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-b from-slate-100 via-slate-50 to-sky-50 px-3 pb-10 pt-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="flex items-center justify-between bg-sky-700 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 overflow-hidden rounded-md bg-white/10">
                <img src="/friosan-logo.png" alt="Friosan" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-sky-100">Friosan SPA</p>
                <p className="text-lg font-semibold">Reportes de gerencia</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono tracking-wide">
                {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'short' })}
              </p>
              <p className="font-mono tracking-wide">
                {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="bg-white px-5 py-3 text-sm text-slate-700">
            Genera y envía informes logísticos por cliente, día o andén. Exporta a PDF o envía por correo.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <InfoCard label="Total" value={`${metrics.total}`} />
          <InfoCard label="En curso" value={`${metrics.enCurso}`} />
          <InfoCard label="Finalizados" value={`${metrics.finalizados}`} />
          <InfoCard label="Retrasos" value={`${metrics.delayed}`} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo de reporte</p>
              <div className="flex flex-wrap gap-2">
                {(['cliente', 'dia', 'anden'] as ReportType[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setReportType(opt)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      reportType === opt ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {opt === 'cliente' ? 'Cliente' : opt === 'dia' ? 'Dia' : 'Anden'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Buscar</p>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente, patente o conductor"
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Anden</p>
              <input
                value={dock}
                onChange={(e) => setDock(e.target.value)}
                placeholder="1-9"
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dia</p>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Métricas rápidas</p>
            <div className="mt-3 space-y-2">
              <BarRow label="Retrasos" value={metrics.delayed} max={Math.max(1, metrics.total)} tone="sky" />
              <BarRow label="En curso" value={metrics.enCurso} max={Math.max(1, metrics.total)} tone="emerald" />
              <BarRow label="Finalizados" value={metrics.finalizados} max={Math.max(1, metrics.total)} tone="emerald" />
              <BarRow label="Prom. espera (min)" value={metrics.promEspera} max={Math.max(30, metrics.promEspera || 30)} tone="sky" />
            </div>
          </div>
        </div>

        {listenerError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {listenerError}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" id="gerencia-report-header">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Informe logístico</p>
              <h3 className="text-xl font-semibold text-slate-900">Vista previa</h3>
              <p className="text-sm text-slate-600">Hasta 50 filas, mismo formato que el PDF.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="correo@empresa.com"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                type="email"
              />
              <button
                type="button"
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-60"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? 'Generando...' : 'Enviar por correo'}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? 'Generando PDF...' : 'Descargar PDF'}
              </button>
              {sendMsg && <span className="text-xs text-slate-600">{sendMsg}</span>}
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-slate-200" id="gerencia-report-table">
            <table className="min-w-full table-fixed border-collapse text-sm text-slate-800">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-700">
                <tr>
                  <th className="border border-slate-200 px-3 py-2">Cód. Usuario</th>
                  <th className="border border-slate-200 px-3 py-2">Empresa</th>
                  <th className="border border-slate-200 px-3 py-2">Con Bitácora</th>
                  <th className="border border-slate-200 px-3 py-2">F. Bitácora</th>
                  <th className="border border-slate-200 px-3 py-2">H. Bitácora</th>
                  <th className="border border-slate-200 px-3 py-2">F. Ingreso</th>
                  <th className="border border-slate-200 px-3 py-2">H. Ingreso</th>
                  <th className="border border-slate-200 px-3 py-2">F. Salida</th>
                  <th className="border border-slate-200 px-3 py-2">H. Salida</th>
                  <th className="border border-slate-200 px-3 py-2">Proceso</th>
                  <th className="border border-slate-200 px-3 py-2">Patente</th>
                  <th className="border border-slate-200 px-3 py-2">Andén</th>
                  <th className="border border-slate-200 px-3 py-2">Hrs Totales</th>
                </tr>
              </thead>
              <tbody>
                {rowsForReport.map((r, idx) => (
                  <tr key={r.idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.idx}</td>
                    <td className="border border-slate-200 px-3 py-2">{r.empresa}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.bitacora ? 'Si' : 'No'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.bitDate}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.bitHour}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.inDate}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.inHour}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.outDate}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.outHour}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.proceso}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.plate}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.gate}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.hrsTotales}</td>
                  </tr>
                ))}
                {rowsForReport.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-3 py-4 text-center text-sm text-slate-600">
                      No hay datos con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
    <p className="text-base font-semibold text-slate-900">{value}</p>
  </div>
);

const BarRow = ({
  label,
  value,
  max,
  tone = 'sky',
}: {
  label: string;
  value: number;
  max: number;
  tone?: 'sky' | 'emerald';
}) => {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  const color = tone === 'emerald' ? 'from-emerald-500 to-emerald-300' : 'from-sky-500 to-amber-400';
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-700">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
