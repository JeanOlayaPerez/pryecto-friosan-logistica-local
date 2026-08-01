import {
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
import type { SecurityReport, SecurityReportSeed } from '../types';

const reportsCol = collection(db, 'securityReports');

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

  return { imported, verified: verifiedIds.size, total: uniqueItems.length };
};
