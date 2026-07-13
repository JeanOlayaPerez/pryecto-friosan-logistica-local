import type {
  QualityCondition,
  QualityDecision,
  QualityOperation,
  QualityRecord,
  QualityStage,
  Truck,
} from '../types';
import { PRODUCT_TYPE_LABELS, TEMPERATURE_RANGES } from '../utils/temperature';

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

const conditionColors: Record<QualityCondition, string> = {
  bueno: '#047857',
  observado: '#b45309',
  defectuoso: '#be123c',
};

const formatFullDateTime = (value?: Date | null) => {
  if (!value) return '--';
  try {
    return value.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value || '--'}</p>
  </div>
);

export const QualityReportPrint = ({
  truck,
  record,
  onClose,
}: {
  truck: Truck;
  record: QualityRecord;
  onClose: () => void;
}) => {
  const checkIn = truck.checkInTime ?? truck.checkInGateAt;
  const tempRange = record.productType ? TEMPERATURE_RANGES[record.productType] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6">
      <div className="w-full max-w-3xl">
        <div className="no-print mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-accent/30 hover:brightness-110"
          >
            Imprimir / Descargar PDF
          </button>
        </div>

        <div id="quality-report-print" className="rounded-2xl bg-white p-8 text-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              <img src="/friosan-logo.png" alt="Friosan" className="h-14 w-auto object-contain" />
              <div>
                <p className="text-lg font-bold text-gray-900">Friosan SPA</p>
                <p className="text-xs uppercase tracking-widest text-gray-500">Planta de frio</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-gray-900">Informe de Control de Calidad</p>
              <p className="text-xs text-gray-500">Registro N {record.id}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Datos del camion</p>
            <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-3">
              <Field label="Empresa / Cliente" value={truck.companyName || truck.clientName} />
              <Field label="Patente" value={truck.plate} />
              <Field label="Conductor" value={truck.driverName} />
              <Field label="RUT conductor" value={truck.driverRut ?? '--'} />
              <Field
                label="Anden / Conos"
                value={truck.entryType === 'anden' ? `Anden ${truck.dockNumber}` : 'Conos'}
              />
              <Field label="Ingreso" value={formatFullDateTime(checkIn)} />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Datos del control</p>
            <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-3">
              <Field
                label="Operacion"
                value={`${operationLabels[record.operation]} (${stageLabels[record.stage]})`}
              />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Condicion</p>
                <p className="text-sm font-bold" style={{ color: conditionColors[record.condition] }}>
                  {conditionLabels[record.condition]}
                </p>
              </div>
              <Field
                label="Tipo de producto"
                value={record.productType ? PRODUCT_TYPE_LABELS[record.productType] : '--'}
              />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Temperatura</p>
                {record.temperatureC !== undefined ? (
                  <p className="text-sm font-medium text-gray-900">
                    {record.temperatureC} C
                    {record.temperatureStatus && (
                      <span
                        className="ml-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={
                          record.temperatureStatus === 'ok'
                            ? { backgroundColor: '#d1fae5', color: '#047857' }
                            : { backgroundColor: '#ffe4e6', color: '#be123c' }
                        }
                      >
                        {record.temperatureStatus === 'ok' ? 'Dentro de rango' : 'Fuera de rango'}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-gray-900">--</p>
                )}
                {tempRange && (
                  <p className="text-[11px] text-gray-500">Rango esperado: {tempRange.description}</p>
                )}
              </div>
              <Field label="Cantidad" value={record.quantity ?? '--'} />
              <Field
                label="Decision del cliente"
                value={decisionLabels[record.clientDecision ?? 'pendiente']}
              />
              <div className="col-span-3">
                <Field label="Descripcion de carga" value={record.cargoDescription ?? '--'} />
              </div>
              <div className="col-span-3">
                <Field label="Observaciones" value={record.notes ?? '--'} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Receptor</p>
            <p className="mt-2 text-sm font-medium text-gray-900">
              {record.receivedByName || 'No especificado'}
            </p>
            {record.signatureUrl ? (
              <img
                src={record.signatureUrl}
                alt="Firma del receptor"
                className="mt-2 h-24 w-auto rounded border border-gray-200 bg-white object-contain"
              />
            ) : (
              <p className="mt-1 text-xs text-gray-500">Sin firma registrada</p>
            )}
          </div>

          {record.attachments && record.attachments.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Fotos / evidencia
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {record.attachments.map((file) =>
                  file.type.startsWith('image/') ? (
                    <img
                      key={file.url}
                      src={file.url}
                      alt={file.name}
                      className="h-32 w-full rounded border border-gray-200 object-cover"
                    />
                  ) : (
                    <a
                      key={file.url}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-32 items-center justify-center rounded border border-gray-200 px-2 text-center text-xs text-gray-700 underline"
                    >
                      {file.name}
                    </a>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-500">
            <p>
              Registrado por rol {record.createdByRole ?? 'sistema'} el {formatFullDateTime(record.createdAt)}
            </p>
            <p>Informe generado el {formatFullDateTime(new Date())}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
