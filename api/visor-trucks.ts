import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const initAdmin = () => {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

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

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    initAdmin();
    const limitRaw = Number(req.query?.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

    const db = getFirestore();
    const snap = await db.collection('trucks').orderBy('createdAt', 'desc').limit(limit).get();
    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...serializeValue(doc.data()),
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      source: 'admin',
      count: data.length,
      data,
    });
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: err?.message ?? 'Error leyendo datos',
    });
  }
}
