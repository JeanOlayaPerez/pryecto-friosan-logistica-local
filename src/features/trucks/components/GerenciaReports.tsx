import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck, TruckStatus } from '../types';
import { useAuth } from '../../auth/AuthProvider';
import { formatDurationSince, minutesBetween } from '../../../shared/utils/time';

type ReportType = 'cliente' | 'dia' | 'anden';

const statusLabel: Record<TruckStatus, string> = {
  agendado: 'Agendado',
  en_camino: 'En camino',
  en_porteria: 'Porteria',
  en_espera: 'En espera',
  en_curso: 'En curso',
  recepcionado: 'Recepcionado',
  almacenado: 'Almacenado',
  cerrado: 'Cerrado',
  terminado: 'Terminado',
};

type FakeMetric = { label: string; value: string; detail?: string };

const buildFakeMetrics = (list: Truck[]): FakeMetric[] => {
  const total = list.length;
  const retrasos = list.filter((t) => minutesBetween(t.checkInTime, new Date()) >= 30 && t.status === 'en_espera').length;
  const enCurso = list.filter((t) => t.status === 'en_curso').length;
  const finalizados = list.filter((t) =>
    ['recepcionado', 'almacenado', 'cerrado', 'terminado'].includes(t.status),
  ).length;
  const promEspera = (() => {
    const waits = list
      .filter((t) => t.checkInGateAt && t.checkInTime)
      .map((t) => minutesBetween(t.checkInGateAt!, t.checkInTime!));
    if (!waits.length) return 0;
    return Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
  })();
  const eficiencia = total ? Math.max(0, 100 - retrasos * 5) : 100;
  const ocupacionAndenes = Math.min(100, (enCurso / Math.max(1, total)) * 120);

  return [
    { label: 'Retrasos promedio', value: `${retrasos} camiones`, detail: 'Threshold: 30 min en espera' },
    { label: 'Eficiencia estimada', value: `${eficiencia}%`, detail: 'Indicador simulado' },
    { label: 'Ocupación andenes', value: `${ocupacionAndenes.toFixed(0)}%`, detail: 'Indicador simulado' },
    { label: 'Finalizados', value: `${finalizados}`, detail: 'Recepcionado/Almacenado/Cerrado/Terminado' },
    { label: 'En curso', value: `${enCurso}`, detail: 'Camiones en proceso activo' },
    { label: 'Espera promedio', value: `${promEspera} min`, detail: 'Check-in portería a andén' },
    { label: 'Volumen (estimado)', value: `${Math.max(1, total * 8)} pallets`, detail: 'Valor de ejemplo' },
  ];
};

