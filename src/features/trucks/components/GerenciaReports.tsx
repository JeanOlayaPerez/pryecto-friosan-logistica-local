import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { subscribeAllTrucks } from '../services/trucksApi';
import type { Truck, TruckStatus } from '../types';
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

const parseDateInput = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const formatShortDate = (value: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
};

const formatShortDateWithYear = (value: Date) => {
  const key = formatDateInput(value);
  const short = formatShortDate(key);
  return `${short}/${value.getFullYear()}`;
};

const timeOrDash = (d?: Date | null) =>
  d ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
const dateOrDash = (d?: Date | null) =>
  d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '--';

const reportColumns = [
  { key: 'idx', label: 'Cod. Usuario' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'bitacora', label: 'C/S Bitacora' },
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

type CustomRange = 'dia' | 'semana' | 'mes' | 'anio';
type CustomMetric = 'empresa' | 'total' | 'top_camiones' | 'top_volumen';

type CustomSummary = {
  title: string;
  detail: string;
  topCompanies: Array<{ name: string; count: number; volume: number }>;
  volumeLabel: string;
  showVolume: boolean;
};

type LineSeries = {
  label: string;
  values: number[];
  color: string;
};

type LineChartData = {
  labels: string[];
  series: LineSeries[];
};

type StatusSlice = {
  key: TruckStatus;
  label: string;
  color: string;
  count: number;
  pct: number;
};

type DockWaitItem = {
  dock: string;
  avg: number;
  count: number;
};

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
  pallets?: number;
  boxes?: number;
  kilos?: number;
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
    {
      id: 'demo-15',
      companyName: 'Agrosuper',
      clientName: 'Agrosuper',
      plate: 'LNR501',
      driverName: 'Sebastian Silva',
      dockType: 'recepcion',
      dockNumber: 2,
      entryType: 'conos',
      status: 'en_espera',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: -3,
      scheduled: '15:10',
      checkInGate: '14:40',
      checkIn: '14:55',
      updated: '16:10',
      pallets: 24,
      kilos: 12000,
    },
    {
      id: 'demo-16',
      companyName: 'Soprole',
      clientName: 'Soprole',
      plate: 'QWT332',
      driverName: 'Rocio Diaz',
      dockType: 'despacho',
      dockNumber: 6,
      entryType: 'anden',
      status: 'en_curso',
      hasBitacora: true,
      loadType: 'descarga',
      dayOffset: -5,
      scheduled: '09:15',
      checkInGate: '09:00',
      checkIn: '09:05',
      updated: '11:45',
      boxes: 480,
    },
    {
      id: 'demo-17',
      companyName: 'Frutera Sur',
      clientName: 'Frutera Sur',
      plate: 'PQA772',
      driverName: 'Carolina Baeza',
      dockType: 'despacho',
      dockNumber: 4,
      entryType: 'conos',
      status: 'terminado',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: -8,
      scheduled: '18:00',
      checkInGate: '17:30',
      checkIn: '17:40',
      updated: '20:00',
      pallets: 30,
    },
    {
      id: 'demo-18',
      companyName: 'Donihue',
      clientName: 'Donihue',
      plate: 'VRT219',
      driverName: 'Marco Lopez',
      dockType: 'recepcion',
      dockNumber: 5,
      entryType: 'anden',
      status: 'recepcionado',
      hasBitacora: true,
      loadType: 'mixto',
      dayOffset: -10,
      scheduled: '10:30',
      checkInGate: '10:05',
      checkIn: '10:20',
      updated: '12:00',
      kilos: 7800,
    },
    {
      id: 'demo-19',
      companyName: 'Pacific Fresh',
      clientName: 'Pacific Fresh',
      plate: 'KTP118',
      driverName: 'Natalia Rios',
      dockType: 'recepcion',
      dockNumber: 1,
      entryType: 'conos',
      status: 'en_porteria',
      hasBitacora: true,
      loadType: 'descarga',
      dayOffset: -14,
      scheduled: '06:20',
      checkInGate: '06:10',
      checkIn: '06:15',
      updated: '07:05',
      kilos: 6200,
    },
    {
      id: 'demo-20',
      companyName: 'Del Monte',
      clientName: 'Del Monte',
      plate: 'XCL209',
      driverName: 'Bruno Tapia',
      dockType: 'despacho',
      dockNumber: 3,
      entryType: 'anden',
      status: 'cerrado',
      hasBitacora: true,
      loadType: 'mixto',
      dayOffset: -21,
      scheduled: '10:10',
      checkInGate: '09:45',
      checkIn: '09:55',
      updated: '11:50',
      pallets: 16,
    },
    {
      id: 'demo-21',
      companyName: 'Copefrut',
      clientName: 'Copefrut',
      plate: 'HJD445',
      driverName: 'Oscar Vargas',
      dockType: 'recepcion',
      dockNumber: 7,
      entryType: 'anden',
      status: 'agendado',
      hasBitacora: false,
      loadType: 'carga',
      dayOffset: -28,
      scheduled: '12:45',
      pallets: 14,
    },
    {
      id: 'demo-22',
      companyName: 'Agro Norte',
      clientName: 'Agro Norte',
      plate: 'MNV663',
      driverName: 'Lorena Fuentes',
      dockType: 'recepcion',
      dockNumber: 5,
      entryType: 'anden',
      status: 'en_camino',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: -35,
      scheduled: '05:20',
      boxes: 300,
    },
    {
      id: 'demo-23',
      companyName: 'Sopravol',
      clientName: 'Sopravol',
      plate: 'ZBD909',
      driverName: 'Valeria Acevedo',
      dockType: 'recepcion',
      dockNumber: 6,
      entryType: 'anden',
      status: 'almacenado',
      hasBitacora: true,
      loadType: 'descarga',
      dayOffset: -45,
      scheduled: '16:00',
      checkInGate: '15:30',
      checkIn: '15:45',
      updated: '18:10',
      boxes: 540,
    },
    {
      id: 'demo-24',
      companyName: 'Lacteos Sur',
      clientName: 'Lacteos Sur',
      plate: 'BKM981',
      driverName: 'Hector Soto',
      dockType: 'recepcion',
      dockNumber: 9,
      entryType: 'anden',
      status: 'terminado',
      hasBitacora: true,
      loadType: 'mixto',
      dayOffset: -60,
      scheduled: '07:30',
      checkInGate: '07:05',
      checkIn: '07:15',
      updated: '09:30',
      kilos: 9100,
    },
    {
      id: 'demo-25',
      companyName: 'Frutera Central',
      clientName: 'Frutera Central',
      plate: 'VPL781',
      driverName: 'Cecilia Ramos',
      dockType: 'recepcion',
      dockNumber: 4,
      entryType: 'anden',
      status: 'cerrado',
      hasBitacora: true,
      loadType: 'mixto',
      dayOffset: -90,
      scheduled: '08:05',
      checkInGate: '07:50',
      checkIn: '08:00',
      updated: '09:40',
      pallets: 20,
    },
    {
      id: 'demo-26',
      companyName: 'Alta Fruta',
      clientName: 'Alta Fruta',
      plate: 'JRS330',
      driverName: 'Matias Ponce',
      dockType: 'despacho',
      dockNumber: 2,
      entryType: 'conos',
      status: 'en_espera',
      hasBitacora: true,
      loadType: 'carga',
      dayOffset: -120,
      scheduled: '11:25',
      checkInGate: '10:50',
      checkIn: '11:05',
      updated: '12:40',
      kilos: 7000,
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
      pallets: seed.pallets,
      boxes: seed.boxes,
      kilos: seed.kilos,
      history: [],
    };
  });
};

