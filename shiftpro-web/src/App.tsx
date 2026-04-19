import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { loadProfile } from '@/lib/profile';

import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { EmployeeProfilePage } from '@/pages/EmployeeProfilePage';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';

export default function App() {
  const { setSession, clearSession } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSession(session); loadProfile(session.user.id); }
      else useAuthStore.getState().setProfile(null, null); // mark loaded with no profile
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setSession(session); loadProfile(session.user.id); }
      else clearSession();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Protected — any authenticated user */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/schedule" element={<div className="text-muted-foreground">Schedule — Phase 2</div>} />
            <Route path="/attendance" element={<div className="text-muted-foreground">Attendance — Phase 3</div>} />
            <Route path="/time-off" element={<div className="text-muted-foreground">Time Off — Phase 3</div>} />
            <Route path="/messages" element={<div className="text-muted-foreground">Messages — Phase 4</div>} />

            {/* Admin + Manager only */}
            <Route element={<RequireAuth roles={['admin', 'manager']} />}>
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employees/:id" element={<EmployeeProfilePage />} />
              <Route path="/reports" element={<div className="text-muted-foreground">Reports — Phase 5</div>} />
            </Route>

            {/* Admin only */}
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="/settings" element={<div className="text-muted-foreground">Settings — Phase 5</div>} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
