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
  const raw =
    data.role ??
    data.Role ??
    data.rol ??
    data.Rol ??
    data.USER_ROLE ??
    data.userRole ??
    data.user_role;
  if (!raw || !data.name) return null;
  const normalized = String(raw).toLowerCase().trim();
  const allowed = ['porteria', 'recepcion', 'operaciones', 'comercial', 'gerencia', 'admin', 'superadmin'];
  if (!allowed.includes(normalized)) return null;
  return { name: data.name as string, role: normalized as UserRole };
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
        setUser({
          id: fbUser.uid,
          email: fbUser.email ?? '',
          name: meta?.name ?? fbUser.email ?? 'Usuario',
        });
        setRole(meta?.role ?? null);
      } catch (err) {
        console.error('Error reading user profile', err);
        setUser({
          id: fbUser.uid,
          email: fbUser.email ?? '',
          name: fbUser.email ?? 'Usuario',
        });
        setRole(null);
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
