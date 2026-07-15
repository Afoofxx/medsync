import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from '@/components/auth/LoginPage';
import ControlCenterPage from '@/features/control/ControlCenterPage';
import AmbulancePage from '@/features/ambulance/AmbulancePage';
import HospitalPage from '@/features/hospital/HospitalPage';

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  const home = profile.role === 'control' ? '/control'
    : profile.role === 'ambulance' ? '/ambulance'
    : profile.role === 'hospital' ? '/hospital' : '/login';
  return <Navigate to={home} replace />;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/control" element={
            <ProtectedRoute allow={['control', 'super_admin']}>
              <AppShell><ControlCenterPage /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/ambulance" element={
            <ProtectedRoute allow={['ambulance']}>
              <AppShell><AmbulancePage /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/hospital" element={
            <ProtectedRoute allow={['hospital']}>
              <AppShell><HospitalPage /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
