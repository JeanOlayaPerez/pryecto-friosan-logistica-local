import {
  arrayUnion,
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import type { TruckStatus } from '../../trucks/types';
import type { SecurityReport, SecurityReportSeed } from '../types';

const reportsCol = collection(db, 'securityReports');
const trucksCol = collection(db, 'trucks');

type ParsedTruckEvent = {
  item: SecurityReportSeed;
  occurredAt: Date;
  calendarDay: string;
  order: number;
};

type TruckVisit = {
  entry: ParsedTruckEvent;
  exit?: ParsedTruckEvent;
};

type TruckSyncStats = {
  calendarDay: string | null;
  events: number;
  entries: number;
  matched: number;
  active: number;
  orphanExits: number;
  created: number;
  updated: number;
  preservedTerminal: number;
};

const normalizeIdentifier = (value?: string) =>
  (value ?? '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');

const hasUsablePlate = (value?: string) => {
  const normalized = normalizeIdentifier(value);
  return Boolean(
    normalized &&
    !['SINPATENTE', 'NOINFORMADO', 'SINDATO', 'NA'].includes(normalized),
  );
};

const usableIdentifier = (value?: string) => {
  const normalized = normalizeIdentifier(value);
  return ['NOINFORMADO', 'SINRUT', 'SINDATO', 'NA'].includes(normalized) ? '' : normalized;
};

const normalizeName = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');

const calendarDayOf = (parsedDate: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsedDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const truckDocumentId = (entryId: string) => `security-report-${entryId.replace(/\//g, '-')}`;

const eventsMatch = (entry: SecurityReportSeed, exit: SecurityReportSeed) => {
  const entryIdentifier = usableIdentifier(entry.identifier);
  const exitIdentifier = usableIdentifier(exit.identifier);
  if (entryIdentifier && exitIdentifier && entryIdentifier === exitIdentifier) return true;

  const entryPlate = normalizeIdentifier(entry.plate);
  const exitPlate = normalizeIdentifier(exit.plate);
  if (entryPlate && exitPlate && entryPlate === exitPlate) return true;

  const entryName = normalizeName(entry.personName);
  const exitName = normalizeName(exit.personName);
  return Boolean(entryName && exitName && entryName === exitName);
};

const readExistingTrucks = async (documentIds: string[]) => {
  const existing = new Map<string, Record<string, unknown>>();
  const queryBatchSize = 30;
  for (let start = 0; start < documentIds.length; start += queryBatchSize) {
    const ids = documentIds.slice(start, start + queryBatchSize);
    const snapshot = await getDocs(query(trucksCol, where(documentId(), 'in', ids)));
    snapshot.docs.forEach((item) => existing.set(item.id, item.data()));
  }
  return existing;
};

const syncTruckReports = async (items: SecurityReportSeed[]): Promise<TruckSyncStats> => {
  const parsedItems = items.map((item, order) => {
    const occurredAt = new Date(item.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new Error(`Fecha inválida en el registro ${item.id}.`);
    }
    return {
      item,
      occurredAt,
      calendarDay: calendarDayOf(occurredAt),
      order,
    };
  });
  const truckItems = parsedItems.filter(
    (event) => event.item.category === 'truck_entry' || event.item.category === 'truck_exit',
  );
  const latestCalendarDay = truckItems.reduce<string | null>(
    (latest, item) => (!latest || item.calendarDay > latest ? item.calendarDay : latest),
    null,
  );
  const truckEvents = truckItems
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.order - b.order);

  const emptyStats: TruckSyncStats = {
    calendarDay: latestCalendarDay,
    events: truckEvents.length,
    entries: 0,
    matched: 0,
    active: 0,
    orphanExits: 0,
    created: 0,
    updated: 0,
    preservedTerminal: 0,
  };
  if (!latestCalendarDay || truckEvents.length === 0) return emptyStats;

  const visits: TruckVisit[] = [];
  const openVisits: TruckVisit[] = [];
  let orphanExits = 0;

  truckEvents.forEach((event) => {
    if (event.item.category === 'truck_entry') {
      const visit = { entry: event };
      visits.push(visit);
      openVisits.push(visit);
      return;
    }

    let matchingIndex = -1;
    // Se usa el ingreso abierto mas reciente para que un registro antiguo sin
    // salida no capture por error una visita posterior del mismo conductor.
    for (let index = openVisits.length - 1; index >= 0; index -= 1) {
      if (eventsMatch(openVisits[index].entry.item, event.item)) {
        matchingIndex = index;
        break;
      }
    }
    if (matchingIndex < 0) {
      orphanExits += 1;
      return;
    }
    const [matchingVisit] = openVisits.splice(matchingIndex, 1);
    matchingVisit.exit = event;
  });

  // Los IDs derivados del informe de ingreso hacen la reconciliacion idempotente:
  // una nueva importacion corrige el mismo camion en vez de crear otro documento.
  // Se consultan todas las visitas para poder actualizar tambien un ingreso
  // historico incompleto que ya haya sido materializado por una ejecucion previa.
  const visitDocumentIds = visits.map((visit) => truckDocumentId(visit.entry.item.id));
  const existingTrucks = await readExistingTrucks(visitDocumentIds);

  // Se materializa todo viaje con salida confirmada, aunque no pertenezca al
  // ultimo dia del lote. Los ingresos abiertos solo se crean para el dia
  // operativo mas reciente; asi, un informe historico sin salida recuperada no
  // reaparece como camion activo. Si ese documento ya existe, si se actualizan
  // sus datos de origen (por ejemplo una patente corregida) sin forzar su estado.
  const targetVisits = visits.filter((visit) => {
    const documentIdValue = truckDocumentId(visit.entry.item.id);
    return Boolean(
      visit.exit ||
      visit.entry.calendarDay === latestCalendarDay ||
      existingTrucks.has(documentIdValue),
    );
  });
  const terminalStatuses = new Set<TruckStatus>(['cerrado', 'terminado']);
  const isExistingTerminal = (visit: TruckVisit) => {
    const id = truckDocumentId(visit.entry.item.id);
    const status = existingTrucks.get(id)?.status as TruckStatus | undefined;
    return Boolean(status && terminalStatuses.has(status));
  };
  const stats: TruckSyncStats = {
    ...emptyStats,
    entries: targetVisits.length,
    matched: targetVisits.filter((visit) => visit.exit).length,
    active: targetVisits.filter((visit) => !visit.exit && !isExistingTerminal(visit)).length,
    orphanExits,
    preservedTerminal: targetVisits.filter((visit) => !visit.exit && isExistingTerminal(visit)).length,
  };
  const writeBatchSize = 400;

  for (let start = 0; start < targetVisits.length; start += writeBatchSize) {
    const batch = writeBatch(db);
    targetVisits.slice(start, start + writeBatchSize).forEach((visit) => {
      const entry = visit.entry.item;
      const entryTimestamp = Timestamp.fromDate(visit.entry.occurredAt);
      const documentIdValue = truckDocumentId(entry.id);
      const existing = existingTrucks.get(documentIdValue);
      const existingStatus = existing?.status as TruckStatus | undefined;
      const existingIsTerminal = Boolean(existingStatus && terminalStatuses.has(existingStatus));
      const sourcePlate = entry.plate?.trim().toUpperCase();
      const sourceDock = entry.dock?.trim();
      const activeStatus: TruckStatus = entry.dock ? 'en_curso' : 'en_espera';
      const initialHistory = {
        status: activeStatus,
        changedAt: entryTimestamp,
        changedByUserId: 'security-report-sync',
        changedByRole: 'system',
        note: `Ingreso sincronizado desde informe ${entry.id}.`,
      };
      const basePayload = {
        companyName: entry.company?.trim() || 'Sin empresa',
        clientName: entry.client?.trim() || entry.company?.trim() || 'Sin cliente',
        ...(
          hasUsablePlate(sourcePlate) ||
          !existing ||
          !hasUsablePlate(String(existing.plate ?? ''))
            ? { plate: hasUsablePlate(sourcePlate) ? sourcePlate : 'SIN PATENTE' }
            : {}
        ),
        driverName: entry.personName?.trim() || 'Conductor sin identificar',
        driverRut: entry.identifier?.trim() || '',
        dockType: entry.operation === 'carga' ? 'despacho' : 'recepcion',
        ...(sourceDock || !existing
          ? {
              dockNumber: sourceDock || '0',
              entryType: sourceDock ? 'anden' : 'conos',
            }
          : {}),
        scheduledArrival: entryTimestamp,
        checkInGateAt: entryTimestamp,
        checkInTime: entryTimestamp,
        createdAt: entryTimestamp,
        updatedAt: serverTimestamp(),
        hasBitacora: true,
        loadType: entry.operation ?? 'mixto',
        notes: entry.details,
        source: {
          type: 'security-report',
          provider: entry.source,
          chat: entry.sourceChat,
          entryReportId: entry.id,
          exitReportId: visit.exit?.item.id ?? null,
        },
      };
      const truckRef = doc(trucksCol, documentIdValue);

      if (!existing) {
        const terminalHistory = visit.exit
          ? {
              status: 'terminado' as const,
              changedAt: Timestamp.fromDate(visit.exit.occurredAt),
              changedByUserId: 'security-report-sync',
              changedByRole: 'system',
              note: `Salida sincronizada desde informe ${visit.exit.item.id}.`,
            }
          : null;
        batch.set(truckRef, {
          ...basePayload,
          status: visit.exit ? 'terminado' : activeStatus,
          processStartTime: entry.dock ? entryTimestamp : null,
          processEndTime: visit.exit ? Timestamp.fromDate(visit.exit.occurredAt) : null,
          history: terminalHistory ? [initialHistory, terminalHistory] : [initialHistory],
        });
        stats.created += 1;
        return;
      }

      stats.updated += 1;
      if (!visit.exit) {
        batch.set(truckRef, basePayload, { merge: true });
        return;
      }

      const exitTimestamp = Timestamp.fromDate(visit.exit.occurredAt);
      if (existingIsTerminal) {
        batch.set(
          truckRef,
          { ...basePayload, processEndTime: exitTimestamp },
          { merge: true },
        );
        return;
      }
      batch.set(
        truckRef,
        {
          ...basePayload,
          status: 'terminado',
          processEndTime: exitTimestamp,
          history: arrayUnion({
            status: 'terminado',
            changedAt: exitTimestamp,
            changedByUserId: 'security-report-sync',
            changedByRole: 'system',
            note: `Salida sincronizada desde informe ${visit.exit.item.id}.`,
          }),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }

  return stats;
};

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof (value as { toDate?: unknown })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
};

const mapReport = (id: string, data: Record<string, unknown>): SecurityReport => ({
  id,
  occurredAt: asDate(data.occurredAt) ?? new Date(0),
  timePrecision: data.timePrecision === 'date' ? 'date' : 'minute',
  category: data.category as SecurityReport['category'],
  title: String(data.title ?? 'Registro de seguridad'),
  details: String(data.details ?? ''),
  reporter: String(data.reporter ?? ''),
  personName: data.personName ? String(data.personName) : undefined,
  identifier: data.identifier ? String(data.identifier) : undefined,
  company: data.company ? String(data.company) : undefined,
  client: data.client ? String(data.client) : undefined,
  plate: data.plate ? String(data.plate) : undefined,
  operation: data.operation === 'carga' || data.operation === 'descarga' ? data.operation : undefined,
  dock: data.dock ? String(data.dock) : undefined,
  hasEvidence: Boolean(data.hasEvidence),
  review: data.review === 'review' ? 'review' : 'verified',
  sourceText: String(data.sourceText ?? ''),
  source: 'WhatsApp',
  sourceChat: 'GGSS-ReporteSeguridadFriosan',
  importedAt: asDate(data.importedAt),
  persisted: true,
});

const storedReportToSeed = (report: SecurityReport): SecurityReportSeed => ({
  id: report.id,
  occurredAt: report.occurredAt.toISOString(),
  timePrecision: report.timePrecision,
  category: report.category,
  title: report.title,
  details: report.details,
  reporter: report.reporter,
  personName: report.personName,
  identifier: report.identifier,
  company: report.company,
  client: report.client,
  plate: report.plate,
  operation: report.operation,
  dock: report.dock,
  hasEvidence: report.hasEvidence,
  review: report.review,
  sourceText: report.sourceText,
  source: report.source,
  sourceChat: report.sourceChat,
});

export const seedToReport = (item: SecurityReportSeed): SecurityReport => ({
  ...item,
  occurredAt: new Date(item.occurredAt),
  persisted: false,
});

export const subscribeSecurityReports = (
  onUpdate: (reports: SecurityReport[]) => void,
  onError?: (error: unknown) => void,
) => {
  const q = query(reportsCol, orderBy('occurredAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onUpdate(snapshot.docs.map((item) => mapReport(item.id, item.data()))),
    (error) => onError?.(error),
  );
};

export const importSecurityReports = async (items: SecurityReportSeed[]) => {
  const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()];
  const batchSize = 400;
  let imported = 0;

  for (let start = 0; start < uniqueItems.length; start += batchSize) {
    const batch = writeBatch(db);
    const chunk = uniqueItems.slice(start, start + batchSize);
    chunk.forEach((item) => {
      const { occurredAt, ...payload } = item;
      const parsedDate = new Date(occurredAt);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error(`Fecha inválida en el registro ${item.id}.`);
      }
      batch.set(
        doc(reportsCol, item.id),
        {
          ...payload,
          occurredAt: Timestamp.fromDate(parsedDate),
          importedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
    imported += chunk.length;
  }

  const verifyBatchSize = 30;
  const verifiedIds = new Set<string>();
  for (let start = 0; start < uniqueItems.length; start += verifyBatchSize) {
    const ids = uniqueItems.slice(start, start + verifyBatchSize).map((item) => item.id);
    const snapshot = await getDocs(query(reportsCol, where(documentId(), 'in', ids)));
    snapshot.docs.forEach((item) => verifiedIds.add(item.id));
  }

  if (verifiedIds.size !== uniqueItems.length) {
    throw new Error(`Firestore confirmó ${verifiedIds.size} de ${uniqueItems.length} registros.`);
  }

  // La sincronizacion usa toda la bitacora persistida, no solo el archivo de
  // esta ejecucion. Asi una salida nueva puede cerrar un ingreso importado en
  // un lote anterior, incluso cuando el movimiento cruza la medianoche.
  const persistedSnapshot = await getDocs(reportsCol);
  const persistedTruckItems = persistedSnapshot.docs
    .map((item) => mapReport(item.id, item.data()))
    .filter((item) => item.category === 'truck_entry' || item.category === 'truck_exit')
    .map(storedReportToSeed);
  const truckSync = await syncTruckReports(persistedTruckItems);

  return {
    imported,
    verified: verifiedIds.size,
    total: uniqueItems.length,
    truckSync,
  };
};