const formatDateInput = (d?: Date | null) => {
  if (!d) return '';
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    const delayed = filtered.filter((t) => minutesBetween(t.checkInTime, new Date()) >= 30 && t.status === 'en_espera').length;
    const enCurso = filtered.filter((t) => t.status === 'en_curso').length;
    const recepcionados = filtered.filter((t) => t.status === 'recepcionado' || t.status === 'almacenado' || t.status === 'cerrado' || t.status === 'terminado').length;
    const promEspera = (() => {
      const waits = filtered
        .filter((t) => t.checkInGateAt && t.checkInTime)
        .map((t) => minutesBetween(t.checkInGateAt!, t.checkInTime!));
      if (!waits.length) return 0;
      return Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
    })();
    return { total, delayed, enCurso, recepcionados, promEspera };
  }, [filtered]);

  const statusCounts = useMemo(() => {
    return filtered.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {} as Record<TruckStatus, number>);
  }, [filtered]);

  const dockCounts = useMemo(() => {
    return filtered.reduce((acc, t) => {
      const key = `${t.dockNumber ?? '0'}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filtered]);

  const dailyVolume = useMemo(() => {
    const today = new Date();
    const days: Array<{ label: string; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const label = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
      const total = filtered.filter((t) => {
        const s = t.scheduledArrival ?? t.createdAt;
        if (!s) return false;
        return (
          s.getFullYear() === d.getFullYear() &&
          s.getMonth() === d.getMonth() &&
          s.getDate() === d.getDate()
        );
      }).length;
      days.push({ label, total });
    }
    return days;
  }, [filtered]);

  const last14Status = useMemo(() => {
    const today = new Date();
    const ref = new Date(today);
    ref.setHours(0, 0, 0, 0);
    const start = new Date(ref);
    start.setDate(ref.getDate() - 13);
    const counts: Record<TruckStatus, number> = {
      agendado: 0,
      en_camino: 0,
      en_porteria: 0,
      en_espera: 0,
      en_curso: 0,
      recepcionado: 0,
      almacenado: 0,
      cerrado: 0,
      terminado: 0,
    };
    filtered.forEach((t) => {
      const d = t.scheduledArrival ?? t.createdAt;
      if (!d) return;
      const cmp = new Date(d);
      cmp.setHours(0, 0, 0, 0);
      if (cmp >= start && cmp <= ref) {
        counts[t.status] = (counts[t.status] ?? 0) + 1;
      }
    });
    return counts;
  }, [filtered]);

  const buildReportBody = () => {
    const fake = buildFakeMetrics(filtered);
    const header = `Reporte Gerencia - ${new Date().toLocaleString('es-CL')} \nTipo: ${reportType}\n`;
    const stats = `Total: ${metrics.total} | En curso: ${metrics.enCurso} | Finalizados: ${metrics.recepcionados} | Retrasos: ${metrics.delayed} | Espera promedio: ${metrics.promEspera} min\n`;
    const extras = fake.map((m) => `${m.label}: ${m.value} (${m.detail ?? 'indicador de ejemplo'})`).join('\n');
    const byStatus = Object.entries(statusCounts)
      .map(([k, v]) => `${statusLabel[k as TruckStatus] ?? k}: ${v}`)
      .join('\n');
    const byDock = Object.entries(dockCounts)
      .map(([k, v]) => `Andén ${k}: ${v}`)
      .join('\n');
    const lines = filtered
      .slice(0, 50)
      .map(
        (t) =>
          `${t.clientName} | ${t.plate} | ${statusLabel[t.status]} | ${t.dockType ?? ''} ${t.dockNumber ?? ''} | ${t.loadType ?? ''} | Ingreso: ${
            t.checkInTime ? t.checkInTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '--'
          } | Notas: ${t.notes ?? ''}`,
      )
      .join('\n');
    return `${header}${stats}\nIndicadores de ejemplo:\n${extras}\n\nDistribución por estado:\n${byStatus}\n\nDistribución por andén:\n${byDock}\n\nDetalle (máx 50):\n${lines}`;
  };

  const handleSend = () => {
    if (!emailTo.trim()) {
      setSendMsg('Ingresa un correo de destino');
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      const subject = encodeURIComponent('Reporte gerencia - Friosan Logística');
      const body = encodeURIComponent(buildReportBody());
      window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
      setSendMsg('Abriendo cliente de correo con el reporte.');
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
      const fake = buildFakeMetrics(filtered);
      const total14 = Object.values(last14Status).reduce((a, b) => a + b, 0) || 1;
      const pieSegments = Object.entries(last14Status)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ label: statusLabel[k as TruckStatus] ?? k, value: v }));
      const pieGradient = pieSegments
        .reduce(
          (acc, seg, idx) => {
            const start = acc.current;
            const end = acc.current + (seg.value / total14) * 360;
            const color = pieColor(idx);
            acc.parts.push(`${color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`);
            acc.current = end;
            return acc;
          },
          { current: 0, parts: [] as string[] },
        )
        .parts.join(', ');
      const statusRows = Object.entries(statusCounts)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .slice(0, 6)
        .map(
          ([k, v]) =>
            `<div style="margin:6px 0;">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#0f172a;">
                <span>${statusLabel[k as TruckStatus] ?? k}</span><span>${v}</span>
              </div>
              <div style="background:#e2e8f0;border-radius:12px;height:8px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, (v / Math.max(1, metrics.total)) * 100)}%;background:linear-gradient(90deg,#38bdf8,#fbbf24);"></div>
              </div>
            </div>`,
        )
        .join('');
      const dockRows = [...Array(9)]
        .map((_, i) => {
          const val = dockCounts[`${i + 1}`] ?? 0;
          return `<div style="margin:6px 0;">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#0f172a;">
                <span>Andén ${i + 1}</span><span>${val}</span>
              </div>
              <div style="background:#e2e8f0;border-radius:12px;height:8px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, (val / Math.max(1, metrics.total)) * 100)}%;background:linear-gradient(90deg,#22c55e,#38bdf8);"></div>
              </div>
            </div>`;
        })
        .join('');
      const volumeBars = dailyVolume
        .map(
          (d) => `<div style="flex:1;text-align:center;font-size:11px;color:#0f172a;">
            <div style="margin:0 auto;width:32px;height:${Math.min(120, d.total * 18 + 8)}px;background:linear-gradient(180deg,#38bdf8,#22c55e);border-radius:8px 8px 0 0;"></div>
            <div>${d.total}</div>
            <div style="color:#475569;">${d.label}</div>
          </div>`,
        )
        .join('');
      const detailRows = filtered
        .slice(0, 50)
        .map(
          (t) => `<tr>
            <td>${t.clientName}</td>
            <td>${t.plate}</td>
            <td>${statusLabel[t.status]}</td>
            <td>${t.dockType ?? '—'} ${t.dockNumber ?? ''}</td>
            <td>${t.checkInTime
              ? t.checkInTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
              : t.scheduledArrival?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) ?? '--'}</td>
            <td>${t.notes ?? '—'}</td>
          </tr>`,
        )
        .join('');

      const html = `
      <html>
      <head>
        <title>Reporte gerencia</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
          h1,h2,h3 { margin: 0 0 12px 0; }
          .kpi { display: flex; justify-content: space-between; gap: 12px; margin: 12px 0; flex-wrap: wrap; }
          .card { flex: 1; min-width: 180px; background: #e2e8f0; border-radius: 12px; padding: 12px; }
          .card h4 { margin: 0 0 4px 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
          .card p { margin: 0; font-size: 18px; font-weight: bold; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; }
          th { background: #e2e8f0; text-transform: uppercase; letter-spacing: 0.08em; }
          ul { margin: 0 0 12px 20px; padding: 0; }
          .pie { width: 140px; height: 140px; border-radius: 50%; background: conic-gradient(${pieGradient || '#e2e8f0 0deg 360deg'}); margin: 8px auto; position: relative; }
          .pie::after { content: ''; position: absolute; inset: 24px; background: white; border-radius: 50%; }
          .legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px,1fr)); gap: 4px; font-size: 11px; color: #475569; }
          .legend-item { display:flex; align-items:center; gap:6px; }
          .legend-dot { width:10px; height:10px; border-radius:50%; }
        </style>
      </head>
      <body>
        <h1>Reporte gerencia - Friosan Logística</h1>
        <p>Fecha: ${new Date().toLocaleString('es-CL')}</p>
        <div class="kpi">
          <div class="card"><h4>Total</h4><p>${metrics.total}</p></div>
          <div class="card"><h4>En curso</h4><p>${metrics.enCurso}</p></div>
          <div class="card"><h4>Finalizados</h4><p>${metrics.recepcionados}</p></div>
          <div class="card"><h4>Retrasos</h4><p>${metrics.delayed}</p></div>
          <div class="card"><h4>Espera promedio</h4><p>${metrics.promEspera} min</p></div>
        </div>

        <h3>Indicadores de ejemplo</h3>
        <ul>
          ${fake.map((m) => `<li>${m.label}: ${m.value} (${m.detail ?? 'indicador de ejemplo'})</li>`).join('')}
        </ul>

        <h3>Distribución por estado</h3>
        ${statusRows}
        <h3>Distribución por andén</h3>
        ${dockRows}
        <h3>Volumen últimos 7 días (simulado)</h3>
        <div style="display:flex; gap:8px; align-items:flex-end; margin:12px 0;">${volumeBars}</div>

        <h3>Ingresos últimos 14 días (pastel por estado)</h3>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <div class="pie"></div>
          <div class="legend">
            ${pieSegments
              .map(
                (seg, idx) =>
                  `<div class="legend-item"><span class="legend-dot" style="background:${pieColor(idx)};"></span>${seg.label}: ${seg.value}</div>`,
              )
              .join('') || '<div>Sin datos</div>'}
          </div>
        </div>

        <h3>Detalle (máximo 50)</h3>
        <table>
          <thead>
            <tr>
              <th>Cliente</th><th>Patente</th><th>Estado</th><th>Andén</th><th>Ingreso</th><th>Notas</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows || '<tr><td colspan="6">Sin datos</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>`;

      const popup = window.open('', '_blank', 'width=1100,height=900');
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
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-sky-500/10 via-fuchsia-500/10 to-emerald-500/10 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_25%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.1),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.1),transparent_25%)]" />
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Panel gerencia</p>
            <h2 className="text-2xl font-bold text-white">Reportes y envíos por correo</h2>
            <p className="text-sm text-slate-200">
              Genera reportes por cliente, día o andén, con métricas de retrasos, eficiencia y volumen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-200">
            <span className="rounded-full bg-white/10 px-3 py-1">
              {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'short' })}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1">
              {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {listenerError && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {listenerError}
        </div>
      )}

      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
        <div className="inline-flex rounded-full border border-white/10 bg-surface-panel/70 p-1 text-sm shadow-sm shadow-accent/10">
          {(['cliente', 'dia', 'anden'] as ReportType[]).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`rounded-full px-4 py-2 transition ${
                reportType === type
                  ? 'bg-accent text-slate-900 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {type === 'cliente' ? 'Por cliente' : type === 'dia' ? 'Por día' : 'Por andén'}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por cliente, patente o conductor"
          className="w-full max-w-sm rounded-full border border-white/10 bg-surface-panel px-4 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-full border border-white/10 bg-surface-panel px-3 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <select
          value={dock}
          onChange={(e) => setDock(e.target.value)}
          className="rounded-full border border-white/10 bg-surface-panel px-3 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        >
          <option value="">Andén (todos)</option>
          {[...Array(9)].map((_, i) => (
            <option key={i + 1} value={`${i + 1}`}>{`Andén ${i + 1}`}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Total filtrado" value={`${metrics.total}`} />
        <InfoCard label="En curso" value={`${metrics.enCurso}`} />
        <InfoCard label="Finalizados" value={`${metrics.recepcionados}`} />
        <InfoCard label="Retrasos (+30m)" value={`${metrics.delayed}`} />
        <InfoCard label="Espera promedio" value={`${metrics.promEspera} min`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Distribución por estado</p>
            <span className="text-xs text-slate-300">Top 6</span>
          </div>
          <div className="space-y-2">
            {Object.entries(statusCounts)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .slice(0, 6)
              .map(([key, val]) => (
                <BarRow key={key} label={statusLabel[key as TruckStatus] ?? key} value={val} max={Math.max(1, metrics.total)} />
              ))}
            {Object.keys(statusCounts).length === 0 && <p className="text-sm text-slate-400">Sin datos.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Ocupación por andén</p>
            <span className="text-xs text-slate-300">1-9</span>
          </div>
          <div className="space-y-2">
            {[...Array(9)].map((_, i) => {
              const val = dockCounts[`${i + 1}`] ?? 0;
              return <BarRow key={i} label={`Andén ${i + 1}`} value={val} max={Math.max(1, metrics.total)} tone="emerald" />;
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Volumen últimos 7 días (simulado)</p>
            <span className="text-xs text-slate-300">Programado/ingresado</span>
          </div>
          <div className="flex items-end gap-2">
            {dailyVolume.map((d, idx) => (
              <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-sky-500/40 to-emerald-400/70"
                  style={{ height: `${Math.min(100, d.total * 18 + 8)}px` }}
                />
                <p className="text-[11px] text-slate-300">{d.total}</p>
                <p className="text-[11px] text-slate-400">{d.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-4 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" id="gerencia-report-header">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reporte actual</p>
            <h3 className="text-xl font-semibold text-white">Vista previa</h3>
            <p className="text-sm text-slate-400">Incluye hasta 50 filas en el cuerpo del correo.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="correo@empresa.com"
              className="rounded-full border border-white/10 bg-surface-panel px-4 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              type="email"
            />
            <button
              type="button"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-accent/30 hover:brightness-110 disabled:opacity-60"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? 'Generando...' : 'Enviar por correo'}
            </button>
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? 'Generando PDF...' : 'Descargar PDF'}
            </button>
            {sendMsg && <span className="text-xs text-amber-100">{sendMsg}</span>}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10" id="gerencia-report-table">
          <div className="grid grid-cols-[160px,160px,1fr,120px,160px,1.2fr] bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300">
            <span>Cliente</span>
            <span>Patente</span>
            <span>Estado</span>
            <span>Andén</span>
            <span>Ingreso</span>
            <span>Notas</span>
          </div>
          <div className="max-h-[360px] divide-y divide-white/5 overflow-auto">
            {filtered.slice(0, 50).map((t) => (
              <div key={t.id} className="grid grid-cols-[160px,160px,1fr,120px,160px,1.2fr] items-center bg-white/5 px-4 py-3 text-sm text-slate-100">
                <span className="font-semibold text-white">{t.clientName}</span>
                <span className="font-semibold tracking-[0.2em] text-white">{t.plate}</span>
                <span className={`rounded-full px-2 py-1 text-[11px] ${chipTone(t.status)}`}>{statusLabel[t.status]}</span>
                <span className="text-xs text-slate-300">{t.dockType ?? '—'} {t.dockNumber ?? ''}</span>
                <span className="text-xs text-slate-200">
                  {t.checkInTime
                    ? t.checkInTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                    : t.scheduledArrival?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) ?? '--'}
                </span>
                <span className="text-xs text-slate-300 line-clamp-2">{t.notes || '—'}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-300">No hay datos con los filtros aplicados.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const chipTone = (status: TruckStatus) => {
  if (status === 'en_curso') return 'bg-sky-400/20 text-sky-100';
  if (status === 'en_espera' || status === 'en_porteria') return 'bg-amber-400/20 text-amber-100';
  if (status === 'recepcionado' || status === 'almacenado' || status === 'cerrado' || status === 'terminado')
    return 'bg-emerald-400/20 text-emerald-100';
  return 'bg-white/10 text-white';
};

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="glass flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="text-base font-semibold text-white">{value}</p>
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
  const color =
    tone === 'emerald'
      ? 'from-emerald-500/70 to-emerald-400/30'
      : 'from-sky-500/70 to-amber-400/40';
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full bg-gradient-to-r ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const pieColor = (idx: number) => {
  const palette = ['#38bdf8', '#22c55e', '#fbbf24', '#f97316', '#a855f7', '#0ea5e9', '#22d3ee'];
  return palette[idx % palette.length];
};
