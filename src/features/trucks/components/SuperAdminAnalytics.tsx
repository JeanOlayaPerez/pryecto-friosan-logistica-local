import { useId, useMemo, useState } from "react";
import type { DockType, Truck, TruckStatus } from "../types";

type Period = "7d" | "30d" | "90d" | "all";

type ChartPoint = {
  key: string;
  label: string;
  value: number;
};

const periodOptions: Array<{ value: Period; label: string; days?: number }> = [
  { value: "7d", label: "7 días", days: 7 },
  { value: "30d", label: "30 días", days: 30 },
  { value: "90d", label: "90 días", days: 90 },
  { value: "all", label: "Todo" },
];

const statusLabel: Record<TruckStatus, string> = {
  agendado: "Agendado",
  en_camino: "En camino",
  en_porteria: "En portería",
  en_espera: "En espera",
  en_curso: "En curso",
  recepcionado: "Recepcionado",
  almacenado: "Almacenado",
  cerrado: "Cerrado",
  terminado: "Terminado",
};

const statusOrder: TruckStatus[] = [
  "en_curso",
  "en_espera",
  "en_porteria",
  "en_camino",
  "agendado",
  "recepcionado",
  "almacenado",
  "cerrado",
  "terminado",
];

const completedStatuses = new Set<TruckStatus>(["cerrado", "terminado"]);
const numberFormatter = new Intl.NumberFormat("es-CL");

const toValidDate = (value: unknown): Date | null => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
};

const getArrivalDate = (truck: Truck) =>
  toValidDate(truck.checkInGateAt) ??
  toValidDate(truck.checkInTime) ??
  toValidDate(truck.createdAt) ??
  toValidDate(truck.scheduledArrival);

const getCompletionDate = (truck: Truck) =>
  toValidDate(truck.closedAt) ?? toValidDate(truck.processEndTime) ?? toValidDate(truck.storedAt);

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const companyName = (truck: Truck) =>
  truck.companyName?.trim() || truck.clientName?.trim() || "Sin empresa informada";

const hasUsablePlate = (truck: Truck) => {
  const plate = truck.plate?.trim().toLocaleUpperCase("es-CL");
  return Boolean(plate && !["--", "SIN PATENTE", "PENDIENTE", "S/P"].includes(plate));
};

const periodStart = (period: Period, now: Date) => {
  const option = periodOptions.find((item) => item.value === period);
  if (!option?.days) return null;
  const start = startOfDay(now);
  start.setDate(start.getDate() - (option.days - 1));
  return start;
};

const formatDuration = (minutes: number | null) => {
  if (minutes === null) return "Sin datos";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};

