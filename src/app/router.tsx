import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { TruckBoard } from '../features/trucks/components/TruckBoard';
import { MonitorView } from '../features/trucks/components/MonitorView';
import { ManagerDashboard } from '../features/trucks/components/ManagerDashboard';
import { PorteriaDesk } from '../features/trucks/components/PorteriaDesk';
import { RecepcionDesk } from '../features/trucks/components/RecepcionDesk';
import { HistoryView } from '../features/trucks/components/HistoryView';

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<TruckBoard />} />
      <Route path="/monitor" element={<MonitorView />} />
      <Route path="/gerencia" element={<ManagerDashboard />} />
      <Route path="/porteria" element={<PorteriaDesk />} />
      <Route path="/recepcion" element={<RecepcionDesk />} />
      <Route path="/historial" element={<HistoryView />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
