import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

export type UserRole = 'operaciones' | 'comercial' | 'admin';

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

const MOCK_USERS: Array<AuthUser & { password: string; role: UserRole }> = [
  {
    id: 'u-ops',
    email: 'operaciones@friosan.com',
    name: 'Equipo Operaciones',
    password: 'demo123',
    role: 'operaciones',
  },
  {
    id: 'u-com',
    email: 'comercial@friosan.com',
    name: 'Equipo Comercial',
    password: 'demo123',
    role: 'comercial',
  },
  {
    id: 'u-admin',
    email: 'admin@friosan.com',
    name: 'Administración',
    password: 'demo123',
    role: 'admin',
  },
];

const STORAGE_KEY = 'friosan-auth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { user: AuthUser; role: UserRole };
        setUser(parsed.user);
        setRole(parsed.role);
      } catch (e) {
        console.error('Error reading local session', e);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const match = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!match) {
      throw new Error('Invalid credentials');
    }

    const { role: userRole, password: _, ...userData } = match;
    setUser(userData);
    setRole(userRole);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: userData, role: userRole }));
  };

  const logout = async () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem(STORAGE_KEY);
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
