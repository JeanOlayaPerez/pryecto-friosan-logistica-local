import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];
const ALLOWED_ROLES = [
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
] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

const getAllowedOrigins = () => [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
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

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: rawKey.replace(/\\n/g, '\n'),
    }),
  });
};

const parseBody = (req: any): Record<string, unknown> => {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new RequestError(400, 'El cuerpo de la solicitud no es JSON válido.');
    }
  }
  return req.body;
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const normalizeRole = (value: unknown): AllowedRole | null => {
  const role = String(value ?? '').trim().toLowerCase();
  return ALLOWED_ROLES.includes(role as AllowedRole) ? (role as AllowedRole) : null;
};

const requiredText = (value: unknown, label: string, maxLength: number) => {
  const text = String(value ?? '').trim();
  if (!text) throw new RequestError(400, `${label} es obligatorio.`);
  if (text.length > maxLength) {
    throw new RequestError(400, `${label} supera el máximo de ${maxLength} caracteres.`);
  }
  return text;
};

const normalizeEmail = (value: unknown) => {
  const email = requiredText(value, 'El correo', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError(400, 'Ingresa un correo válido.');
  }
  return email;
};

const normalizePassword = (value: unknown, required: boolean) => {
  const password = String(value ?? '');
  if (!password && !required) return undefined;
  if (password.length < 8 || password.length > 128) {
    throw new RequestError(400, 'La contraseña debe tener entre 8 y 128 caracteres.');
  }
  return password;
};

const authorizeSuperadmin = async (req: any) => {
  const authHeader = String(req.headers?.authorization ?? '');
  const match = authHeader.match(/^Bearer (.+)$/i);
  if (!match) throw new RequestError(401, 'Falta token de autenticación.');

  const auth = getAuth();
  const decoded = await auth.verifyIdToken(match[1], true);
  const caller = await auth.getUser(decoded.uid);
  if (caller.disabled) throw new RequestError(403, 'La cuenta administradora está deshabilitada.');

  const profile = await getFirestore().collection('users').doc(decoded.uid).get();
  const data = profile.data() ?? {};
  const role = normalizeRole(data.role ?? data.Role ?? data.rol ?? data.Rol);
  if (role !== 'superadmin') {
    throw new RequestError(403, 'Sólo un superadministrador puede gestionar cuentas.');
  }

  return { uid: decoded.uid, email: caller.email ?? decoded.email ?? '' };
};

