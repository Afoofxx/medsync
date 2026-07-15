import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/ui';
import type { UserRole } from '@/types';

export function ProtectedRoute({ children, allow }: { children: React.ReactNode; allow?: UserRole[] }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-surface-0 flex items-center justify-center"><Loader label="Authenticating…" /></div>;
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(profile.role)) {
    // Redirect users to their home dashboard
    const home = profile.role === 'control' ? '/control'
      : profile.role === 'ambulance' ? '/ambulance'
      : profile.role === 'hospital' ? '/hospital' : '/login';
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}
