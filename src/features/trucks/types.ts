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
}
