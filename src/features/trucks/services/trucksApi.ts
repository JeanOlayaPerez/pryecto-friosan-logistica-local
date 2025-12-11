import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import type { UserRole } from '../../auth/AuthProvider';
import type { DockType, Truck, TruckStatus } from '../types';

export type CreateTruckInput = {
  companyName: string;
  clientName: string;
  plate: string;
  driverName: string;
  driverRut?: string;
  dockType: DockType;
  dockNumber: string | number;
  entryType?: 'conos' | 'anden';
  scheduledArrival: Date | string;
  loadType?: 'carga' | 'descarga' | 'mixto';
  notes?: string;
  delayReason?: string;
  guidePhotoUrl?: string;
  initialStatus?: TruckStatus;
};

type Actor = { userId: string; role: UserRole | null };

const trucksCol = collection(db, 'trucks');

const asDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
};

const toTimestamp = (value: Date | string) => {
  const as = value instanceof Date ? value : new Date(value);
  return Timestamp.fromDate(as);
};

const mapTruck = (snap: any): Truck => {
  const data = snap.data();
  return {
    id: snap.id,
    companyName: data.companyName ?? data.clientName,
    clientName: data.clientName,
    plate: data.plate,
    driverName: data.driverName,
    driverRut: data.driverRut,
    dockType: data.dockType,
    dockNumber: data.dockNumber,
    entryType: data.entryType,
    status: data.status,
    scheduledArrival: asDate(data.scheduledArrival) ?? new Date(),
    loadType: data.loadType,
    checkInGateAt: asDate(data.checkInGateAt),
    checkInTime: asDate(data.checkInTime),
    processStartTime: asDate(data.processStartTime),
    processEndTime: asDate(data.processEndTime),
    storedAt: asDate(data.storedAt),
    closedAt: asDate(data.closedAt),
    createdAt: asDate(data.createdAt) ?? undefined,
    updatedAt: asDate(data.updatedAt) ?? undefined,
    notes: data.notes,
    delayReason: data.delayReason,
    guidePhotoUrl: data.guidePhotoUrl,
    history: (data.history ?? []).map((h: any) => ({
      status: h.status,
      changedAt: asDate(h.changedAt) ?? new Date(),
      changedByUserId: h.changedByUserId ?? 'system',
      changedByRole: h.changedByRole,
      note: h.note,
    })),
  };
};

const historyEntry = (status: TruckStatus, actor?: Actor, note?: string) => ({
  status,
  changedAt: Timestamp.now(),
  changedByUserId: actor?.userId ?? 'system',
  changedByRole: actor?.role ?? 'system',
  note: note ?? '',
});

export const subscribeTrucksByDockType = (
  dockType: DockType,
  onUpdate: (trucks: Truck[]) => void,
  onError?: (error: unknown) => void,
) => {
  const q = query(trucksCol, where('dockType', '==', dockType), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map(mapTruck));
    },
    (err) => {
      console.error('Error en listener de trucks', err);
      onError?.(err);
    },
  );
  return unsub;
};

export const subscribeAllTrucks = (
  onUpdate: (trucks: Truck[]) => void,
  onError?: (error: unknown) => void,
) => {
  const q = query(trucksCol, orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map(mapTruck)),
    (err) => {
      console.error('Error en listener de trucks', err);
      onError?.(err);
    },
  );
  return unsub;
};

export const createTruck = async (input: CreateTruckInput, actor?: Actor) => {
  const status: TruckStatus = input.initialStatus ?? 'en_porteria';
  const now = serverTimestamp();

  await addDoc(trucksCol, {
    companyName: input.companyName.trim(),
    clientName: input.clientName.trim(),
    plate: input.plate.trim().toUpperCase(),
    driverName: input.driverName.trim(),
    driverRut: input.driverRut?.trim() ?? '',
    dockType: input.dockType,
    dockNumber: String(input.dockNumber),
    entryType: input.entryType ?? 'conos',
    status,
    scheduledArrival: toTimestamp(input.scheduledArrival),
    loadType: input.loadType ?? 'carga',
    notes: input.notes ?? '',
    delayReason: input.delayReason ?? '',
    guidePhotoUrl: input.guidePhotoUrl ?? '',
    checkInGateAt: status === 'en_porteria' ? now : null,
    checkInTime: status === 'en_espera' || status === 'en_curso' ? now : null,
    processStartTime: status === 'en_curso' ? now : null,
    processEndTime: null,
    storedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    history: [historyEntry(status, actor, input.notes ?? input.delayReason)],
  });
};

export const updateTruckStatus = async (
  truckId: string,
  newStatus: TruckStatus,
  actor: Actor,
  note?: string,
) => {
  const ref = doc(trucksCol, truckId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Truck not found');
  const data = snap.data();
  const now = serverTimestamp();

  const patch: Record<string, any> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === 'en_espera' && !data.checkInTime) patch.checkInTime = now;
  if (newStatus === 'en_curso' && !data.processStartTime) patch.processStartTime = now;
  if ((newStatus === 'recepcionado' || newStatus === 'terminado') && !data.processEndTime) {
    patch.processEndTime = now;
  }
  if (newStatus === 'almacenado' && !data.storedAt) patch.storedAt = now;
  if (newStatus === 'cerrado' && !data.closedAt) patch.closedAt = now;

  await updateDoc(ref, {
    ...patch,
    history: arrayUnion(historyEntry(newStatus, actor, note)),
  });
};

export const updateTruckDetails = async (
  truckId: string,
  update: Partial<CreateTruckInput>,
  _actor?: Actor,
) => {
  const ref = doc(trucksCol, truckId);
  const now = serverTimestamp();
  const payload: Record<string, any> = {
    updatedAt: now,
  };

  if (update.clientName !== undefined) payload.clientName = update.clientName.trim();
  if (update.plate !== undefined) payload.plate = update.plate.trim().toUpperCase();
  if (update.driverName !== undefined) payload.driverName = update.driverName.trim();
  if (update.driverRut !== undefined) payload.driverRut = update.driverRut.trim();
  if (update.dockType !== undefined) payload.dockType = update.dockType;
  if (update.dockNumber !== undefined) payload.dockNumber = String(update.dockNumber);
  if (update.entryType !== undefined) payload.entryType = update.entryType;
  if (update.scheduledArrival !== undefined) {
    payload.scheduledArrival = toTimestamp(update.scheduledArrival);
  }
  if (update.notes !== undefined) payload.notes = update.notes;
  if (update.loadType !== undefined) payload.loadType = update.loadType;
  if (update.guidePhotoUrl !== undefined) payload.guidePhotoUrl = update.guidePhotoUrl;

  await updateDoc(ref, payload);
};

export const flagTruckDelay = async (truckId: string, reason: string, actor?: Actor) => {
  const ref = doc(trucksCol, truckId);
  const now = serverTimestamp();
  await updateDoc(ref, {
    delayReason: reason,
    notes: reason,
    updatedAt: now,
    history: arrayUnion(historyEntry('en_espera', actor, reason)),
  });
};

export const resetTrucks = async () => {
  console.warn('resetTrucks is disabled for Firestore. Seed data in the database if needed.');
};

export const deleteTruck = async (truckId: string) => {
  const ref = doc(trucksCol, truckId);
  await deleteDoc(ref);
};
