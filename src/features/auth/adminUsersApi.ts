import { auth } from '../../shared/config/firebase';
import type { UserRole } from './AuthProvider';

export type AdminUser = {
  uid: string;
  name: string;
  email: string;
  role: UserRole | null;
  disabled: boolean;
  createdAt?: string | null;
  lastSignInAt?: string | null;
};

export type AdminUserInput = {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  disabled?: boolean;
};

const request = async <T>(method: string, body?: Record<string, unknown>): Promise<T> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('La sesión no está disponible. Vuelve a iniciar sesión.');

  const token = await currentUser.getIdToken();
  const response = await fetch('/api/admin-users', {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? 'No se pudo completar la operación.');
  }
  return payload.data as T;
};

export const listAdminUsers = () => request<AdminUser[]>('GET');

export const createAdminUser = (input: AdminUserInput) =>
  request<AdminUser>('POST', input as unknown as Record<string, unknown>);

export const updateAdminUser = (uid: string, input: AdminUserInput) =>
  request<AdminUser>('PATCH', { uid, ...input });

export const deleteAdminUser = (uid: string) => request<{ uid: string }>('DELETE', { uid });
