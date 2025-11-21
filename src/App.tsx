import type { ReactNode } from 'react';
import { AuthProvider } from './features/auth/AuthProvider';

type AppProps = {
  children: ReactNode;
};

export const App = ({ children }: AppProps) => {
  return (
    <AuthProvider>
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
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Friosan Logística
                  </p>
                  <h1 className="text-xl font-semibold text-white">Tablero de camiones</h1>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  En tiempo real
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 pb-10 sm:px-8">
            <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
          </main>
        </div>
      </div>
    </AuthProvider>
  );
};
