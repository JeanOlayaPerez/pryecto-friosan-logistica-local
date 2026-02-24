import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  collection as collectionLite,
  getDocs as getDocsLite,
  orderBy as orderByLite,
  query as queryLite,
} from 'firebase/firestore/lite';
import { db, dbLite } from '../../../shared/config/firebase';
import type { UserRole } from '../../auth/AuthProvider';
import type {
  DockType,
  QualityAttachment,
  QualityRecord,
  Truck,
  TruckStatus,
} from '../types';

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
  hasBitacora?: boolean;
  loadType?: 'carga' | 'descarga' | 'mixto';
  notes?: string;
  delayReason?: string;
  guidePhotoUrl?: string;
  initialStatus?: TruckStatus;
  pallets?: number;
  boxes?: number;
  kilos?: number;
  price?: number;
  cargoItems?: string[];
};

type Actor = { userId: string; role: UserRole | null };

const trucksCol = collection(db, 'trucks');
const trucksColLite = collectionLite(dbLite, 'trucks');

const asDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
};

const toTimestamp = (value: Date | string) => {
  const as = value instanceof Date ? value : new Date(value);
  return Timestamp.fromDate(as);
};

const mapQualityAttachment = (value: any): QualityAttachment => ({
  name: value?.name ?? 'archivo',
  url: value?.url ?? '',
  type: value?.type ?? '',
  size: typeof value?.size === 'number' ? value.size : Number(value?.size ?? 0),
  uploadedAt: asDate(value?.uploadedAt) ?? new Date(),
});

const mapQualityRecord = (value: any, index: number): QualityRecord => {
  const operation = value?.operation === 'carga' ? 'carga' : 'descarga';
  const stage =
    value?.stage === 'salida'
      ? 'salida'
      : value?.stage === 'ingreso'
        ? 'ingreso'
        : operation === 'carga'
          ? 'salida'
          : 'ingreso';
  const condition =
    value?.condition === 'defectuoso'
      ? 'defectuoso'
      : value?.condition === 'observado'
        ? 'observado'
        : 'bueno';
  return {
    id: value?.id ?? `quality-${index}`,
    createdAt: asDate(value?.createdAt) ?? new Date(),
    createdByUserId: value?.createdByUserId ?? 'system',
    createdByRole: value?.createdByRole,
    operation,
    stage,
    condition,
    clientDecision: value?.clientDecision ?? undefined,
    cargoDescription: value?.cargoDescription ?? '',
    quantity: value?.quantity ?? '',
    notes: value?.notes ?? '',
    attachments: Array.isArray(value?.attachments)
      ? value.attachments.map(mapQualityAttachment)
      : [],
  };
};

const mapTruckData = (id: string, data: any): Truck => {
  return {
    id,
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
    hasBitacora: typeof data.hasBitacora === 'boolean' ? data.hasBitacora : true,
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
    pallets: data.pallets,
    boxes: data.boxes,
    kilos: data.kilos,
    price: data.price,
    cargoItems: data.cargoItems ?? [],
    qualityRecords: Array.isArray(data.qualityRecords)
      ? data.qualityRecords.map(mapQualityRecord)
      : [],
    history: (data.history ?? []).map((h: any) => ({
      status: h.status,
      changedAt: asDate(h.changedAt) ?? new Date(),
      changedByUserId: h.changedByUserId ?? 'system',
      changedByRole: h.changedByRole,
      note: h.note,
    })),
  };
};

const mapTruck = (snap: any): Truck => mapTruckData(snap.id, snap.data());

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

export type FetchTrucksResult = {
  data: Truck[];
  source: string;
  error?: string;
};

const asSorted = (data: Truck[]) =>
  data.sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });

const fetchAllTrucksLite = async (): Promise<FetchTrucksResult> => {
  try {
    const q = queryLite(trucksColLite, orderByLite('createdAt', 'desc'));
    const snap = await getDocsLite(q);
    return { data: snap.docs.map(mapTruck), source: 'lite-order' };
  } catch (err) {
    console.warn('Fallo lectura lite con orderBy', err);
  }

  const snap = await getDocsLite(trucksColLite);
  return { data: asSorted(snap.docs.map(mapTruck)), source: 'lite-plain' };
};

