import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';

type AppProps = {
  children: ReactNode;
};

const Shell = ({ children }: AppProps) => {
  const { user, role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface-dark text-slate-100">
      <div className="logistics-bg" aria-hidden>
        <div className="logistics-lanes" />
        <div className="truck-convoy" />
        <div className="truck-convoy small" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.08),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(94,234,212,0.05),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.05),transparent_25%)] pointer-events-none" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-4 py-4 sm:px-8">
          <div className="glass rounded-2xl px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Friosan Logistica</p>
                <h1 className="text-xl font-semibold text-white">Panel operativo</h1>
              </div>
              {user && (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  <span className="font-semibold text-white">{user.name}</span>
                  {role && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{role}</span>}
                  <button
                    onClick={() => logout()}
                    className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-slate-900 hover:brightness-110"
                  >
                    Salir
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pb-10 sm:px-8">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
};

export const App = ({ children }: AppProps) => {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
};
