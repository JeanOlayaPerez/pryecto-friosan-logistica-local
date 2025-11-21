export type TruckStatus = 'en_espera' | 'en_curso' | 'terminado';
export type DockType = 'recepcion' | 'despacho';

export type TruckHistoryEntry = {
  status: TruckStatus;
  changedAt: Date;
  changedByUserId: string;
};

export interface Truck {
  id: string;
  clientName: string;
  plate: string;
  driverName: string;
  dockType: DockType;
  dockNumber: string | number;
  status: TruckStatus;
  scheduledArrival: Date;
  checkInTime?: Date | null;
  processStartTime?: Date | null;
  processEndTime?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  notes?: string;
  history: TruckHistoryEntry[];
}
