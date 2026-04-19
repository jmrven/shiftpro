import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/ui';

interface Props {
  roles?: UserRole[];
}

export function RequireAuth({ roles }: Props) {
  const { session, role, profileLoaded } = useAuthStore();

  if (!session) return <Navigate to="/login" replace />;
  // Wait for profile fetch before deciding onboarding vs app
  if (!profileLoaded) return null;
  if (!role) return <Navigate to="/onboarding" replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
