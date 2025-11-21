import type { DockType, Truck, TruckStatus } from '../types';

export type CreateTruckInput = {
  clientName: string;
  plate: string;
  driverName: string;
  dockType: DockType;
  dockNumber: string | number;
  scheduledArrival: Date | string;
  notes?: string;
};

type Listener = () => void;

const listeners = new Set<Listener>();
const notify = () => {
  listeners.forEach((listener) => listener());
};

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// Bump key to force nueva semilla en clientes que ya tenían datos previos
const STORAGE_KEY = 'friosan-trucks-v2';

const createSeedData = (): Truck[] => {
  const now = new Date();
  return [
    {
      id: makeId(),
      clientName: 'Agrosuper',
      plate: 'ABCJ45',
      driverName: 'Miguel R.',
      dockType: 'recepcion',
      dockNumber: '3',
      status: 'en_espera',
      scheduledArrival: new Date(now.getTime() + 15 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 50 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Pérdida de temperatura en ingreso',
      history: [{ status: 'en_espera', changedAt: now, changedByUserId: 'system' }],
    },
    {
      id: makeId(),
      clientName: 'Guayarauco',
      plate: 'PTZL11',
      driverName: 'Camilo S.',
      dockType: 'despacho',
      dockNumber: '7',
      status: 'en_espera',
      scheduledArrival: new Date(now.getTime() - 10 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 70 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Falta de documentación de exportación',
      history: [{ status: 'en_espera', changedAt: now, changedByUserId: 'system' }],
    },
    {
      id: makeId(),
      clientName: 'Polar Foods',
      plate: 'MNTC33',
      driverName: 'Sebastian Q.',
      dockType: 'recepcion',
      dockNumber: '6',
      status: 'en_espera',
      scheduledArrival: new Date(now.getTime() + 5 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 35 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Retraso por inspección sanitaria',
      history: [{ status: 'en_espera', changedAt: new Date(now.getTime() - 35 * 60 * 1000), changedByUserId: 'system' }],
    },
    {
      id: makeId(),
      clientName: 'Rich Products',
      plate: 'GHJK12',
      driverName: 'Constanza L.',
      dockType: 'recepcion',
      dockNumber: '9',
      status: 'en_espera',
      scheduledArrival: new Date(now.getTime() + 25 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Esperando turno prioritario',
      history: [{ status: 'en_espera', changedAt: new Date(now.getTime() - 15 * 60 * 1000), changedByUserId: 'system' }],
    },
    {
      id: makeId(),
      clientName: 'Friosur',
      plate: 'BHFZ21',
      driverName: 'Jose P.',
      dockType: 'recepcion',
      dockNumber: '5',
      status: 'en_curso',
      scheduledArrival: new Date(now.getTime() - 30 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 50 * 60 * 1000),
      processStartTime: new Date(now.getTime() - 12 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Control de calidad en proceso',
      history: [
        { status: 'en_espera', changedAt: now, changedByUserId: 'system' },
        { status: 'en_curso', changedAt: new Date(now.getTime() - 12 * 60 * 1000), changedByUserId: 'system' },
      ],
    },
    {
      id: makeId(),
      clientName: 'FrioTruck',
      plate: 'XQRT22',
      driverName: 'Lucia M.',
      dockType: 'despacho',
      dockNumber: '4',
      status: 'en_curso',
      scheduledArrival: new Date(now.getTime() - 80 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 90 * 60 * 1000),
      processStartTime: new Date(now.getTime() - 30 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Carga de pallets mixtos',
      history: [
        { status: 'en_espera', changedAt: new Date(now.getTime() - 90 * 60 * 1000), changedByUserId: 'system' },
        { status: 'en_curso', changedAt: new Date(now.getTime() - 30 * 60 * 1000), changedByUserId: 'system' },
      ],
    },
    {
      id: makeId(),
      clientName: 'RetailMax',
      plate: 'DKLM98',
      driverName: 'Andrea V.',
      dockType: 'despacho',
      dockNumber: '1',
      status: 'terminado',
      scheduledArrival: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 2.5 * 60 * 60 * 1000),
      processStartTime: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 20 * 60 * 1000),
      processEndTime: new Date(now.getTime() - 30 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Descarga completa saludable',
      history: [
        { status: 'en_espera', changedAt: new Date(now.getTime() - 2.5 * 60 * 60 * 1000), changedByUserId: 'system' },
        { status: 'en_curso', changedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 20 * 60 * 1000), changedByUserId: 'system' },
        { status: 'terminado', changedAt: new Date(now.getTime() - 30 * 60 * 1000), changedByUserId: 'system' },
      ],
    },
    {
      id: makeId(),
      clientName: 'Andes Cargo',
      plate: 'RBLK77',
      driverName: 'Marcos D.',
      dockType: 'despacho',
      dockNumber: '8',
      status: 'terminado',
      scheduledArrival: new Date(now.getTime() - 1.5 * 60 * 60 * 1000),
      checkInTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      processStartTime: new Date(now.getTime() - 90 * 60 * 1000),
      processEndTime: new Date(now.getTime() - 20 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      notes: 'Despacho completado',
      history: [
        { status: 'en_espera', changedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), changedByUserId: 'system' },
        { status: 'en_curso', changedAt: new Date(now.getTime() - 90 * 60 * 1000), changedByUserId: 'system' },
        { status: 'terminado', changedAt: new Date(now.getTime() - 20 * 60 * 1000), changedByUserId: 'system' },
      ],
    },
  ];
};

let trucks: Truck[] = createSeedData();

const persist = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        trucks.map((t) => ({
          ...t,
          scheduledArrival: t.scheduledArrival.toISOString(),
          checkInTime: t.checkInTime?.toISOString() ?? null,
          processStartTime: t.processStartTime?.toISOString() ?? null,
          processEndTime: t.processEndTime?.toISOString() ?? null,
          createdAt: t.createdAt?.toISOString(),
          updatedAt: t.updatedAt?.toISOString(),
          history: t.history.map((h) => ({ ...h, changedAt: h.changedAt.toISOString() })),
        })),
      ),
    );
  } catch (error) {
    console.error('No se pudo guardar en localStorage', error);
  }
};

