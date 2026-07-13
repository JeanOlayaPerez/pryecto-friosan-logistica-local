import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { subscribeAllTrucks } from '../services/trucksApi';
import { addQualityRecord, uploadQualityAttachments, uploadQualitySignature } from '../services/qualityApi';
import type {
  DockType,
  QualityCondition,
  QualityDecision,
  QualityOperation,
  QualityProductType,
  QualityRecord,
  QualityStage,
  Truck,
  TruckStatus,
} from '../types';
import { useAuth } from '../../auth/AuthProvider';
import { formatDurationSince } from '../../../shared/utils/time';
import { PRODUCT_TYPE_LABELS, TEMPERATURE_RANGES, evaluateTemperature } from '../utils/temperature';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import { QualityReportPrint } from './QualityReportPrint';

const statusLabels: Record<TruckStatus, string> = {
  agendado: 'Agendado',
  en_camino: 'En camino',
  en_porteria: 'En porteria',
  en_espera: 'En espera',
  en_curso: 'En curso',
  recepcionado: 'Recepcionado',
  almacenado: 'Almacenado',
  cerrado: 'Cerrado',
  terminado: 'Terminado',
};

const conditionLabels: Record<QualityCondition, string> = {
  bueno: 'Bueno',
  observado: 'Observado',
  defectuoso: 'Defectuoso',
};

const decisionLabels: Record<QualityDecision, string> = {
  pendiente: 'Pendiente',
  acepta: 'Acepta',
  rechaza: 'Rechaza',
};

const operationLabels: Record<QualityOperation, string> = {
  carga: 'Carga',
  descarga: 'Descarga',
};

const stageLabels: Record<QualityStage, string> = {
  ingreso: 'Ingreso',
  salida: 'Salida',
};

const activeStatuses: TruckStatus[] = [
  'en_curso',
  'recepcionado',
  'almacenado',
  'cerrado',
  'terminado',
];

const canWriteRoles = ['recepcion', 'operaciones', 'calidad', 'admin', 'superadmin'];
const canViewRoles = [...canWriteRoles, 'gerencia'];

const formatHour = (value?: Date | null) => {
  if (!value) return '--';
  try {
    return value.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--';
  }
};