const ChartCard = ({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <article
    className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 sm:p-5 ${className}`}
  >
    <div className="mb-4">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
    </div>
    {children}
  </article>
);

const EmptyChart = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
    {children}
  </div>
);

const MetricCard = ({
  label,
  value,
  detail,
  tone = "sky",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "sky" | "emerald" | "amber" | "violet" | "slate";
}) => {
  const toneClasses = {
    sky: "border-sky-100 bg-sky-50/70 text-sky-700",
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    amber: "border-amber-100 bg-amber-50/70 text-amber-700",
    violet: "border-violet-100 bg-violet-50/70 text-violet-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];

  return (
    <article className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs leading-snug text-slate-600">{detail}</p>
    </article>
  );
};

const HorizontalBars = ({
  items,
  emptyMessage,
  colorClass = "bg-sky-500",
  total: suppliedTotal,
}: {
  items: Array<{ label: string; value: number }>;
  emptyMessage: string;
  colorClass?: string;
  total?: number;
}) => {
  if (!items.length) return <EmptyChart>{emptyMessage}</EmptyChart>;
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = suppliedTotal ?? items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3" role="list" aria-label="Datos del gráfico">
      {items.map((item) => {
        const width = (item.value / max) * 100;
        const percentage = total ? Math.round((item.value / total) * 100) : 0;
        return (
          <div key={item.label} role="listitem">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-medium text-slate-700" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                {numberFormatter.format(item.value)}
                <span className="ml-1 font-normal text-slate-400">({percentage}%)</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${colorClass}`}
                style={{ width: `${Math.max(width, item.value ? 2 : 0)}%` }}
                role="img"
                aria-label={`${item.label}: ${item.value} camiones, ${percentage}%`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const VolumeChart = ({ points }: { points: ChartPoint[] }) => {
  if (!points.length || points.every((point) => point.value === 0)) {
    return <EmptyChart>No hay ingresos con fecha válida en este período.</EmptyChart>;
  }

  const width = 720;
  const height = 230;
  const padding = { top: 20, right: 16, bottom: 38, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const xFor = (index: number) =>
    points.length === 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (points.length - 1)) * chartWidth;
  const yFor = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: xFor(index),
    y: yFor(point.value),
  }));
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = padding.top + chartHeight;
  const areaPath = `M ${coordinates[0].x} ${baseline} L ${coordinates
    .map((point) => `${point.x} ${point.y}`)
    .join(" L ")} L ${coordinates[coordinates.length - 1].x} ${baseline} Z`;
  const labelIndexes = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Volumen de ingresos: ${points.reduce(
          (sum, point) => sum + point.value,
          0,
        )} camiones. Máximo de ${maxValue} en un intervalo.`}
      >
        <title>Volumen de ingresos de camiones</title>
        <desc>Cantidad de camiones registrados a lo largo del período seleccionado.</desc>
        {[0, 0.5, 1].map((fraction) => {
          const y = padding.top + chartHeight * fraction;
          const value = Math.round(maxValue * (1 - fraction));
          return (
            <g key={fraction}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {value}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="#e0f2fe" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#0284c7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coordinates
          .filter((point) => point.value > 0)
          .map((point) => (
            <circle key={point.key} cx={point.x} cy={point.y} r="3.5" fill="#0369a1">
              <title>{`${point.label}: ${point.value} camiones`}</title>
            </circle>
          ))}
        {labelIndexes.map((index) => {
          const point = coordinates[index];
          return (
            <text
              key={point.key}
              x={point.x}
              y={height - 10}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              fontSize="11"
              fill="#64748b"
            >
              {point.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

const AreaDonut = ({ counts }: { counts: Record<DockType, number> }) => {
  const total = counts.recepcion + counts.despacho;
  if (!total) return <EmptyChart>No hay áreas registradas en este período.</EmptyChart>;
  const receptionPercentage = (counts.recepcion / total) * 100;
  const dispatchPercentage = 100 - receptionPercentage;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <div className="relative h-36 w-36 shrink-0">
        <svg
          viewBox="0 0 42 42"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`Recepción ${Math.round(receptionPercentage)}%, despacho ${Math.round(
            dispatchPercentage,
          )}%`}
        >
          <title>Distribución de camiones por área</title>
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="6"
            pathLength="100"
            strokeDasharray={`${receptionPercentage} ${dispatchPercentage}`}
          />
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="6"
            pathLength="100"
            strokeDasharray={`${dispatchPercentage} ${receptionPercentage}`}
            strokeDashoffset={-receptionPercentage}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">camiones</span>
        </div>
      </div>
      <div className="w-full max-w-48 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm bg-sky-500" aria-hidden="true" /> Recepción
          </span>
          <strong className="tabular-nums text-slate-900">
            {counts.recepcion} · {Math.round(receptionPercentage)}%
          </strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm bg-violet-500" aria-hidden="true" /> Despacho
          </span>
          <strong className="tabular-nums text-slate-900">
            {counts.despacho} · {Math.round(dispatchPercentage)}%
          </strong>
        </div>
      </div>
    </div>
  );
};

const HourlyChart = ({ counts }: { counts: number[] }) => {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return <EmptyChart>No hay horas de ingreso disponibles en este período.</EmptyChart>;
  const max = Math.max(...counts, 1);
  const peakHour = counts.indexOf(max);

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        Hora punta: <strong className="text-slate-700">{String(peakHour).padStart(2, "0")}:00</strong>
        {" · "}
        {max} {max === 1 ? "camión" : "camiones"}
      </p>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[640px] items-end gap-1.5"
          style={{ gridTemplateColumns: "repeat(24, minmax(18px, 1fr))" }}
          role="img"
          aria-label={`Ingresos por hora. La hora con mayor volumen es ${peakHour}:00 con ${max} camiones.`}
        >
          {counts.map((count, hour) => (
            <div key={hour} className="flex min-w-0 flex-col items-center justify-end gap-1">
              <span className="h-4 text-[9px] font-semibold tabular-nums text-slate-500">
                {count || ""}
              </span>
              <div className="flex h-28 w-full items-end rounded-t bg-slate-100">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-sky-600 to-cyan-400"
                  style={{ height: `${Math.max((count / max) * 100, count ? 5 : 0)}%` }}
                  title={`${String(hour).padStart(2, "0")}:00 — ${count} camiones`}
                  aria-label={`${String(hour).padStart(2, "0")}:00, ${count} camiones`}
                />
              </div>
              <span className="h-4 text-[9px] tabular-nums text-slate-500">
                {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const makeVolumePoints = (trucks: Truck[], period: Period, start: Date | null, now: Date) => {
  const datedTrucks = trucks
    .map((truck) => ({ truck, date: getArrivalDate(truck) }))
    .filter((item): item is { truck: Truck; date: Date } => item.date !== null);
  const earliest = datedTrucks.reduce<Date | null>(
    (result, item) => (!result || item.date < result ? item.date : result),
    null,
  );
  const rangeStart = start ?? earliest;
  if (!rangeStart) return [];
  const spanDays = Math.ceil((now.getTime() - rangeStart.getTime()) / 86_400_000);
  const useMonths = period === "all" && spanDays > 93;
  const counts = new Map<string, number>();

  datedTrucks.forEach(({ date }) => {
    const key = useMonths ? monthKey(date) : dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const points: ChartPoint[] = [];
  const cursor = useMonths
    ? new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    : startOfDay(rangeStart);
  const end = startOfDay(now);

  while (cursor <= end) {
    const key = useMonths ? monthKey(cursor) : dayKey(cursor);
    points.push({
      key,
      label: cursor.toLocaleDateString("es-CL", useMonths ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" }),
      value: counts.get(key) ?? 0,
    });
    if (useMonths) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  return points;
};

export const SuperAdminAnalytics = ({ trucks }: { trucks: Truck[] }) => {
  const [period, setPeriod] = useState<Period>("30d");
  const headingId = useId();

  const analytics = useMemo(() => {
    const now = new Date();
    const start = periodStart(period, now);
    const selected = trucks.filter((truck) => {
      if (!start) return true;
      const date = getArrivalDate(truck);
      return Boolean(date && date >= start && date <= now);
    });
    const today = startOfDay(now);
    const arrivalsToday = trucks.filter((truck) => {
      const date = getArrivalDate(truck);
      return Boolean(date && date >= today && date <= now);
    }).length;
    const active = trucks.filter((truck) => !completedStatuses.has(truck.status)).length;
    const completed = selected.filter((truck) => completedStatuses.has(truck.status)).length;
    const completionRate = selected.length ? Math.round((completed / selected.length) * 100) : 0;
    const cycleTimes = selected.flatMap((truck) => {
      const arrival = getArrivalDate(truck);
      const completion = getCompletionDate(truck);
      if (!arrival || !completion) return [];
      const minutes = (completion.getTime() - arrival.getTime()) / 60_000;
      return minutes >= 0 && minutes <= 60 * 24 * 14 ? [minutes] : [];
    });
    const averageCycleMinutes = cycleTimes.length
      ? cycleTimes.reduce((sum, minutes) => sum + minutes, 0) / cycleTimes.length
      : null;

    const companyCounts = new Map<string, { label: string; value: number }>();
    selected.forEach((truck) => {
      const label = companyName(truck).replace(/\s+/g, " ");
      const key = label.toLocaleLowerCase("es-CL");
      const current = companyCounts.get(key);
      companyCounts.set(key, { label: current?.label ?? label, value: (current?.value ?? 0) + 1 });
    });
    const companies = [...companyCounts.values()]
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"))
      .slice(0, 7);

    const statusCounts = new Map<TruckStatus, number>();
    selected.forEach((truck) => {
      statusCounts.set(truck.status, (statusCounts.get(truck.status) ?? 0) + 1);
    });
    const statuses = statusOrder
      .map((status) => ({ label: statusLabel[status], value: statusCounts.get(status) ?? 0 }))
      .filter((item) => item.value > 0);

    const areas: Record<DockType, number> = { recepcion: 0, despacho: 0 };
    selected.forEach((truck) => {
      if (truck.dockType === "recepcion" || truck.dockType === "despacho") {
        areas[truck.dockType] += 1;
      }
    });

    const hours = Array.from({ length: 24 }, () => 0);
    selected.forEach((truck) => {
      const date = getArrivalDate(truck);
      if (date) hours[date.getHours()] += 1;
    });

    const platesComplete = selected.filter(hasUsablePlate).length;
    const missingPlates = selected.length - platesComplete;
    const plateCoverage = selected.length ? Math.round((platesComplete / selected.length) * 100) : 0;

    let previousChange: number | null = null;
    if (start) {
      const duration = now.getTime() - start.getTime();
      const previousStart = new Date(start.getTime() - duration);
      const previousCount = trucks.filter((truck) => {
        const date = getArrivalDate(truck);
        return Boolean(date && date >= previousStart && date < start);
      }).length;
      if (previousCount > 0) {
        previousChange = Math.round(((selected.length - previousCount) / previousCount) * 100);
      }
    }

    return {
      selected,
      arrivalsToday,
      active,
      completionRate,
      averageCycleMinutes,
      cycleSampleSize: cycleTimes.length,
      previousChange,
      companies,
      statuses,
      areas,
      hours,
      missingPlates,
      plateCoverage,
      volume: makeVolumePoints(selected, period, start, now),
    };
  }, [period, trucks]);

  const selectedPeriodLabel =
    periodOptions.find((option) => option.value === period)?.label.toLocaleLowerCase("es-CL") ?? "período";
  const trendDetail =
    analytics.previousChange === null
      ? `Registros durante ${selectedPeriodLabel}`
      : `${analytics.previousChange >= 0 ? "+" : ""}${analytics.previousChange}% frente al período anterior`;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Analítica operativa</p>
          <h3 id={headingId} className="mt-1 text-xl font-semibold text-slate-900">
            Vista rápida de la instalación
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Indicadores calculados en tiempo real con los registros de camiones del sistema.
          </p>
        </div>
        <div
          className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto"
          role="group"
          aria-label="Período de las analíticas"
        >
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${
                period === option.value
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Ingresos del período"
          value={numberFormatter.format(analytics.selected.length)}
          detail={trendDetail}
          tone="sky"
        />
        <MetricCard
          label="Ingresos hoy"
          value={numberFormatter.format(analytics.arrivalsToday)}
          detail="Hasta este momento"
          tone="emerald"
        />
        <MetricCard
          label="Camiones activos"
          value={numberFormatter.format(analytics.active)}
          detail="En toda la operación"
          tone="amber"
        />
        <MetricCard
          label="Tasa de finalización"
          value={`${analytics.completionRate}%`}
          detail={`Dentro de ${selectedPeriodLabel}`}
          tone="violet"
        />
        <MetricCard
          label="Permanencia promedio"
          value={formatDuration(analytics.averageCycleMinutes)}
          detail={
            analytics.cycleSampleSize
              ? `Calculada con ${analytics.cycleSampleSize} registros completos`
              : "Requiere hora de ingreso y término"
          }
          tone="slate"
        />
        <MetricCard
          label="Patentes completas"
          value={`${analytics.plateCoverage}%`}
          detail={
            analytics.missingPlates
              ? `${analytics.missingPlates} registros requieren revisión`
              : "Todos los registros están identificados"
          }
          tone={analytics.missingPlates ? "amber" : "emerald"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Volumen de ingreso"
          description="Evolución de camiones registrados durante el período seleccionado."
          className="lg:col-span-2"
        >
          <VolumeChart points={analytics.volume} />
        </ChartCard>

        <ChartCard
          title="Empresas con más ingresos"
          description="Las siete empresas o clientes con mayor movimiento."
        >
          <HorizontalBars
            items={analytics.companies}
            emptyMessage="No hay empresas registradas en este período."
            total={analytics.selected.length}
          />
        </ChartCard>

        <ChartCard
          title="Recepción vs. despacho"
          description="Distribución del volumen según el área operativa."
        >
          <AreaDonut counts={analytics.areas} />
        </ChartCard>

        <ChartCard
          title="Estado de la operación"
          description="Cantidad de camiones en cada etapa del proceso."
        >
          <HorizontalBars
            items={analytics.statuses}
            emptyMessage="No hay estados registrados en este período."
            colorClass="bg-emerald-500"
            total={analytics.selected.length}
          />
        </ChartCard>

        <ChartCard
          title="Ingresos por hora"
          description="Distribución horaria para anticipar las horas de mayor demanda."
        >
          <HourlyChart counts={analytics.hours} />
        </ChartCard>
      </div>

      <p className="text-right text-[11px] text-slate-400">
        Datos actualizados automáticamente · La fecha prioriza el ingreso por portería y luego la creación del registro.
      </p>
    </section>
  );
};