const reviveDates = (t: any): Truck => ({
  ...t,
  scheduledArrival: new Date(t.scheduledArrival),
  checkInTime: t.checkInTime ? new Date(t.checkInTime) : null,
  processStartTime: t.processStartTime ? new Date(t.processStartTime) : null,
  processEndTime: t.processEndTime ? new Date(t.processEndTime) : null,
  createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
  updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
  history: (t.history ?? []).map((h: any) => ({ ...h, changedAt: new Date(h.changedAt) })),
});

(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Truck[];
      trucks = parsed.map(reviveDates);
    } else {
      persist();
    }
  } catch (error) {
    console.warn('No se cargo el estado local, usando datos de ejemplo', error);
  }
})();

const normalizeDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export const resetTrucks = () => {
  trucks = createSeedData();
  persist();
  notify();
};

export const subscribeTrucksByDockType = (
  dockType: DockType,
  onUpdate: (trucks: Truck[]) => void,
) => {
  const handler = () => {
    const filtered = trucks
      .filter((t) => t.dockType === dockType)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    onUpdate(filtered);
  };

  listeners.add(handler);
  handler(); // initial push

  return () => listeners.delete(handler);
};

export const createTruck = async (input: CreateTruckInput) => {
  const now = new Date();
  const newTruck: Truck = {
    id: makeId(),
    clientName: input.clientName,
    plate: input.plate.toUpperCase(),
    driverName: input.driverName,
    dockType: input.dockType,
    dockNumber: String(input.dockNumber),
    status: 'en_espera',
    scheduledArrival: normalizeDate(input.scheduledArrival),
    checkInTime: now,
    createdAt: now,
    updatedAt: now,
    notes: input.notes,
    history: [
      {
        status: 'en_espera',
        changedAt: now,
        changedByUserId: 'system',
      },
    ],
  };

  trucks = [newTruck, ...trucks];
  persist();
  notify();
};

export const updateTruckStatus = async (
  truckId: string,
  newStatus: TruckStatus,
  userId: string,
) => {
  const now = new Date();
  trucks = trucks.map((t) => {
    if (t.id !== truckId) return t;

    const next: Truck = {
      ...t,
      status: newStatus,
      updatedAt: now,
      history: [...t.history, { status: newStatus, changedAt: now, changedByUserId: userId }],
    };

    if (newStatus === 'en_curso' && !t.processStartTime) {
      next.processStartTime = now;
    }
    if (newStatus === 'terminado') {
      next.processEndTime = now;
    }

    return next;
  });

  persist();
  notify();
};

export const updateTruckDetails = async (
  truckId: string,
  update: Partial<CreateTruckInput>,
) => {
  const now = new Date();
  trucks = trucks.map((t) =>
    t.id === truckId
      ? {
          ...t,
          ...update,
          dockNumber: update.dockNumber !== undefined ? String(update.dockNumber) : t.dockNumber,
          scheduledArrival: update.scheduledArrival
            ? normalizeDate(update.scheduledArrival)
            : t.scheduledArrival,
          updatedAt: now,
        }
      : t,
  );
  persist();
  notify();
};

export const flagTruckDelay = async (truckId: string, reason: string) => {
  trucks = trucks.map((t) =>
    t.id === truckId
      ? {
          ...t,
          notes: reason,
          updatedAt: new Date(),
        }
      : t,
  );
  persist();
  notify();
};
