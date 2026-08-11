import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './store/app';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/dashboard';
import ControlPlane from './pages/control';
import Routing from './pages/routing';
import Metering from './pages/metering';
import Assets from './pages/assets';
import Security from './pages/security';
import Workbench from './pages/workbench';
import System from './pages/system';

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/control" element={<ControlPlane />} />
            <Route path="/routing" element={<Routing />} />
            <Route path="/metering" element={<Metering />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/security" element={<Security />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/system" element={<System />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AppProvider>
  );
}
