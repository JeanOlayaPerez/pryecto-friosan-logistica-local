import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
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
  const batchSize = 400;
  let imported = 0;

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = writeBatch(db);
    const chunk = items.slice(start, start + batchSize);
    chunk.forEach((item) => {
      const { occurredAt, ...payload } = item;
      batch.set(
        doc(reportsCol, item.id),
        {
          ...payload,
          occurredAt: Timestamp.fromDate(new Date(occurredAt)),
          importedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
    imported += chunk.length;
  }

  return imported;
};