const fetchAllTrucksFromApi = async (): Promise<FetchTrucksResult> => {
  if (typeof fetch !== 'function' || typeof window === 'undefined') {
    throw new Error('fetch no soportado');
  }
  const url = `${window.location.origin}/api/visor-trucks?limit=200`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`API status ${resp.status}`);
  }
  const payload = await resp.json();
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return {
    data: asSorted(items.map((item: any) => mapTruckData(item.id, item))),
    source: payload?.source ? `api-${payload.source}` : 'api',
  };
};

export const fetchAllTrucksOnce = async (options?: {
  preferLite?: boolean;
  preferApi?: boolean;
}): Promise<FetchTrucksResult> => {
  const errors: string[] = [];

  if (options?.preferApi) {
    try {
      const apiResult = await fetchAllTrucksFromApi();
      if (apiResult.data.length > 0) return apiResult;
      errors.push('api: sin datos');
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'api error');
    }
  }

  if (options?.preferLite) {
    try {
      const lite = await fetchAllTrucksLite();
      if (lite.data.length > 0) return lite;
      errors.push('lite: sin datos');
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'lite error');
    }
  }

  try {
    const q = query(trucksCol, orderBy('createdAt', 'desc'));
    const snap = await getDocsFromServer(q);
    return { data: snap.docs.map(mapTruck), source: 'server-order' };
  } catch (err) {
    console.warn('Fallo query server con orderBy, intentando cache/local', err);
    errors.push(err instanceof Error ? err.message : 'server-order error');
  }

  try {
    const q = query(trucksCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return { data: snap.docs.map(mapTruck), source: 'cache-order' };
  } catch (err) {
    console.warn('Fallo query con orderBy, usando lectura simple', err);
    errors.push(err instanceof Error ? err.message : 'cache-order error');
  }

  try {
    const snap = await getDocsFromServer(trucksCol);
    return { data: asSorted(snap.docs.map(mapTruck)), source: 'server-plain' };
  } catch (err) {
    console.warn('Fallo lectura server simple, usando cache/local', err);
    errors.push(err instanceof Error ? err.message : 'server-plain error');
  }

  const snap = await getDocs(trucksCol);
  return {
    data: asSorted(snap.docs.map(mapTruck)),
    source: 'cache-plain',
    error: errors.length ? errors.join(' | ') : undefined,
  };
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
    hasBitacora: input.hasBitacora ?? true,
    loadType: input.loadType ?? 'carga',
    notes: input.notes ?? '',
    delayReason: input.delayReason ?? '',
    guidePhotoUrl: input.guidePhotoUrl ?? '',
    pallets: input.pallets ?? null,
    boxes: input.boxes ?? null,
    kilos: input.kilos ?? null,
    price: input.price ?? null,
    cargoItems: input.cargoItems ?? [],
    qualityRecords: [],
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
  const statusOrder: TruckStatus[] = [
    'agendado',
    'en_camino',
    'en_porteria',
    'en_espera',
    'en_curso',
    'recepcionado',
    'almacenado',
    'cerrado',
    'terminado',
  ];
  const currentStatus = data.status as TruckStatus | undefined;
  const currentIndex = currentStatus ? statusOrder.indexOf(currentStatus) : -1;
  const nextIndex = statusOrder.indexOf(newStatus);
  const isBackward = currentIndex !== -1 && nextIndex !== -1 && nextIndex < currentIndex;

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
  if (isBackward) {
    patch.entryType = 'conos';
    patch.dockNumber = '0';
  }

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
  if (update.hasBitacora !== undefined) payload.hasBitacora = update.hasBitacora;
  if (update.notes !== undefined) payload.notes = update.notes;
  if (update.loadType !== undefined) payload.loadType = update.loadType;
  if (update.guidePhotoUrl !== undefined) payload.guidePhotoUrl = update.guidePhotoUrl;
  if (update.pallets !== undefined) payload.pallets = update.pallets;
  if (update.boxes !== undefined) payload.boxes = update.boxes;
  if (update.kilos !== undefined) payload.kilos = update.kilos;
  if (update.price !== undefined) payload.price = update.price;
  if (update.cargoItems !== undefined) payload.cargoItems = update.cargoItems;

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
