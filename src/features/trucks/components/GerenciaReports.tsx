import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck } from '../types';
import { useAuth } from '../../auth/AuthProvider';
import { minutesBetween } from '../../../shared/utils/time';

type ReportType = 'cliente' | 'dia' | 'bitacora';
type ExportFormat = 'pdf' | 'excel' | 'word';

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

const reportColumns = [
  { key: 'idx', label: 'Cod. Usuario' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'bitacora', label: 'Con Bitacora' },
  { key: 'bitDate', label: 'F. Bitacora' },
  { key: 'bitHour', label: 'H. Bitacora' },
  { key: 'inDate', label: 'F. Ingreso' },
  { key: 'inHour', label: 'H. Ingreso' },
  { key: 'outDate', label: 'F. Salida' },
  { key: 'outHour', label: 'H. Salida' },
  { key: 'proceso', label: 'Proceso' },
  { key: 'plate', label: 'Patente' },
  { key: 'gate', label: 'Anden' },
  { key: 'hrsTotales', label: 'Hrs Totales' },
] as const;

type ReportRow = {
  idx: number;
  empresa: string;
  bitacora: boolean;
  bitDate: string;
  bitHour: string;
  inDate: string;
  inHour: string;
  outDate: string;
  outHour: string;
  proceso: string;
  plate: string;
  gate: string;
  hrsTotales: string;
};

type ReportColumnKey = (typeof reportColumns)[number]['key'];

type DemoTruckSeed = {
  id: string;
  companyName: string;
  clientName: string;
  plate: string;
  driverName: string;
  dockType: Truck['dockType'];
  dockNumber: Truck['dockNumber'];
  entryType?: Truck['entryType'];
  status: Truck['status'];
  hasBitacora: boolean;
  loadType?: Truck['loadType'];
  dayOffset: number;
  scheduled: string;
  checkInGate?: string;
  checkIn?: string;
  updated?: string;
};