const formatDateTime = (value?: Date | null) => {
  if (!value) return '--';
  try {
    return value.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
};

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const buildRecordId = () =>
  `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const QualityView = () => {
  const { user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'activos' | TruckStatus | 'todos'>('activos');
  const [dockFilter, setDockFilter] = useState<'todos' | DockType>('todos');
  const [loadFilter, setLoadFilter] = useState<'todos' | 'carga' | 'descarga' | 'mixto'>('todos');
  const [openTruckId, setOpenTruckId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [reportTarget, setReportTarget] = useState<{ truck: Truck; record: QualityRecord } | null>(null);
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const [formState, setFormState] = useState({
    recordId: buildRecordId(),
    operation: 'descarga' as QualityOperation,
    stage: 'ingreso' as QualityStage,
    condition: 'bueno' as QualityCondition,
    clientDecision: 'acepta' as QualityDecision,
    cargoDescription: '',
    quantity: '',
    notes: '',
    productType: 'refrigerado' as QualityProductType,
    temperature: '',
    receivedByName: '',
  });

  const canWrite = canWriteRoles.includes(role ?? '');
  const canView = canViewRoles.includes(role ?? '');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dock = params.get('dock');
    if (dock === 'recepcion' || dock === 'despacho') {
      setDockFilter(dock);
    }
  }, [location.search]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAllTrucks(
      (data) => {
        setListenerError(null);
        setTrucks(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setListenerError('No se pudieron cargar los camiones (permisos o red).');
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trucks
      .filter((truck) => {
        if (dockFilter !== 'todos' && truck.dockType !== dockFilter) return false;
        if (statusFilter === 'activos' && !activeStatuses.includes(truck.status)) return false;
        if (statusFilter !== 'activos' && statusFilter !== 'todos' && truck.status !== statusFilter) {
          return false;
        }
        if (loadFilter !== 'todos') {
          const loadType = truck.loadType ?? 'carga';
          if (loadType !== loadFilter) return false;
        }
        if (!query) return true;
        return (
          truck.clientName.toLowerCase().includes(query) ||
          truck.plate.toLowerCase().includes(query) ||
          truck.driverName.toLowerCase().includes(query) ||
          `${truck.dockNumber}`.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aTime = a.updatedAt?.getTime() ?? a.processStartTime?.getTime() ?? 0;
        const bTime = b.updatedAt?.getTime() ?? b.processStartTime?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [trucks, dockFilter, statusFilter, loadFilter, search]);

  const stats = useMemo(() => {
    const withRecords = filtered.filter((t) => (t.qualityRecords?.length ?? 0) > 0).length;
    const defectuoso = filtered.filter((t) =>
      (t.qualityRecords ?? []).some((r) => r.condition === 'defectuoso'),
    ).length;
    const pendientes = filtered.filter((t) =>
      (t.qualityRecords ?? []).some(
        (r) => r.condition !== 'bueno' && (r.clientDecision ?? 'pendiente') === 'pendiente',
      ),
    ).length;
    return {
      total: filtered.length,
      withRecords,
      defectuoso,
      pendientes,
      enCurso: filtered.filter((t) => t.status === 'en_curso').length,
    };
  }, [filtered]);

  const openForm = (truck: Truck) => {
    const operation: QualityOperation =
      truck.loadType === 'descarga' ? 'descarga' : 'carga';
    const stage: QualityStage = operation === 'descarga' ? 'ingreso' : 'salida';
    setOpenTruckId(truck.id);
    setSelectedFiles([]);
    setFormError(null);
    setFormSuccess(null);
    setFormState({
      recordId: buildRecordId(),
      operation,
      stage,
      condition: 'bueno',
      clientDecision: 'acepta',
      cargoDescription: truck.cargoItems?.join(', ') ?? '',
      quantity: '',
      notes: '',
      productType: 'refrigerado',
      temperature: '',
      receivedByName: user?.name ?? '',
    });
    signaturePadRef.current?.clear();
  };

  const closeForm = () => {
    setOpenTruckId(null);
    setSelectedFiles([]);
    setFormError(null);
    setFormSuccess(null);
    signaturePadRef.current?.clear();
  };

  const handleSave = async (truck: Truck) => {
    if (!user || !role) return;
    setFormError(null);
    setFormSuccess(null);
    setSaving(true);
    try {
      const attachments = await uploadQualityAttachments(
        truck.id,
        formState.recordId,
        selectedFiles,
      );
      const temperatureC =
        formState.temperature.trim() === '' ? undefined : Number(formState.temperature);
      const temperatureStatus =
        evaluateTemperature(formState.productType, temperatureC) ?? undefined;
      let signatureUrl: string | undefined;
      if (!signaturePadRef.current?.isEmpty()) {
        const blob = await signaturePadRef.current?.toBlob();
        if (blob) {
          signatureUrl = await uploadQualitySignature(truck.id, formState.recordId, blob);
        }
      }
      const decision =
        formState.condition === 'bueno' ? 'acepta' : formState.clientDecision;
      await addQualityRecord(
        truck.id,
        {
          id: formState.recordId,
          operation: formState.operation,
          stage: formState.stage,
          condition: formState.condition,
          clientDecision: decision,
          cargoDescription: formState.cargoDescription,
          quantity: formState.quantity,
          notes: formState.notes,
          productType: formState.productType,
          temperatureC,
          temperatureStatus,
          receivedByName: formState.receivedByName.trim(),
          signatureUrl,
          attachments,
        },
        { userId: user.id, role },
      );
      setFormSuccess('Registro guardado.');
      setSelectedFiles([]);
      setFormState((prev) => ({
        ...prev,
        recordId: buildRecordId(),
        notes: '',
      }));
      signaturePadRef.current?.clear();
    } catch (err) {
      console.error(err);
      setFormError('No se pudo guardar el registro. Revisa permisos o conexion.');
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-300">
        No tienes acceso al modulo de calidad.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-amber-500/10 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_25%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(251,191,36,0.12),transparent_25%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Control de calidad</p>
            <h2 className="text-2xl font-bold text-white">Registro de carga y descarga</h2>
            <p className="text-sm text-slate-200">
              Controla el estado de la mercaderia al ingresar y al salir del camion.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/recepcion')}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Volver a tablero
            </button>
            <button
              type="button"
              onClick={() => navigate('/historial')}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              Ver historial
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Camiones visibles" value={`${stats.total}`} />
        <StatCard label="En curso" value={`${stats.enCurso}`} />
        <StatCard label="Con registro" value={`${stats.withRecords}`} />
        <StatCard label="Defectuosos" value={`${stats.defectuoso}`} />
        <StatCard label="Pendientes" value={`${stats.pendientes}`} />
      </div>

      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
        <div className="inline-flex rounded-full border border-white/10 bg-surface-panel/70 p-1 text-sm shadow-sm shadow-accent/10">
          {(['todos', 'recepcion', 'despacho'] as Array<'todos' | DockType>).map((dock) => (
            <button
              key={dock}
              onClick={() => setDockFilter(dock)}
              className={`rounded-full px-4 py-2 transition ${
                dockFilter === dock
                  ? 'bg-accent text-slate-900 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {dock === 'todos' ? 'Todos' : dock === 'recepcion' ? 'Recepcion' : 'Despacho'}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, patente, conductor o anden"
              className="w-full rounded-full border border-white/10 bg-surface-panel px-4 py-2 text-sm text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <label className="text-sm text-slate-300">
            Estado
            <select
              className="mt-1 rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="activos">Activos</option>
              <option value="todos">Todos</option>
              <option value="en_curso">En curso</option>
              <option value="recepcionado">Recepcionado</option>
              <option value="almacenado">Almacenado</option>
              <option value="cerrado">Cerrado</option>
              <option value="terminado">Terminado</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Operacion
            <select
              className="mt-1 rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
              value={loadFilter}
              onChange={(e) => setLoadFilter(e.target.value as any)}
            >
              <option value="todos">Todas</option>
              <option value="carga">Carga</option>
              <option value="descarga">Descarga</option>
              <option value="mixto">Mixto</option>
            </select>
          </label>
        </div>
      </div>

      {(listenerError || formError) && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {listenerError ?? formError}
        </div>
      )}

      {formSuccess && (
        <div className="rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {formSuccess}
        </div>
      )}

      {loading ? (
        <div className="glass flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 text-slate-300">
          Cargando camiones...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((truck) => {
            const records = [...(truck.qualityRecords ?? [])].sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
            const latest = records[0];
            const durationBase = truck.processStartTime ?? truck.checkInTime ?? null;
            const durationText = durationBase
              ? `${formatDurationSince(durationBase)} en proceso`
              : 'Sin inicio';
            const isOpen = openTruckId === truck.id;
            const conditionClass =
              latest?.condition === 'defectuoso'
                ? 'border-rose-500/40 bg-rose-500/10'
                : latest?.condition === 'observado'
                  ? 'border-amber-400/40 bg-amber-500/10'
                  : 'border-emerald-400/40 bg-emerald-500/10';

            return (
              <div
                key={truck.id}
                className={`glass rounded-2xl border p-4 shadow-panel ${conditionClass}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                      {statusLabels[truck.status]}
                    </p>
                    <h3 className="text-xl font-semibold text-white">{truck.clientName}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-slate-300">
                      <span className="rounded-lg bg-white/10 px-3 py-1 font-semibold text-white">
                        {truck.plate}
                      </span>
                      <span className="rounded-lg bg-white/10 px-3 py-1">{truck.driverName}</span>
                      <span className="rounded-lg bg-white/10 px-3 py-1">
                        {truck.entryType === 'anden' ? `Anden ${truck.dockNumber}` : 'Conos'}
                      </span>
                      <span className="rounded-lg bg-white/10 px-3 py-1 capitalize">
                        {truck.loadType ?? 'carga'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p>Ingreso anden</p>
                    <p className="text-sm text-white">{formatHour(truck.checkInTime)}</p>
                    <p className="mt-2">{durationText}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                  {latest ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase text-slate-400">Ultimo control</p>
                        <p className="text-base font-semibold text-white">
                          {conditionLabels[latest.condition]} - {operationLabels[latest.operation]} ({stageLabels[latest.stage]})
                        </p>
                        <p className="text-xs text-slate-400">Registrado {formatDateTime(latest.createdAt)}</p>
                        {latest.temperatureC !== undefined && (
                          <p className="mt-1 text-xs text-slate-300">
                            {latest.temperatureC}°C{' '}
                            {latest.temperatureStatus && (
                              <span
                                className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                  latest.temperatureStatus === 'ok'
                                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                }`}
                              >
                                {latest.temperatureStatus === 'ok' ? 'Dentro de rango' : 'Fuera de rango'}
                              </span>
                            )}
                          </p>
                        )}
                        {latest.receivedByName && (
                          <p className="mt-1 text-xs text-slate-400">Recibido por: {latest.receivedByName}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-300">
                        <p>Decision cliente</p>
                        <p className="text-sm text-white">
                          {decisionLabels[latest.clientDecision ?? 'pendiente']}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">Sin registros de calidad.</p>
                  )}
                </div>

                <details className="mt-4 rounded-xl border border-white/10 bg-white/5">
                  <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
                    Historial de calidad ({records.length})
                  </summary>
                  <div className="space-y-3 px-3 pb-3 pt-2 text-sm text-slate-200">
                    {records.length === 0 && <p className="text-slate-400">Sin registros previos.</p>}
                    {records.map((record) => (
                      <div key={record.id} className="rounded-xl border border-white/10 bg-slate-900/30 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs uppercase text-slate-400">
                              {operationLabels[record.operation]} - {stageLabels[record.stage]}
                            </p>
                            <p className="text-sm font-semibold text-white">
                              {conditionLabels[record.condition]}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            <p>{formatDateTime(record.createdAt)}</p>
                            <p>Decision: {decisionLabels[record.clientDecision ?? 'pendiente']}</p>
                          </div>
                        </div>
                        {record.temperatureC !== undefined && (
                          <p className="mt-2 text-xs text-slate-300">
                            Temperatura: {record.temperatureC}°C{' '}
                            {record.temperatureStatus && (
                              <span
                                className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                  record.temperatureStatus === 'ok'
                                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                }`}
                              >
                                {record.temperatureStatus === 'ok' ? 'Dentro de rango' : 'Fuera de rango'}
                              </span>
                            )}
                          </p>
                        )}
                        {record.receivedByName && (
                          <p className="mt-2 text-xs text-slate-300">
                            Recibido por: {record.receivedByName}
                          </p>
                        )}
                        {(record.cargoDescription || record.quantity) && (
                          <p className="mt-2 text-xs text-slate-300">
                            {record.cargoDescription ? `Producto: ${record.cargoDescription}` : ''}
                            {record.cargoDescription && record.quantity ? ' | ' : ''}
                            {record.quantity ? `Cantidad: ${record.quantity}` : ''}
                          </p>
                        )}
                        {record.notes && <p className="mt-2 text-xs text-slate-300">{record.notes}</p>}
                        {record.attachments && record.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {record.attachments.map((file) => (
                              <a
                                key={file.url}
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] text-slate-100 hover:bg-white/20"
                              >
                                {file.name} ({formatSize(file.size)})
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setReportTarget({ truck, record })}
                            className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] text-slate-100 hover:bg-white/20"
                          >
                            Ver informe
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {canWrite && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => (isOpen ? closeForm() : openForm(truck))}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-accent/30 hover:brightness-110"
                    >
                      {isOpen ? 'Cerrar formulario' : 'Registrar calidad'}
                    </button>
                  </div>
                )}

                {isOpen && canWrite && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-200">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-300">
                        Operacion
                        <select
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.operation}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              operation: e.target.value as QualityOperation,
                              stage: e.target.value === 'descarga' ? 'ingreso' : 'salida',
                            }))
                          }
                        >
                          <option value="descarga">Descarga</option>
                          <option value="carga">Carga</option>
                        </select>
                      </label>
                      <label className="text-sm text-slate-300">
                        Fase
                        <select
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.stage}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              stage: e.target.value as QualityStage,
                            }))
                          }
                        >
                          <option value="ingreso">Ingreso</option>
                          <option value="salida">Salida</option>
                        </select>
                      </label>
                      <label className="text-sm text-slate-300">
                        Estado
                        <select
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.condition}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              condition: e.target.value as QualityCondition,
                              clientDecision:
                                e.target.value === 'bueno'
                                  ? 'acepta'
                                  : prev.clientDecision === 'acepta'
                                    ? 'pendiente'
                                    : prev.clientDecision,
                            }))
                          }
                        >
                          <option value="bueno">Bueno</option>
                          <option value="observado">Observado</option>
                          <option value="defectuoso">Defectuoso</option>
                        </select>
                      </label>
                      <label className="text-sm text-slate-300">
                        Decision cliente
                        <select
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.clientDecision}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              clientDecision: e.target.value as QualityDecision,
                            }))
                          }
                          disabled={formState.condition === 'bueno'}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="acepta">Acepta</option>
                          <option value="rechaza">Rechaza</option>
                        </select>
                      </label>
                      <label className="text-sm text-slate-300">
                        Tipo de producto
                        <select
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.productType}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              productType: e.target.value as QualityProductType,
                            }))
                          }
                        >
                          {(Object.keys(PRODUCT_TYPE_LABELS) as QualityProductType[]).map((type) => (
                            <option key={type} value={type}>
                              {PRODUCT_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm text-slate-300">
                        Temperatura (°C)
                        <input
                          type="number"
                          step="0.1"
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.temperature}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              temperature: e.target.value,
                            }))
                          }
                          placeholder="Ej: -18"
                        />
                        {(() => {
                          const liveStatus = evaluateTemperature(
                            formState.productType,
                            formState.temperature.trim() === ''
                              ? undefined
                              : Number(formState.temperature),
                          );
                          return (
                            <>
                              {liveStatus !== null && (
                                <span
                                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                    liveStatus === 'ok'
                                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                                      : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                  }`}
                                >
                                  {liveStatus === 'ok' ? 'Dentro de rango' : 'Fuera de rango'}
                                </span>
                              )}
                              <span className="mt-1 block text-[11px] text-slate-400">
                                Rango esperado: {TEMPERATURE_RANGES[formState.productType].description}
                              </span>
                            </>
                          );
                        })()}
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-300">
                        Materia prima / producto
                        <input
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.cargoDescription}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              cargoDescription: e.target.value,
                            }))
                          }
                          placeholder="Ej: pollo congelado, cajas, pallets"
                        />
                      </label>
                      <label className="text-sm text-slate-300">
                        Cantidad
                        <input
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.quantity}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              quantity: e.target.value,
                            }))
                          }
                          placeholder="Ej: 24 pallets, 12.500 kg"
                        />
                      </label>
                      <label className="text-sm text-slate-300">
                        Recibido por
                        <input
                          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                          value={formState.receivedByName}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              receivedByName: e.target.value,
                            }))
                          }
                          placeholder="Nombre de quien recibe"
                        />
                      </label>
                    </div>

                    <label className="mt-3 block text-sm text-slate-300">
                      Observaciones
                      <textarea
                        className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white"
                        rows={3}
                        value={formState.notes}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        placeholder="Detalle de embalajes, temperatura, daños, etc."
                      />
                    </label>

                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Evidencia / archivos
                        </p>
                        <label className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/20">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              setSelectedFiles(files);
                            }}
                          />
                          Subir archivos
                        </label>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="mt-2 space-y-2 text-xs text-slate-300">
                          {selectedFiles.map((file, index) => (
                            <div
                              key={`${file.name}-${index}`}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-2 py-1"
                            >
                              <span>
                                {file.name} ({formatSize(file.size)})
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedFiles((prev) =>
                                    prev.filter((_, idx) => idx !== index),
                                  )
                                }
                                className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/10"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Firma del receptor
                        </p>
                        <button
                          type="button"
                          onClick={() => signaturePadRef.current?.clear()}
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/20"
                        >
                          Limpiar firma
                        </button>
                      </div>
                      <SignaturePad ref={signaturePadRef} className="mt-2" />
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeForm}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSave(truck)}
                        className="rounded-xl bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-emerald-950 hover:brightness-110 disabled:opacity-60"
                      >
                        {saving ? 'Guardando...' : 'Guardar registro'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-200">
              No hay camiones para los filtros seleccionados.
            </div>
          )}
        </div>
      )}

      {reportTarget && (
        <QualityReportPrint
          truck={reportTarget.truck}
          record={reportTarget.record}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="glass flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="text-base font-semibold text-white">{value}</p>
  </div>
);
