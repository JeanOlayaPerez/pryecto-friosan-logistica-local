type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const fail = (message: string, status = 400, code = 'invalid-request') =>
  Object.assign(new Error(message), { status, code });

const text = (value: unknown, field: string, required = false) => {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) throw fail(`${field} es obligatorio.`);
  if (normalized.length > 3000) throw fail(`${field} es demasiado largo.`);
  return normalized;
};

const stringValue = (value: unknown) => ({ stringValue: String(value ?? '') });
const timestampValue = (value: string | null) =>
  value ? { timestampValue: value } : { nullValue: 'NULL_VALUE' };
const nullableNumberValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return { nullValue: 'NULL_VALUE' };
  const number = Number(value);
  if (!Number.isFinite(number)) throw fail('Uno de los valores numéricos no es válido.');
  return Number.isInteger(number) ? { integerValue: String(number) } : { doubleValue: number };
const booleanValue = (value: unknown) => ({ booleanValue: Boolean(value) });

const isAllowedOrigin = (req: any) => {
  const origin = String(req.headers?.origin ?? '');
  if (!origin) return true;
  try {
    return new URL(origin).host === String(req.headers?.host ?? '');
  } catch {
    return false;
  }
};

const getFirebaseClaims = (token: string) => {
  try {
    const payload = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!payload) throw new Error('missing payload');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    const projectId = String(claims.aud ?? '');
    if (
      !/^[a-z][a-z0-9-]{4,29}$/.test(projectId) ||
      claims.iss !== `https://securetoken.google.com/${projectId}` ||
      !claims.sub
    ) {
      throw new Error('invalid Firebase token claims');
    }
    return { projectId, uid: String(claims.sub), provider: claims.firebase?.sign_in_provider };
  } catch {
    throw fail('La sesión venció o el token no es válido. Vuelve a iniciar sesión.', 401, 'unauthenticated');
  }
};

const serializeFields = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value]));

