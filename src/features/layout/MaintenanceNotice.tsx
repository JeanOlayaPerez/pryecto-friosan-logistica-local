type MaintenanceNoticeProps = {
  modulo: string;
};

export const MaintenanceNotice = ({ modulo }: MaintenanceNoticeProps) => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 text-slate-200">
      <div className="max-w-lg space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Modulo en mantenimiento</p>
        <h2 className="text-xl font-semibold text-slate-100">{modulo}</h2>
        <p className="text-sm text-slate-300">
          Este modulo esta temporalmente fuera de servicio por tareas de mantenimiento. Vuelve a intentarlo mas
          tarde.
        </p>
      </div>
    </div>
  );
};