const buildDemoTrucks = (dayValue: string): Truck[] => {
  let baseDay = dayValue ? new Date(dayValue) : new Date();
  if (Number.isNaN(baseDay.getTime())) baseDay = new Date();
  baseDay.setHours(0, 0, 0, 0);

  const addDays = (base: Date, offset: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return d;
  };

  const toTime = (base: Date, value?: string) => {
    if (!value) return null;
    const [h, m] = value.split(':').map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const demoSeeds: DemoTruckSeed[] = [
    {
      id: 'demo-1',
      companyName: 'Agrosuper',
      clientName: 'Agrosuper',
      plate: 'VZDS12',
      driverName: 'Luis Araya',
      dockType: 'recepcion',
      dockNumber: 1,
      entryType: 'conos',
      status: 'en_curso',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: 0,
      scheduled: '08:30',
      checkInGate: '08:10',
      checkIn: '08:20',
      updated: '09:40',
    },
    {
      id: 'demo-2',
      companyName: 'Soprole',
      clientName: 'Soprole',
      plate: 'GHT894',
      driverName: 'Maria Soto',
      dockType: 'recepcion',
      dockNumber: 3,
      entryType: 'conos',
      status: 'en_espera',
      hasBitacora: true,
      loadType: 'descarga',
      dayOffset: 0,
      scheduled: '09:05',
      checkInGate: '08:40',
      checkIn: '08:55',
      updated: '10:15',
    },
    {
      id: 'demo-3',
      companyName: 'Alta Fruta',
      clientName: 'Alta Fruta',
      plate: 'DDWS90',
      driverName: 'Pedro Rojas',
      dockType: 'despacho',
      dockNumber: 2,
      entryType: 'anden',
      status: 'en_camino',
      hasBitacora: true,
      loadType: 'mixto',
      dayOffset: 0,
      scheduled: '11:00',
    },
    {
      id: 'demo-4',
      companyName: 'Frutera Sur',
      clientName: 'Frutera Sur',
      plate: 'DSFDF432',
      driverName: 'Camila Vera',
      dockType: 'recepcion',
      dockNumber: 5,
      entryType: 'anden',
      status: 'en_porteria',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: 0,
      scheduled: '10:20',
      checkInGate: '10:15',
      checkIn: '10:18',
      updated: '10:35',
    },
    {
      id: 'demo-5',
      companyName: 'Agrosuper',
      clientName: 'Agrosuper',
      plate: 'VZDV18',
      driverName: 'Carlos Diaz',
      dockType: 'recepcion',
      dockNumber: 4,
      entryType: 'anden',
      status: 'recepcionado',
      hasBitacora: true,
      loadType: 'descarga',
      dayOffset: 0,
      scheduled: '07:50',
      checkInGate: '07:45',
      checkIn: '07:55',
      updated: '09:05',
    },
    {
      id: 'demo-6',
      companyName: 'Donihue',
      clientName: 'Donihue',
      plate: 'PHSG48',
      driverName: 'Juan Paredes',
      dockType: 'despacho',
      dockNumber: 6,
      entryType: 'conos',
      status: 'almacenado',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: 0,
      scheduled: '06:40',
      checkInGate: '06:30',
      checkIn: '06:45',
      updated: '08:30',
    },
    {
      id: 'demo-7',
      companyName: 'Copefrut',
      clientName: 'Copefrut',
      plate: 'KPG221',
      driverName: 'Valentina Reyes',
      dockType: 'recepcion',
      dockNumber: 7,
      entryType: 'anden',
      status: 'agendado',
      hasBitacora: false,
      loadType: 'carga',
      dayOffset: 0,
      scheduled: '13:30',
      checkInGate: '13:00',
      checkIn: '13:10',
    },
    {
      id: 'demo-8',
      companyName: 'Sopravol',
      clientName: 'Sopravol',
      plate: 'BGF567',
      driverName: 'Andres Silva',
      dockType: 'despacho',
      dockNumber: 8,
      entryType: 'conos',
      status: 'en_curso',
      hasBitacora: false,
      loadType: 'descarga',
      dayOffset: 0,
      scheduled: '12:10',
      checkInGate: '11:55',
      checkIn: '12:00',
      updated: '13:05',
    },
    {
      id: 'demo-9',
      companyName: 'Lacteos Sur',
      clientName: 'Lacteos Sur',
      plate: 'MTR233',
      driverName: 'Diego Yanez',
      dockType: 'recepcion',
      dockNumber: 9,
      entryType: 'anden',
      status: 'cerrado',
      hasBitacora: true,
      loadType: 'mixto',
      dayOffset: 0,
      scheduled: '05:40',
      checkInGate: '05:25',
      checkIn: '05:35',
      updated: '07:20',
    },
    {
      id: 'demo-10',
      companyName: 'Agrosuper',
      clientName: 'Agrosuper',
      plate: 'SDFG43',
      driverName: 'Jose Molina',
      dockType: 'despacho',
      dockNumber: 5,
      entryType: 'conos',
      status: 'terminado',
      hasBitacora: true,
      loadType: 'descarga',
      dayOffset: -1,
      scheduled: '14:10',
      checkInGate: '13:50',
      checkIn: '13:55',
      updated: '16:40',
    },
    {
      id: 'demo-11',
      companyName: 'Pacific Fresh',
      clientName: 'Pacific Fresh',
      plate: 'VFR123',
      driverName: 'Ana Torres',
      dockType: 'recepcion',
      dockNumber: 2,
      entryType: 'anden',
      status: 'almacenado',
      hasBitacora: false,
      loadType: 'carga',
      dayOffset: -1,
      scheduled: '09:30',
      checkInGate: '09:10',
      checkIn: '09:25',
      updated: '11:45',
    },
    {
      id: 'demo-12',
      companyName: 'Frutera Central',
      clientName: 'Frutera Central',
      plate: 'PLT989',
      driverName: 'Ignacio Vega',
      dockType: 'despacho',
      dockNumber: 1,
      entryType: 'conos',
      status: 'terminado',
      hasBitacora: true,
      loadType: 'mixto',
      dayOffset: -2,
      scheduled: '08:15',
      checkInGate: '08:00',
      checkIn: '08:05',
      updated: '10:20',
    },
    {
      id: 'demo-13',
      companyName: 'Del Monte',
      clientName: 'Del Monte',
      plate: 'RCH777',
      driverName: 'Paula Mora',
      dockType: 'recepcion',
      dockNumber: 3,
      entryType: 'anden',
      status: 'cerrado',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: -4,
      scheduled: '10:40',
      checkInGate: '10:20',
      checkIn: '10:30',
      updated: '12:30',
    },
    {
      id: 'demo-14',
      companyName: 'Agro Norte',
      clientName: 'Agro Norte',
      plate: 'ZXR552',
      driverName: 'Rodolfo Carrasco',
      dockType: 'despacho',
      dockNumber: 4,
      entryType: 'conos',
      status: 'terminado',
      hasBitacora: false,
      loadType: 'descarga',
      dayOffset: -6,
      scheduled: '07:10',
      checkInGate: '06:50',
      checkIn: '07:00',
      updated: '09:00',
    },
  ];

  return demoSeeds.map((seed) => {
    const seedDay = addDays(baseDay, seed.dayOffset);
    const scheduledArrival = toTime(seedDay, seed.scheduled) ?? seedDay;
    const checkInGateAt = toTime(seedDay, seed.checkInGate);
    const checkInTime = toTime(seedDay, seed.checkIn);
    const updatedAt = toTime(seedDay, seed.updated) ?? undefined;
    return {
      id: seed.id,
      companyName: seed.companyName,
      clientName: seed.clientName,
      plate: seed.plate,
      driverName: seed.driverName,
      dockType: seed.dockType,
      dockNumber: seed.dockNumber,
      entryType: seed.entryType,
      status: seed.status,
      scheduledArrival,
      hasBitacora: seed.hasBitacora,
      loadType: seed.loadType,
      checkInGateAt,
      checkInTime,
      updatedAt,
      createdAt: scheduledArrival,
      history: [],
    };
  });
};

export const GerenciaReports = () => {
  const { role } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('cliente');
  const [search, setSearch] = useState('');
  const [dock, setDock] = useState('');
  const [day, setDay] = useState<string>(() => formatDateInput(new Date()));
  const [bitacoraFilter, setBitacoraFilter] = useState<'con' | 'sin'>('con');
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [metricsRange, setMetricsRange] = useState<'dia' | '7d'>('dia');
  const [useDemo, setUseDemo] = useState(false);

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

  const demoTrucks = useMemo(() => buildDemoTrucks(day), [day]);
  const hasRealData = trucks.length > 0;
  const showDemo = useDemo || !hasRealData;
  const sourceTrucks = showDemo ? demoTrucks : trucks;

  if (role !== 'gerencia' && role !== 'admin' && role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const getDaySource = (t: Truck) => {
    if (reportType === 'bitacora' && bitacoraFilter === 'sin') {
      return t.checkInGateAt ?? t.checkInTime ?? t.createdAt ?? null;
    }
    return t.scheduledArrival ?? null;
  };

  const baseFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sourceTrucks.filter((t) => {
      const matchesTerm =
        !term ||
        t.clientName.toLowerCase().includes(term) ||
        t.plate.toLowerCase().includes(term) ||
        t.driverName.toLowerCase().includes(term);
      const matchesDock = !dock || `${t.dockNumber}` === dock;
      const hasBitacora = typeof t.hasBitacora === 'boolean' ? t.hasBitacora : Boolean(t.scheduledArrival);
      const matchesBitacora =
        reportType !== 'bitacora' || (bitacoraFilter === 'con' ? hasBitacora : !hasBitacora);
      return matchesTerm && matchesDock && matchesBitacora;
    });
  }, [sourceTrucks, search, dock, reportType, bitacoraFilter]);

  const filtered = useMemo(() => {
    const dayDate = day ? new Date(day) : null;
    if (dayDate) dayDate.setHours(0, 0, 0, 0);
    return baseFiltered.filter((t) => {
      if (!dayDate) return true;
      const source = getDaySource(t);
      if (!source) return false;
      return (
        source.getFullYear() === dayDate.getFullYear() &&
        source.getMonth() === dayDate.getMonth() &&
        source.getDate() === dayDate.getDate()
      );
    });
  }, [baseFiltered, day, reportType, bitacoraFilter]);

  const metricsSource = useMemo(() => {
    if (metricsRange !== '7d') return filtered;
    const endDate = day ? new Date(day) : new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    return baseFiltered.filter((t) => {
      const source = getDaySource(t);
      if (!source) return false;
      return source >= startDate && source <= endDate;
    });
  }, [metricsRange, baseFiltered, filtered, day, reportType, bitacoraFilter]);

  const metrics = useMemo(() => {
    const total = metricsSource.length;
    const delayed = metricsSource.filter(
      (t) => minutesBetween(t.checkInTime, new Date()) >= 30 && t.status === 'en_espera',
    ).length;
    const enCurso = metricsSource.filter((t) => t.status === 'en_curso').length;
    const finalizados = metricsSource.filter((t) =>
      ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(t.status),
    ).length;
    const promEspera = (() => {
      const waits = metricsSource
        .filter((t) => t.checkInGateAt && t.checkInTime)
        .map((t) => minutesBetween(t.checkInGateAt!, t.checkInTime!));
      if (!waits.length) return 0;
      return Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
    })();
    return { total, delayed, enCurso, finalizados, promEspera };
  }, [metricsSource]);

  const reportMetrics = useMemo(() => {
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

  const rowsForReport: ReportRow[] = filtered.slice(0, 50).map((t, idx) => {
    const hasBitacora = typeof t.hasBitacora === 'boolean' ? t.hasBitacora : Boolean(t.scheduledArrival);
    const bitDate = hasBitacora ? dateOrDash(t.scheduledArrival) : '--';
    const bitHour = hasBitacora ? timeOrDash(t.scheduledArrival) : '--';
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
      bitacora: hasBitacora,
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

  const formatReportCell = (row: ReportRow, key: ReportColumnKey) => {
    if (key === 'bitacora') return row.bitacora ? 'Si' : 'No';
    return row[key];
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const buildReportHtml = (rows: ReportRow[]) => {
    const headerHtml = reportColumns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
    const bodyHtml = rows
      .map(
        (row) =>
          `<tr>${reportColumns
            .map((col) => `<td>${escapeHtml(String(formatReportCell(row, col.key)))}</td>`)
            .join('')}</tr>`,
      )
      .join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
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
    <p class="subtitle">Generado: ${new Date().toLocaleString('es-CL')} | Registros: ${filtered.length}</p>
    <table>
      <thead>
        <tr>
          ${headerHtml}
        </tr>
      </thead>
      <tbody>
        ${bodyHtml || `<tr><td colspan="${reportColumns.length}">Sin datos para exportar.</td></tr>`}
      </tbody>
    </table>
  </body>
</html>`;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const runExport = (format: ExportFormat) => {
    if (exporting) return;
    setExportOpen(false);
    setExporting(format);
    setSendMsg(null);
    try {
      const html = buildReportHtml(rowsForReport);
      if (format === 'pdf') {
        const popup = window.open('', '_blank', 'width=1200,height=900');
        if (!popup) throw new Error('No se pudo abrir la ventana de impresion.');
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        popup.print();
        popup.close();
        setSendMsg('Se genero la vista de impresion. Guarda como PDF.');
        return;
      }

      const safeDay = day || formatDateInput(new Date());
      const baseName = `reporte-gerencia-${safeDay}`;
      const fileName = format === 'excel' ? `${baseName}.xls` : `${baseName}.doc`;
      const mime =
        format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8' : 'application/msword;charset=utf-8';
      downloadBlob(new Blob([html], { type: mime }), fileName);
      setSendMsg(`Descarga ${format === 'excel' ? 'Excel' : 'Word'} iniciada.`);
    } catch (err) {
      console.error(err);
      setSendMsg('No se pudo exportar el informe.');
    } finally {
      setExporting(null);
    }
  };

  const buildEmailBody = () => {
    const lines = rowsForReport
      .map(
        (r) =>
          `${r.idx}. ${r.empresa} | Bitacora: ${r.bitDate} ${r.bitHour} | Ingreso: ${r.inDate} ${r.inHour} | Salida: ${r.outDate} ${r.outHour} | Proceso: ${r.proceso} | Patente: ${r.plate} | Anden: ${r.gate} | Hrs: ${r.hrsTotales}`,
      )
      .join('\n');
    return `Informe logistico - ${new Date().toLocaleString('es-CL')}\nTotal: ${reportMetrics.total} | En curso: ${
      reportMetrics.enCurso
    } | Finalizados: ${reportMetrics.finalizados} | Retrasos: ${reportMetrics.delayed} | Prom espera: ${
      reportMetrics.promEspera
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

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-b from-slate-100 via-slate-50 to-sky-50 px-3 pb-10 pt-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="flex items-center justify-between bg-sky-700 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 overflow-hidden rounded-md bg-white/10">
                <img src="/friosan-logo.png" alt="Friosan" className="h-full w-full object-cover" />
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
            Genera y envia informes logisticos por cliente, dia o anden. Exporta a PDF, Excel o Word o envia por correo.
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Metricas</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUseDemo((prev) => !prev)}
                disabled={!hasRealData && !useDemo}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  showDemo ? 'bg-amber-300 text-slate-900' : 'bg-white text-slate-700 border border-slate-200'
                } ${!hasRealData && !useDemo ? 'cursor-default opacity-70' : ''}`}
              >
                {showDemo ? 'Datos demo activos' : 'Activar datos demo'}
              </button>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMetricsRange('dia')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    metricsRange === 'dia'
                      ? 'bg-sky-500 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Dia
                </button>
                <button
                  type="button"
                  onClick={() => setMetricsRange('7d')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    metricsRange === '7d'
                      ? 'bg-sky-500 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Ultimos 7 dias
                </button>
              </div>
            </div>
          </div>
          {showDemo && (
            <p className="text-xs text-amber-700">Mostrando datos demo para la reunion.</p>
          )}
          <div className="grid gap-3 md:grid-cols-4">
            <InfoCard label="Total" value={`${metrics.total}`} />
            <InfoCard label="En curso" value={`${metrics.enCurso}`} />
            <InfoCard label="Finalizados" value={`${metrics.finalizados}`} />
            <InfoCard label="Retrasos" value={`${metrics.delayed}`} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo de reporte</p>
              <div className="flex flex-wrap items-center gap-2">
                {(['cliente', 'dia', 'bitacora'] as ReportType[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setReportType(opt)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      reportType === opt ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {opt === 'cliente' ? 'Cliente' : opt === 'dia' ? 'Dia' : 'Bitacora'}
                  </button>
                ))}
                {reportType === 'bitacora' && (
                  <select
                    value={bitacoraFilter}
                    onChange={(e) => setBitacoraFilter(e.target.value as 'con' | 'sin')}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="con">Con bitacora</option>
                    <option value="sin">Sin bitacora</option>
                  </select>
                )}
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">M+®tricas r+ípidas</p>
            <div className="mt-3 space-y-2">
              <BarRow label="Retrasos" value={metrics.delayed} max={Math.max(1, metrics.total)} tone="sky" />
              <BarRow label="En curso" value={metrics.enCurso} max={Math.max(1, metrics.total)} tone="emerald" />
              <BarRow label="Finalizados" value={metrics.finalizados} max={Math.max(1, metrics.total)} tone="emerald" />
              <BarRow label="Prom. espera (min)" value={metrics.promEspera} max={Math.max(30, metrics.promEspera || 30)} tone="sky" />
            </div>
          </div>
        </div>

        {listenerError && !showDemo && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {listenerError}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" id="gerencia-report-header">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Informe log+¡stico</p>
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
              <div className="relative">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                  onClick={() => setExportOpen((prev) => !prev)}
                  disabled={Boolean(exporting)}
                >
                  {exporting ? 'Exportando...' : 'Exportar'}
                </button>
                {exportOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
                    <button
                      type="button"
                      onClick={() => runExport('pdf')}
                      className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => runExport('excel')}
                      className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    >
                      Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => runExport('word')}
                      className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    >
                      Word
                    </button>
                  </div>
                )}
              </div>
              {sendMsg && <span className="text-xs text-slate-600">{sendMsg}</span>}
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-slate-200" id="gerencia-report-table">
            <table className="min-w-full table-fixed border-collapse text-sm text-slate-800">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-700">
                <tr>
                  <th className="border border-slate-200 px-3 py-2">C+¦d. Usuario</th>
                  <th className="border border-slate-200 px-3 py-2">Empresa</th>
                  <th className="border border-slate-200 px-3 py-2">Con Bit+ícora</th>
                  <th className="border border-slate-200 px-3 py-2">F. Bit+ícora</th>
                  <th className="border border-slate-200 px-3 py-2">H. Bit+ícora</th>
                  <th className="border border-slate-200 px-3 py-2">F. Ingreso</th>
                  <th className="border border-slate-200 px-3 py-2">H. Ingreso</th>
                  <th className="border border-slate-200 px-3 py-2">F. Salida</th>
                  <th className="border border-slate-200 px-3 py-2">H. Salida</th>
                  <th className="border border-slate-200 px-3 py-2">Proceso</th>
                  <th className="border border-slate-200 px-3 py-2">Patente</th>
                  <th className="border border-slate-200 px-3 py-2">And+®n</th>
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



