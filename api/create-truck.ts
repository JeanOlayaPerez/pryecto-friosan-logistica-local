import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

const allowedRoles = [
  'porteria',
  'recepcion',
  'operaciones',
  'calidad',
  'comercial',
  'gerencia',
  'visor',
  'clientes',
  'admin',
  'superadmin',
];

const initAdmin = () => {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error('Faltan variables FIREBASE_ADMIN_*');
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: rawKey.replace(/\\n/g, '\n'),
    }),
  });
};

const text = (value: unknown, field: string, required = false) => {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) throw Object.assign(new Error(`${field} es obligatorio.`), { status: 400 });
  if (normalized.length > 3000) throw Object.assign(new Error(`${field} es demasiado largo.`), { status: 400 });
  return normalized;
};

const isAllowedOrigin = (req: any) => {
  const origin = String(req.headers?.origin ?? '');
  if (!origin) return true;
  try {
    return new URL(origin).host === String(req.headers?.host ?? '');
  } catch {
    return false;
  }
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Origen no autorizado.', code: 'origin-denied' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'MÃ©todo no permitido.', code: 'method-not-allowed' });
    return;
  }

  const authHeader = String(req.headers?.authorization ?? '');
  const tokenMatch = authHeader.match(/^Bearer (.+)$/i);
  if (!tokenMatch) {
    res.status(401).json({ error: 'Inicia sesiÃ³n para registrar camiones.', code: 'unauthenticated' });
    return;
  }

  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(tokenMatch[1], true);
    if (decoded.firebase?.sign_in_provider === 'anonymous') {
      res.status(403).json({ error: 'El visor anÃ³nimo no puede registrar camiones.', code: 'anonymous-session' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
    const requestId = String(body.requestId ?? '');
    if (!/^[A-Za-z0-9]{20}$/.test(requestId)) {
      res.status(400).json({ error: 'Identificador de solicitud invÃ¡lido.', code: 'invalid-request-id' });
      return;
    }

    const companyName = text(body.companyName, 'Empresa', true);
    const clientName = text(body.clientName, 'Cliente', true);
    const plate = text(body.plate, 'Patente').toUpperCase();
    const driverName = text(body.driverName, 'Conductor');
    const driverRut = text(body.driverRut, 'RUT conductor');
    const guideNumber = text(body.guideNumber, 'NÃºmero de guÃ­a');
    const notes = text(body.notes, 'Notas');
    const dockType = body.dockType;
    const entryType = body.entryType === 'anden' ? 'anden' : 'conos';
    const loadType = ['carga', 'descarga', 'mixto'].includes(body.loadType) ? body.loadType : 'carga';
    const status = ['agendado', 'en_porteria', 'en_espera'].includes(body.initialStatus)
      ? body.initialStatus
      : 'en_porteria';
    const scheduledDate = new Date(body.scheduledArrival);
    const dockNumber = String(body.dockNumber ?? '0');

    if (!['recepcion', 'despacho'].includes(dockType)) {
      res.status(400).json({ error: 'Selecciona un Ã¡rea de operaciÃ³n vÃ¡lida.', code: 'invalid-dock-type' });
      return;
    }
    if (entryType === 'anden' && !/^[1-9]$/.test(dockNumber)) {
      res.status(400).json({ error: 'Selecciona un andÃ©n vÃ¡lido del 1 al 9.', code: 'invalid-dock-number' });
      return;
    }
    if (Number.isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: 'Ingresa una fecha y hora vÃ¡lidas.', code: 'invalid-scheduled-arrival' });
      return;
    }

    const db = getFirestore();
    const profile = await db.collection('users').doc(decoded.uid).get();
    const profileData = profile.data() ?? {};
    const rawRole = String(profileData.role ?? profileData.Role ?? profileData.rol ?? profileData.Rol ?? '').trim().toLowerCase();
    const actorRole = allowedRoles.includes(rawRole) ? rawRole : 'authenticated';
    const now = FieldValue.serverTimestamp();
    const historyStatusAt = Timestamp.now();
    const docRef = db.collection('trucks').doc(requestId);
    const payload = {
      clientRequestId: requestId,
      companyName,
      clientName,
      plate,
      driverName,
      driverRut,
      guideNumber,
      dockType,
      dockNumber,
      entryType,
      status,
      scheduledArrival: Timestamp.fromDate(scheduledDate),
      hasBitacora: body.hasBitacora ?? true,
      loadType,
      notes,
      delayReason: text(body.delayReason, 'Motivo de retraso'),
      guidePhotoUrl: text(body.guidePhotoUrl, 'Foto de guÃ­a'),
      pallets: body.pallets ?? null,
      boxes: body.boxes ?? null,
      kilos: body.kilos ?? null,
      price: body.price ?? null,
      cargoItems: Array.isArray(body.cargoItems) ? body.cargoItems.map((item: unknown) => text(item, 'Producto')) : [],
      qualityRecords: [],
      checkInGateAt: status === 'en_porteria' ? now : null,
      checkInTime: status === 'en_espera' || status === 'en_curso' ? now : null,
      processStartTime: status === 'en_curso' ? now : null,
      processEndTime: null,
      storedAt: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
      history: [{
        status,
        changedAt: historyStatusAt,
        changedByUserId: decoded.uid,
        changedByRole: actorRole,
        note: notes || text(body.delayReason, 'Motivo de retraso'),
      }],
    };

    try {
      await docRef.create(payload);
    } catch (error: any) {
      if (error?.code !== 6 && error?.code !== 'already-exists') throw error;
      const existing = await docRef.get();
      if (existing.data()?.clientRequestId !== requestId) {
        res.status(409).json({ error: 'El identificador ya estÃ¡ en uso. Vuelve a abrir el formulario.', code: 'request-id-conflict' });
        return;
      }
    }

    res.status(201).json({ id: requestId });
  } catch (error: any) {
    console.error('Error registrando camiÃ³n por API', error);
    const code = String(error?.code ?? 'truck-create-failed');
    const status = code.startsWith('auth/') ? 401 : Number(error?.status) || 500;
    res.status(status).json({
      error: error instanceof Error ? error.message : 'No se pudo registrar el camiÃ³n.',
      code,
    });
  }
}