const linePalette = ['#0f172a', '#0ea5e9', '#f97316', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b'];

const statusMeta: Array<{ key: TruckStatus; label: string; color: string }> = [
  { key: 'agendado', label: 'Agendado', color: '#94a3b8' },
  { key: 'en_camino', label: 'En camino', color: '#38bdf8' },
  { key: 'en_porteria', label: 'En porteria', color: '#f59e0b' },
  { key: 'en_espera', label: 'En espera', color: '#f97316' },
  { key: 'en_curso', label: 'En curso', color: '#0ea5e9' },
  { key: 'recepcionado', label: 'Recepcionado', color: '#22c55e' },
  { key: 'almacenado', label: 'Almacenado', color: '#14b8a6' },
  { key: 'cerrado', label: 'Cerrado', color: '#64748b' },
  { key: 'terminado', label: 'Terminado', color: '#10b981' },
];

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

  const [customRange, setCustomRange] = useState<CustomRange>('semana');
  const [customMetric, setCustomMetric] = useState<CustomMetric>('empresa');
  const [customCompany, setCustomCompany] = useState('');
  const [customDay, setCustomDay] = useState<string>('');

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

  const getEntryDate = (t: Truck) => {
    return t.checkInGateAt ?? t.checkInTime ?? t.scheduledArrival ?? t.createdAt ?? null;
  };

  const latestEntryDate = useMemo(() => {
    const dates = sourceTrucks
      .map((t) => getEntryDate(t))
      .filter((value): value is Date => Boolean(value));
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }, [sourceTrucks]);

  useEffect(() => {
    if (customDay) return;
    const base = latestEntryDate ?? new Date();
    setCustomDay(formatDateInput(base));
  }, [customDay, latestEntryDate]);

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

  const companyOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        sourceTrucks
          .map((t) => t.clientName || t.companyName)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    names.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    return names;
  }, [sourceTrucks]);
  useEffect(() => {
    if (customMetric !== 'empresa') return;
    if (customCompany) return;
    if (!companyOptions.length) return;
    setCustomCompany(companyOptions[0]);
  }, [customMetric, customCompany, companyOptions]);

  const customRangeDates = useMemo(() => {
    let base = customDay ? new Date(customDay) : latestEntryDate ?? new Date();
    if (Number.isNaN(base.getTime())) base = latestEntryDate ?? new Date();
    base.setHours(0, 0, 0, 0);

    let start = new Date(base);
    let end = new Date(base);

    if (customRange === 'semana') {
      const dayOfWeek = (base.getDay() + 6) % 7;
      start.setDate(base.getDate() - dayOfWeek);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (customRange === 'mes') {
      start = new Date(base.getFullYear(), base.getMonth(), 1);
      end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    } else if (customRange === 'anio') {
      start = new Date(base.getFullYear(), 0, 1);
      end = new Date(base.getFullYear(), 11, 31);
    }

    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [customDay, customRange, latestEntryDate]);

  const customRangeLabel = useMemo(() => {
    const startKey = formatDateInput(customRangeDates.start);
    const endKey = formatDateInput(customRangeDates.end);
    if (startKey === endKey) {
      return formatShortDateWithYear(customRangeDates.start);
    }
    return `${formatShortDateWithYear(customRangeDates.start)} - ${formatShortDateWithYear(customRangeDates.end)}`;
  }, [customRangeDates]);

  const customFiltered = useMemo(() => {
    return sourceTrucks.filter((t) => {
      const entry = getEntryDate(t);
      if (!entry) return false;
      return entry >= customRangeDates.start && entry <= customRangeDates.end;
    });
  }, [sourceTrucks, customRangeDates]);

  const customSummary = useMemo<CustomSummary>(() => {
    const total = customFiltered.length;
    const volumeMode = customFiltered.some((t) => typeof t.kilos === 'number')
      ? 'kilos'
      : customFiltered.some((t) => typeof t.pallets === 'number')
        ? 'pallets'
        : customFiltered.some((t) => typeof t.boxes === 'number')
          ? 'boxes'
          : 'count';

    const volumeLabel =
      volumeMode === 'kilos' ? 'kg' : volumeMode === 'pallets' ? 'pallets' : volumeMode === 'boxes' ? 'cajas' : 'camiones';

    const byCompany: Record<string, { count: number; volume: number }> = {};
    let totalVolume = 0;

    customFiltered.forEach((t) => {
      const name = t.clientName || t.companyName || 'Sin cliente';
      if (!byCompany[name]) byCompany[name] = { count: 0, volume: 0 };
      byCompany[name].count += 1;

      let volume = 1;
      if (volumeMode === 'kilos') volume = typeof t.kilos === 'number' ? t.kilos : 0;
      if (volumeMode === 'pallets') volume = typeof t.pallets === 'number' ? t.pallets : 0;
      if (volumeMode === 'boxes') volume = typeof t.boxes === 'number' ? t.boxes : 0;
      if (volumeMode === 'count') volume = 1;

      byCompany[name].volume += volume;
      totalVolume += volume;
    });

    const sortedByCount = Object.entries(byCompany).sort((a, b) => b[1].count - a[1].count);
    const sortedByVolume = Object.entries(byCompany).sort((a, b) => b[1].volume - a[1].volume);
    const topCompanies = sortedByCount.slice(0, 5).map(([name, data]) => ({
      name,
      count: data.count,
      volume: data.volume,
    }));
    const showVolume = volumeMode !== 'count';
    const selectedCompany = customCompany || companyOptions[0] || '';
    const selectedData = selectedCompany ? byCompany[selectedCompany] ?? { count: 0, volume: 0 } : null;
    const topByCount = sortedByCount[0];
    const topByVolume = sortedByVolume[0];

    if (!total) {
      return {
        title: 'Sin datos para el rango',
        detail: `Rango: ${customRangeLabel}`,
        topCompanies,
        volumeLabel,
        showVolume,
      };
    }

    if (customMetric === 'total') {
      const volumeDetail =
        volumeMode === 'count' ? '' : ` | Volumen total: ${Math.round(totalVolume)} ${volumeLabel}`;
      return {
        title: `Total de camiones: ${total}`,
        detail: `Rango: ${customRangeLabel}${volumeDetail}`,
        topCompanies,
        volumeLabel,
        showVolume,
      };
    }

    if (customMetric === 'empresa') {
      if (!selectedCompany) {
        return {
          title: 'Selecciona una empresa',
          detail: `Rango: ${customRangeLabel}`,
          topCompanies,
          volumeLabel,
          showVolume,
        };
      }
      const volumeDetail =
        volumeMode === 'count' ? '' : ` | Volumen: ${Math.round(selectedData?.volume ?? 0)} ${volumeLabel}`;
      return {
        title: `${selectedCompany}: ${selectedData?.count ?? 0} camiones`,
        detail: `Rango: ${customRangeLabel}${volumeDetail}`,
        topCompanies,
        volumeLabel,
        showVolume,
      };
    }

    if (customMetric === 'top_camiones') {
      if (!topByCount) {
        return {
          title: 'Sin datos para ranking',
          detail: `Rango: ${customRangeLabel}`,
          topCompanies,
          volumeLabel,
          showVolume,
        };
      }
      return {
        title: `Empresa con mas camiones: ${topByCount[0]} (${topByCount[1].count})`,
        detail: `Rango: ${customRangeLabel}`,
        topCompanies,
        volumeLabel,
        showVolume,
      };
    }

    if (!topByVolume) {
      return {
        title: 'Sin datos para volumen',
        detail: `Rango: ${customRangeLabel}`,
        topCompanies,
        volumeLabel,
        showVolume,
      };
    }

    return {
      title: `Empresa con mayor volumen: ${topByVolume[0]} (${Math.round(topByVolume[1].volume)} ${volumeLabel})`,
      detail: `Rango: ${customRangeLabel}`,
      topCompanies,
      volumeLabel,
      showVolume,
    };
  }, [customFiltered, customRangeLabel, customMetric, customCompany, companyOptions]);

  const metricsRangeLabel = metricsRange === '7d' ? 'Ultimos 7 dias' : 'Dia seleccionado';

  const trendData = useMemo<LineChartData>(() => {
    const windowDays = metricsRange === '7d' ? 7 : 6;
    const endDate = day ? new Date(day) : new Date();
    endDate.setHours(0, 0, 0, 0);

    const labels: string[] = [];
    for (let i = windowDays - 1; i >= 0; i -= 1) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      labels.push(formatDateInput(d));
    }

    const labelSet = new Set(labels);
    const byClient: Record<string, Record<string, number>> = {};

    baseFiltered.forEach((t) => {
      const source = getDaySource(t);
      if (!source) return;
      const key = formatDateInput(source);
      if (!labelSet.has(key)) return;
      const client = t.clientName || t.companyName || 'Sin cliente';
      if (!byClient[client]) byClient[client] = {};
      byClient[client][key] = (byClient[client][key] ?? 0) + 1;
    });

    const totals = Object.entries(byClient).map(([label, values]) => ({
      label,
      total: Object.values(values).reduce((sum, value) => sum + value, 0),
    }));
    totals.sort((a, b) => b.total - a.total);

    const mainClients = totals.slice(0, 6).map((item) => item.label);
    const restClients = totals.slice(6).map((item) => item.label);

    const series: LineSeries[] = mainClients.map((client, idx) => ({
      label: client,
      values: labels.map((key) => byClient[client]?.[key] ?? 0),
      color: linePalette[idx % linePalette.length],
    }));

    if (restClients.length) {
      const values = labels.map((key) =>
        restClients.reduce((sum, client) => sum + (byClient[client]?.[key] ?? 0), 0),
      );
      series.push({
        label: 'Otros',
        values,
        color: linePalette[mainClients.length % linePalette.length],
      });
    }

    return { labels, series };
  }, [baseFiltered, day, metricsRange, reportType, bitacoraFilter]);

  const trendRangeLabel = useMemo(() => {
    if (!trendData.labels.length) return 'Sin rango';
    const start = formatShortDate(trendData.labels[0]);
    const end = formatShortDate(trendData.labels[trendData.labels.length - 1]);
    return start === end ? start : `${start} - ${end}`;
  }, [trendData.labels]);

  const statusData = useMemo(() => {
    const total = metricsSource.length;
    const counts = new Map<TruckStatus, number>();
    metricsSource.forEach((t) => {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    });
    const series: StatusSlice[] = statusMeta.map((meta) => {
      const count = counts.get(meta.key) ?? 0;
      return {
        ...meta,
        count,
        pct: total ? (count / total) * 100 : 0,
      };
    });
    return { total, series };
  }, [metricsSource]);

  const dockWaitRows = useMemo<DockWaitItem[]>(() => {
    const byDock: Record<string, number[]> = {};
    metricsSource.forEach((t) => {
      if (!t.dockNumber) return;
      if (!t.checkInGateAt || !t.checkInTime) return;
      const wait = minutesBetween(t.checkInGateAt, t.checkInTime);
      if (!Number.isFinite(wait)) return;
      const dockKey = `A-${t.dockNumber}`;
      if (!byDock[dockKey]) byDock[dockKey] = [];
      byDock[dockKey].push(wait);
    });

    const rows = Object.entries(byDock).map(([dock, waits]) => ({
      dock,
      avg: Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length),
      count: waits.length,
    }));
    rows.sort((a, b) => b.avg - a.avg);
    return rows.slice(0, 6);
  }, [metricsSource]);

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
    if (key === 'bitacora') return row.bitacora ? 'Con' : 'Sin';
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
              <CalendarInput
                value={day}
                onChange={(value) => setDay(value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reportes personalizados</p>
            <p className="text-xs text-slate-500">Rango: {customRangeLabel}</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Periodo</p>
              <select
                value={customRange}
                onChange={(e) => setCustomRange(e.target.value as CustomRange)}
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              >
                <option value="dia">Dia</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
                <option value="anio">Anio</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Indicador</p>
              <select
                value={customMetric}
                onChange={(e) => setCustomMetric(e.target.value as CustomMetric)}
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              >
                <option value="empresa">Camiones por empresa</option>
                <option value="total">Camiones en total</option>
                <option value="top_camiones">Empresa con mas camiones</option>
                <option value="top_volumen">Empresa con mayor volumen</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Empresa</p>
              <select
                value={customCompany}
                onChange={(e) => setCustomCompany(e.target.value)}
                disabled={customMetric !== 'empresa'}
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Selecciona empresa</option>
                {companyOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fecha base</p>
              <CalendarInput
                value={customDay}
                onChange={(value) => setCustomDay(value)}
              />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resultado</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{customSummary.title}</p>
            <p className="text-sm text-slate-600">{customSummary.detail}</p>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Top empresas</p>
            {customSummary.topCompanies.length > 0 ? (
              <div className="mt-2 space-y-2">
                {customSummary.topCompanies.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-sm text-slate-700">
                    <span className="max-w-[220px] truncate">
                      {idx + 1}. {item.name}
                    </span>
                    <span className="text-right">
                      {item.count} camiones
                      {customSummary.showVolume ? ` | ${Math.round(item.volume)} ${customSummary.volumeLabel}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Sin datos para el periodo.</p>
            )}
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

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Graficos de gestion</p>
            <p className="text-xs text-slate-500">Rango: {metricsRangeLabel}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              title="Flujo por cliente"
              description={`Conteo diario (${trendRangeLabel})`}
              className="lg:col-span-2"
            >
              <LineChart labels={trendData.labels} series={trendData.series} />
            </ChartCard>
            <ChartCard
              title="Estado de procesos"
              description={`Distribucion de estados (${metricsRangeLabel})`}
            >
              <StatusStack total={statusData.total} series={statusData.series} />
            </ChartCard>
            <ChartCard
              title="Espera promedio por anden"
              description={`Minutos promedio por anden (${metricsRangeLabel})`}
              className="lg:col-span-3"
            >
              <DockWaitList rows={dockWaitRows} />
            </ChartCard>
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
                  <th className="border border-slate-200 px-3 py-2">
                    <span className="block">C/S</span>
                    <span className="block">Bitacora</span>
                  </th>
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
                    <td className="border border-slate-200 px-3 py-2 text-center">{r.bitacora ? 'Con' : 'Sin'}</td>
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
const ChartCard = ({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: JSX.Element | JSX.Element[];
  className?: string;
}) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
    {label}
  </div>
);

const LineChart = ({ labels, series }: { labels: string[]; series: LineSeries[] }) => {
  const hasData = series.some((item) => item.values.some((value) => value > 0));
  if (!labels.length || !series.length || !hasData) {
    return <EmptyState label="Sin datos para graficar." />;
  }

  const width = 640;
  const height = 260;
  const padding = { top: 16, right: 18, bottom: 36, left: 46 };
  const values = series.flatMap((item) => item.values);
  const maxValue = Math.max(1, ...values);
  const steps = 4;
  const stepValue = Math.ceil(maxValue / steps) || 1;
  const maxTick = stepValue * steps;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xStep = innerWidth / Math.max(1, labels.length - 1);

  const getX = (index: number) => padding.left + index * xStep;
  const getY = (value: number) => padding.top + (maxTick - value) * (innerHeight / maxTick);

  const ticks = Array.from({ length: steps + 1 }, (_, idx) => idx * stepValue);

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Grafico de lineas">
        <rect x="0" y="0" width={width} height={height} fill="white" />
        {ticks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                {tick}
              </text>
            </g>
          );
        })}
        <line
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke="#cbd5e1"
        />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
          stroke="#cbd5e1"
        />
        {labels.map((label, idx) => (
          <text
            key={`${label}-${idx}`}
            x={getX(idx)}
            y={height - padding.bottom + 16}
            textAnchor="middle"
            className="fill-slate-400 text-[10px]"
          >
            {formatShortDate(label)}
          </text>
        ))}
        {series.map((item) => {
          const path = item.values
            .map((value, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(value)}`)
            .join(' ');
          return (
            <g key={item.label}>
              <path d={path} fill="none" stroke={item.color} strokeWidth="2" />
              {item.values.map((value, idx) => (
                <circle key={`${item.label}-${idx}`} cx={getX(idx)} cy={getY(value)} r="3" fill={item.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <LineLegend series={series} />
    </div>
  );
};

const LineLegend = ({ series }: { series: LineSeries[] }) => (
  <div className="flex flex-wrap gap-3 text-xs text-slate-600">
    {series.map((item) => (
      <div key={item.label} className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="max-w-[140px] truncate">{item.label}</span>
      </div>
    ))}
  </div>
);

const StatusStack = ({ total, series }: { total: number; series: StatusSlice[] }) => {
  if (!total) {
    return <EmptyState label="Sin datos para estados." />;
  }
  const visible = series.filter((item) => item.count > 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {visible.map((item) => (
          <div key={item.key} style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
        ))}
      </div>
      <div className="grid gap-2">
        {series.map((item) => (
          <div key={item.key} className="flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </div>
            <span>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DockWaitList = ({ rows }: { rows: DockWaitItem[] }) => {
  if (!rows.length) {
    return <EmptyState label="Sin datos de espera." />;
  }
  const maxAvg = Math.max(1, ...rows.map((row) => row.avg));
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = Math.min(100, (row.avg / maxAvg) * 100);
        return (
          <div key={row.dock}>
            <div className="flex items-center justify-between text-xs text-slate-700">
              <span>{row.dock}</span>
              <span>
                {row.avg} min ({row.count})
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
const CalendarInput = ({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => parseDateInput(value) ?? new Date());
  const selectedDate = parseDateInput(value);
  const displayValue = selectedDate ? formatShortDateWithYear(selectedDate) : 'Seleccionar fecha';

  useEffect(() => {
    const parsed = parseDateInput(value);
    if (parsed) setViewDate(parsed);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const weekLabels = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
  const monthLabel = `${monthLabels[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const offset = (startOfMonth.getDay() + 6) % 7;
  const startCell = new Date(startOfMonth);
  startCell.setDate(startOfMonth.getDate() - offset);
  const selectedKey = value;

  const cells = Array.from({ length: 42 }, (_, idx) => {
    const cellDate = new Date(startCell);
    cellDate.setDate(startCell.getDate() + idx);
    return {
      key: formatDateInput(cellDate),
      day: cellDate.getDate(),
      inMonth: cellDate.getMonth() === viewDate.getMonth(),
    };
  });

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
      >
        <span>{displayValue}</span>
        <span className="text-xs text-slate-400">Calendario</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            >
              Ant
            </button>
            <span className="text-sm font-semibold text-slate-700">{monthLabel}</span>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            >
              Sig
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
            {weekLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center">
            {cells.map((cell) => {
              const isSelected = cell.key === selectedKey;
              return (
                <button
                  type="button"
                  key={cell.key}
                  className={`h-8 w-8 rounded-full text-xs ${
                    cell.inMonth ? 'text-slate-700' : 'text-slate-300'
                  } ${isSelected ? 'bg-sky-500 text-white' : 'hover:bg-slate-100'}`}
                  onClick={() => {
                    onChange(cell.key);
                    setOpen(false);
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-slate-600 hover:text-slate-900"
              onClick={() => {
                const today = new Date();
                onChange(formatDateInput(today));
                setViewDate(today);
                setOpen(false);
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              className="text-xs text-slate-600 hover:text-slate-900"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