export default async function handler(req: any, res: JsonResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Origen no autorizado.', code: 'origin-denied' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.', code: 'method-not-allowed' });
    return;
  }

  const authHeader = String(req.headers?.authorization ?? '');
  const tokenMatch = authHeader.match(/^Bearer (.+)$/i);
  if (!tokenMatch) {
    res.status(401).json({ error: 'Inicia sesión para registrar camiones.', code: 'unauthenticated' });
    return;
  }

  try {
    const identity = getFirebaseClaims(tokenMatch[1]);
    if (identity.provider === 'anonymous') {
      throw fail('El visor anónimo no puede registrar camiones.', 403, 'anonymous-session');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
    const requestId = String(body.requestId ?? '');
    if (!/^[A-Za-z0-9]{20}$/.test(requestId)) {
      throw fail('Identificador de solicitud inválido.', 400, 'invalid-request-id');
    }

    const companyName = text(body.companyName, 'Empresa', true);
    const clientName = text(body.clientName, 'Cliente', true);
    const plate = text(body.plate, 'Patente').toUpperCase();
    const driverName = text(body.driverName, 'Conductor');
    const driverRut = text(body.driverRut, 'RUT conductor');
    const guideNumber = text(body.guideNumber, 'Número de guía');
    const notes = text(body.notes, 'Notas');
    const delayReason = text(body.delayReason, 'Motivo de retraso');
    const guidePhotoUrl = text(body.guidePhotoUrl, 'Foto de guía');
    const dockType = body.dockType;
    const entryType = body.entryType === 'anden' ? 'anden' : 'conos';
    const loadType = ['carga', 'descarga', 'mixto'].includes(body.loadType) ? body.loadType : 'carga';
    const status = ['agendado', 'en_porteria', 'en_espera'].includes(body.initialStatus)
      ? body.initialStatus
      : 'en_porteria';
    const scheduledDate = new Date(body.scheduledArrival);
    const dockNumber = String(body.dockNumber ?? '0');

    if (!['recepcion', 'despacho'].includes(dockType)) {
      throw fail('Selecciona un área de operación válida.');
    }
    if (entryType === 'anden' && !/^[1-9]$/.test(dockNumber)) {
      throw fail('Selecciona un andén válido del 1 al 9.');
    }
    if (Number.isNaN(scheduledDate.getTime())) {
      throw fail('Ingresa una fecha y hora válidas.');
    }

    const now = new Date().toISOString();
    const scheduledArrival = scheduledDate.toISOString();
    const fields = serializeFields({
      clientRequestId: stringValue(requestId),
      companyName: stringValue(companyName),
      clientName: stringValue(clientName),
      plate: stringValue(plate),
      driverName: stringValue(driverName),
      driverRut: stringValue(driverRut),
      guideNumber: stringValue(guideNumber),
      dockType: stringValue(dockType),
      dockNumber: stringValue(dockNumber),
      entryType: stringValue(entryType),
      status: stringValue(status),
      scheduledArrival: timestampValue(scheduledArrival),
      hasBitacora: booleanValue(body.hasBitacora ?? true),
      loadType: stringValue(loadType),
      notes: stringValue(notes),
      delayReason: stringValue(delayReason),
      guidePhotoUrl: stringValue(guidePhotoUrl),
      pallets: nullableNumberValue(body.pallets),
      boxes: nullableNumberValue(body.boxes),
      kilos: nullableNumberValue(body.kilos),
      price: nullableNumberValue(body.price),
      cargoItems: {
        arrayValue: {
          values: Array.isArray(body.cargoItems)
            ? body.cargoItems.map((item: unknown) => stringValue(text(item, 'Producto')))
            : [],
        },
      },
      qualityRecords: { arrayValue: { values: [] } },
      checkInGateAt: timestampValue(status === 'en_porteria' ? now : null),
      checkInTime: timestampValue(status === 'en_espera' ? now : null),
      processStartTime: timestampValue(null),
      processEndTime: timestampValue(null),
      storedAt: timestampValue(null),
      closedAt: timestampValue(null),
      createdAt: timestampValue(now),
      updatedAt: timestampValue(now),
      history: {
        arrayValue: {
          values: [{
            mapValue: {
              fields: {
                status: stringValue(status),
                changedAt: timestampValue(now),
                changedByUserId: stringValue(identity.uid),
                changedByRole: stringValue('authenticated'),
                note: stringValue(notes || delayReason),
              },
            },
          }],
        },
      },
    });

    const documentUrl = `https://firestore.googleapis.com/v1/projects/${identity.projectId}/databases/(default)/documents/trucks/${requestId}`;
    const writeResponse = await fetch(`${documentUrl}?currentDocument.exists=false`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenMatch[1]}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (writeResponse.ok) {
      res.status(201).json({ id: requestId });
      return;
    }

    const writeError = await writeResponse.json().catch(() => ({}));
    if (writeResponse.status === 409) {
      const existingResponse = await fetch(documentUrl, {
        headers: { Authorization: `Bearer ${tokenMatch[1]}` },
      });
      const existing = await existingResponse.json().catch(() => ({}));
      if (existing.fields?.clientRequestId?.stringValue === requestId) {
        res.status(200).json({ id: requestId });
        return;
      }
      throw fail('El identificador ya está en uso. Vuelve a abrir el formulario.', 409, 'request-id-conflict');
    }

    const firestoreStatus = String(writeError?.error?.status ?? 'UNKNOWN');
    const status = writeResponse.status === 403 ? 403 : writeResponse.status >= 500 ? 502 : 400;
    const errorMessage = writeResponse.status === 403
      ? 'Firebase rechazó el registro. Verifica los permisos de creación de camiones en Firestore.'
      : `Firebase no pudo guardar el camión (${firestoreStatus}). ${String(writeError?.error?.message ?? '').slice(0, 240)}`;
    throw fail(errorMessage, status, `firestore-${firestoreStatus.toLowerCase()}`);
  } catch (error: any) {
    console.error('Error registrando camión por API', error);
    const status = Number(error?.status) || 500;
    res.status(status).json({
      error: error instanceof Error ? error.message : 'No se pudo registrar el camión.',
      code: String(error?.code ?? 'truck-create-failed'),
    });
  }
}
