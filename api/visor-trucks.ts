import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

const getAllowedOrigins = () => [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

const isAllowedOrigin = (req: any) => {
  const origin = String(req.headers?.origin ?? '');
  if (!origin) return true;
  try {
    if (new URL(origin).host === String(req.headers?.host ?? '')) return true;
  } catch {
    return false;
  }
  return getAllowedOrigins().includes(origin);
};

const applyCors = (req: any, res: any) => {
  const origin = String(req.headers?.origin ?? '');
  if (origin && isAllowedOrigin(req)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  res.setHeader('Cache-Control', 'no-store');
};

const initAdmin = () => {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error('Faltan variables FIREBASE_ADMIN_*');
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
};

const serializeValue = (value: any): any => {
  if (value == null) return value;
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeValue(v)]));
  }
  return value;
};

// Solo los campos que necesitan los tableros visor/monitor. Se excluyen a
// proposito driverRut, driverName, notes, delayReason, price, pallets, boxes,
// kilos, cargoItems, history, qualityRecords y guidePhotoUrl por ser datos
// personales, comerciales o internos que esas pantallas no muestran.
const sanitizeTruck = (raw: Record<string, any>) => ({
  id: raw.id,
  companyName: raw.companyName ?? null,
  clientName: raw.clientName ?? null,
  plate: raw.plate ?? null,
  dockType: raw.dockType ?? null,
  dockNumber: raw.dockNumber ?? null,
  entryType: raw.entryType ?? null,
  status: raw.status ?? null,
  loadType: raw.loadType ?? null,
  hasBitacora: raw.hasBitacora ?? null,
  scheduledArrival: raw.scheduledArrival ?? null,
  checkInGateAt: raw.checkInGateAt ?? null,
  checkInTime: raw.checkInTime ?? null,
  processStartTime: raw.processStartTime ?? null,
  processEndTime: raw.processEndTime ?? null,
  storedAt: raw.storedAt ?? null,
  closedAt: raw.closedAt ?? null,
  createdAt: raw.createdAt ?? null,
  updatedAt: raw.updatedAt ?? null,
});

export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(isAllowedOrigin(req) ? 204 : 403).end();
    return;
  }

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Origen no autorizado.' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = String(req.headers?.authorization ?? '');
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Falta token de autenticacion' });
      return;
    }

    initAdmin();
    await getAuth().verifyIdToken(match[1]);

    const limitRaw = Number(req.query?.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

    const db = getFirestore();
    const trucks = db.collection('trucks');
    let snap = await trucks.orderBy('createdAt', 'desc').limit(limit).get();
    // Firestore omite de una consulta ordenada los documentos antiguos que no
    // tienen createdAt. Una respuesta vacia debe intentar la lectura simple.
    if (snap.empty) snap = await trucks.limit(limit).get();
    const data = snap.docs.map((doc) => sanitizeTruck({ id: doc.id, ...serializeValue(doc.data()) }));

    res.status(200).json({
      source: 'admin',
      count: data.length,
      data,
    });
  } catch (err: any) {
    const isAuthError = typeof err?.code === 'string' && err.code.startsWith('auth/');
    res.status(isAuthError ? 401 : 500).json({
      error: isAuthError ? 'Token invalido o expirado' : 'Error leyendo datos',
    });
  }
}
