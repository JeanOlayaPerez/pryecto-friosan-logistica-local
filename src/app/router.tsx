import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { TruckBoard } from '../features/trucks/components/TruckBoard';
import { MonitorView } from '../features/trucks/components/MonitorView';
import { PorteriaDesk } from '../features/trucks/components/PorteriaDesk';
import { HistoryView } from '../features/trucks/components/HistoryView';
import { CommercialView } from '../features/trucks/components/CommercialView';
import { GeneralBoard } from '../features/trucks/components/GeneralBoard';
import { GerenciaReports } from '../features/trucks/components/GerenciaReports';
import { ClientsView } from '../features/clients/ClientsView';
import { VisorTvView } from '../features/trucks/components/VisorTvView';
import { QualityView } from '../features/trucks/components/QualityView';
import { AdminPanel } from '../features/trucks/components/AdminPanel';
import { MaintenanceNotice } from '../features/layout/MaintenanceNotice';
import { SecurityReportsView } from '../features/security-reports/components/SecurityReportsView';

// Modulos temporalmente fuera de servicio. Para poner uno en mantenimiento,
// agrega su entrada aqui (el login nunca debe entrar aqui: bloquearia el
// acceso de todos los roles).
const MODULOS_EN_MANTENIMIENTO: Record<string, string> = {};

const HomeRoute = () => {
  const { role } = useAuth();
  if (role === 'porteria') return <Navigate to="/porteria" replace />;
  if (role === 'comercial') return <Navigate to="/comercial" replace />;
  if (role === 'recepcion') return <Navigate to="/recepcion" replace />;
  if (role === 'gerencia') return <Navigate to="/gerencia" replace />;
  if (role === 'visor') return <Navigate to="/visor" replace />;
  if (role === 'clientes') return <Navigate to="/clientes" replace />;
  if (role === 'calidad') return <Navigate to="/calidad" replace />;
  if (role === 'superadmin') return <Navigate to="/admin" replace />;
  return <TruckBoard />;
};

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/visortv" element={<VisorTvView />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRoute />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/admin/informes-seguridad" element={<SecurityReportsView />} />
      <Route path="/monitor" element={<MonitorView />} />
      <Route path="/gerencia" element={<GerenciaReports />} />
      <Route path="/gerencia/reportes" element={<GerenciaReports />} />
      <Route path="/clientes" element={<ClientsView />} />
      <Route path="/porteria" element={<PorteriaDesk />} />
      <Route
        path="/recepcion"
        element={
          MODULOS_EN_MANTENIMIENTO.recepcion ? (
            <MaintenanceNotice modulo={MODULOS_EN_MANTENIMIENTO.recepcion} />
          ) : (
            <TruckBoard />
          )
        }
      />
      <Route path="/comercial" element={<CommercialView />} />
      <Route path="/visor" element={<GeneralBoard />} />
      <Route
        path="/historial"
        element={
          MODULOS_EN_MANTENIMIENTO.historial ? (
            <MaintenanceNotice modulo={MODULOS_EN_MANTENIMIENTO.historial} />
          ) : (
            <HistoryView />
          )
        }
      />
      <Route
        path="/calidad"
        element={
          MODULOS_EN_MANTENIMIENTO.calidad ? (
            <MaintenanceNotice modulo={MODULOS_EN_MANTENIMIENTO.calidad} />
          ) : (
            <QualityView />
          )
        }
      />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
