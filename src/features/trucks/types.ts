export type TruckStatus =
  | 'agendado'
  | 'en_camino'
  | 'en_porteria'
  | 'en_espera'
  | 'en_curso'
  | 'recepcionado'
  | 'almacenado'
  | 'cerrado'
  | 'terminado';
export type DockType = 'recepcion' | 'despacho';
export type EntryType = 'conos' | 'anden';

export type TruckHistoryEntry = {
  status: TruckStatus;
  changedAt: Date;
  changedByUserId: string;
  changedByRole?: string;
  note?: string;
};

export type QualityOperation = 'carga' | 'descarga';
export type QualityStage = 'ingreso' | 'salida';
export type QualityCondition = 'bueno' | 'observado' | 'defectuoso';
export type QualityDecision = 'pendiente' | 'acepta' | 'rechaza';
export type QualityProductType = 'congelado' | 'refrigerado' | 'ambiente';

export type QualityAttachment = {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
};

export type QualityRecord = {
  id: string;
  createdAt: Date;
  createdByUserId: string;
  createdByRole?: string;
  operation: QualityOperation;
  stage: QualityStage;
  condition: QualityCondition;
  clientDecision?: QualityDecision;
  cargoDescription?: string;
  quantity?: string;
  notes?: string;
  productType?: QualityProductType;
  temperatureC?: number;
  temperatureStatus?: 'ok' | 'fuera_rango';
  receivedByName?: string;
  signatureUrl?: string;
  attachments?: QualityAttachment[];
};

export interface Truck {
  id: string;
  companyName: string;
  clientName: string;
  plate: string;
  driverName: string;
  driverRut?: string;
  dockType: DockType;
  dockNumber: string | number;
  entryType?: EntryType;
  status: TruckStatus;
  scheduledArrival: Date;
  hasBitacora?: boolean;
  loadType?: 'carga' | 'descarga' | 'mixto';
  checkInGateAt?: Date | null;
  checkInTime?: Date | null;
  processStartTime?: Date | null;
  processEndTime?: Date | null;
  storedAt?: Date | null;
  closedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  notes?: string;
  delayReason?: string;
  guidePhotoUrl?: string;
  history: TruckHistoryEntry[];
  pallets?: number;
  boxes?: number;
  kilos?: number;
  price?: number;
  cargoItems?: string[];
  qualityRecords?: QualityRecord[];
}