const writeAudit = async (
  action: string,
  actor: { uid: string; email: string },
  target: { uid: string; email?: string | null },
  changes: Record<string, unknown> = {},
) => {
  try {
    await getFirestore().collection('adminAuditLogs').add({
      action,
      actorUid: actor.uid,
      actorEmail: actor.email,
      targetUid: target.uid,
      targetEmail: target.email ?? null,
      changes,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('No se pudo escribir la auditoría de usuarios', error);
  }
};

const listAllAuthUsers = async () => {
  const auth = getAuth();
  const users: Awaited<ReturnType<typeof auth.listUsers>>['users'] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
};

const listUsers = async (res: any) => {
  const [authUsers, profilesSnap] = await Promise.all([
    listAllAuthUsers(),
    getFirestore().collection('users').get(),
  ]);
  const profiles = new Map(profilesSnap.docs.map((doc) => [doc.id, doc.data()]));
  const users = authUsers
    .filter((record) => Boolean(record.email))
    .map((record) => {
      const profile = profiles.get(record.uid) ?? {};
      return {
        uid: record.uid,
        name: String(profile.name ?? record.displayName ?? record.email ?? 'Usuario'),
        email: record.email ?? String(profile.email ?? ''),
        role: normalizeRole(profile.role ?? profile.Role ?? profile.rol ?? profile.Rol),
        disabled: record.disabled,
        createdAt: record.metadata.creationTime ?? null,
        lastSignInAt: record.metadata.lastSignInTime ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  res.status(200).json({ data: users });
};

const createUser = async (req: any, res: any, actor: { uid: string; email: string }) => {
  const body = parseBody(req);
  const name = requiredText(body.name, 'El nombre', 100);
  const email = normalizeEmail(body.email);
  const role = normalizeRole(body.role);
  const password = normalizePassword(body.password, true);
  if (!role) throw new RequestError(400, 'Selecciona un rol válido.');

  const auth = getAuth();
  const db = getFirestore();
  const created = await auth.createUser({ email, password, displayName: name, disabled: false });

  try {
    await db.collection('users').doc(created.uid).set({
      name,
      email,
      role,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      updatedBy: actor.uid,
    });
  } catch (error) {
    try {
      await auth.deleteUser(created.uid);
    } catch (rollbackError) {
      console.error('No se pudo revertir la cuenta creada', rollbackError);
    }
    throw error;
  }

  await writeAudit('user.created', actor, created, { name, email, role });
  res.status(201).json({
    data: { uid: created.uid, name, email, role, disabled: false },
  });
};

const restoreProfile = async (uid: string, existed: boolean, data: Record<string, unknown>) => {
  const ref = getFirestore().collection('users').doc(uid);
  if (existed) await ref.set(data);
  else await ref.delete();
};

const updateUser = async (req: any, res: any, actor: { uid: string; email: string }) => {
  const body = parseBody(req);
  const uid = requiredText(body.uid, 'El UID', 128);
  const name = requiredText(body.name, 'El nombre', 100);
  const email = normalizeEmail(body.email);
  const role = normalizeRole(body.role);
  const password = normalizePassword(body.password, false);
  const disabled = Boolean(body.disabled);
  if (!role) throw new RequestError(400, 'Selecciona un rol válido.');
  if (uid === actor.uid && (role !== 'superadmin' || disabled)) {
    throw new RequestError(400, 'No puedes quitarte el rol Super Admin ni deshabilitar tu propia cuenta.');
  }

  const auth = getAuth();
  const db = getFirestore();
  const profileRef = db.collection('users').doc(uid);
  const previousProfile = await profileRef.get();
  const previousData = previousProfile.data() ?? {};

  await profileRef.set(
    {
      name,
      email,
      role,
      active: !disabled,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    },
    { merge: true },
  );

  try {
    await auth.updateUser(uid, {
      displayName: name,
      email,
      disabled,
      ...(password ? { password } : {}),
    });
  } catch (error) {
    await restoreProfile(uid, previousProfile.exists, previousData);
    throw error;
  }

  await writeAudit('user.updated', actor, { uid, email }, {
    name,
    email,
    role,
    disabled,
    passwordChanged: Boolean(password),
  });
  res.status(200).json({ data: { uid, name, email, role, disabled } });
};

const deleteUser = async (req: any, res: any, actor: { uid: string; email: string }) => {
  const body = parseBody(req);
  const uid = requiredText(body.uid, 'El UID', 128);
  if (uid === actor.uid) throw new RequestError(400, 'No puedes eliminar tu propia cuenta.');

  const auth = getAuth();
  const target = await auth.getUser(uid);
  await auth.deleteUser(uid);

  const db = getFirestore();
  try {
    await db.collection('users').doc(uid).delete();
  } catch (error) {
    console.error('La cuenta se eliminó, pero quedó un perfil huérfano', error);
  }
  await writeAudit('user.deleted', actor, target, {
    name: target.displayName ?? null,
    email: target.email ?? null,
  });
  res.status(200).json({ data: { uid } });
};

const errorStatus = (error: any) => {
  if (error instanceof RequestError) return error.status;
  if (error?.code === 'auth/email-already-exists') return 409;
  if (error?.code === 'auth/user-not-found') return 404;
  if (
    ['auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token'].includes(error?.code)
  ) {
    return 401;
  }
  if (typeof error?.code === 'string' && error.code.startsWith('auth/')) return 400;
  return 500;
};

const errorMessage = (error: any, status: number) => {
  if (error instanceof RequestError) return error.message;
  if (error?.code === 'auth/email-already-exists') return 'Ya existe una cuenta con ese correo.';
  if (error?.code === 'auth/user-not-found') return 'La cuenta ya no existe.';
  if (status === 400) return 'Firebase rechazó los datos de la cuenta.';
  return 'No se pudo completar la operación de usuarios.';
};

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
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    initAdmin();
    const actor = await authorizeSuperadmin(req);
    if (req.method === 'GET') await listUsers(res);
    else if (req.method === 'POST') await createUser(req, res, actor);
    else if (req.method === 'PATCH') await updateUser(req, res, actor);
    else await deleteUser(req, res, actor);
  } catch (error: any) {
    console.error('Error en admin-users', error);
    const status = errorStatus(error);
    res.status(status).json({ error: errorMessage(error, status) });
  }
}
