import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../shared/config/firebase';

export type UserRole =
  | 'porteria'
  | 'recepcion'
  | 'operaciones'
  | 'comercial'
  | 'gerencia'
  | 'visor'
  | 'admin'
  | 'superadmin';

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseUserDoc = (data: any): { name: string; role: UserRole } | null => {
  if (!data) return null;
  const stripAccents = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const raw =
    data.role ??
    data.Role ??
    data.rol ??
    data.Rol ??
    data.USER_ROLE ??
    data.userRole ??
    data.user_role;
  if (!raw || !data.name) return null;
  const normalized = stripAccents(String(raw)).toLowerCase().trim();
  const allowed = ['porteria', 'recepcion', 'operaciones', 'comercial', 'gerencia', 'visor', 'admin', 'superadmin'] as const;
  const mapped: Partial<Record<string, UserRole>> = {
    porteria: 'porteria',
    recepcion: 'recepcion',
    operaciones: 'operaciones',
    comercial: 'comercial',
    gerencia: 'gerencia',
    visor: 'visor',
    pantalla: 'visor',
    display: 'visor',
    panel: 'visor',
    admin: 'admin',
    superadmin: 'superadmin',
  };
  const role = mapped[normalized] ?? (allowed.includes(normalized as UserRole) ? (normalized as UserRole) : null);
  if (!role) return null;
  return { name: data.name as string, role };
};

const inferRoleFromEmail = (email?: string | null): UserRole | null => {
  if (!email) return null;
  const e = email.toLowerCase();
  if (e.includes('porteria')) return 'porteria';
  if (e.includes('recepcion')) return 'recepcion';
  if (e.includes('comercial')) return 'comercial';
  if (e.includes('operaciones')) return 'operaciones';
  if (e.includes('gerencia')) return 'gerencia';
  if (e.includes('visor') || e.includes('pantalla') || e.includes('display')) return 'visor';
  if (e.includes('admin')) return 'admin';
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No persistir sesión: requiere login en cada refresh / pérdida de conexión
    setPersistence(auth, inMemoryPersistence).catch((err) => {
      console.warn('No se pudo establecer persistencia en memoria', err);
    });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userRef);
        const meta = parseUserDoc(snap.data());
        const inferredRole = meta?.role ?? inferRoleFromEmail(fbUser.email);
        setUser({
          id: fbUser.uid,
          email: fbUser.email ?? '',
          name: meta?.name ?? fbUser.email ?? 'Usuario',
        });
        setRole(inferredRole ?? null);
      } catch (err) {
        console.error('Error reading user profile', err);
        setUser({
          id: fbUser.uid,
          email: fbUser.email ?? '',
          name: fbUser.email ?? 'Usuario',
        });
        setRole(inferRoleFromEmail(fbUser.email));
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      login,
      logout,
    }),
    [user, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
