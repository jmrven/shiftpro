import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { loadProfile } from '@/lib/profile';

import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { EmployeeProfilePage } from '@/pages/EmployeeProfilePage';
import { ScheduleEditorPage } from '@/pages/ScheduleEditorPage';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';

export default function App() {
  const { setSession, clearSession } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSession(session); loadProfile(session.user.id); }
      else useAuthStore.getState().setProfile(null, null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setSession(session); loadProfile(session.user.id); }
      else clearSession();
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
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
              <Route path="/schedule" element={<ScheduleEditorPage />} />
              <Route path="/schedule/my" element={<div className="p-6 text-muted-foreground">My Schedule — Phase 2b</div>} />
              <Route path="/schedule/team" element={<div className="p-6 text-muted-foreground">Team Schedule — Phase 2b</div>} />
              <Route path="/schedule/availability" element={<div className="p-6 text-muted-foreground">Availability — Phase 2b</div>} />
              <Route path="/schedule/requests" element={<div className="p-6 text-muted-foreground">Requests — Phase 2c</div>} />
              <Route path="/attendance" element={<div className="p-6 text-muted-foreground">Attendance — Phase 3</div>} />
              <Route path="/time-off" element={<div className="p-6 text-muted-foreground">Time Off — Phase 3</div>} />
              <Route path="/messages" element={<div className="p-6 text-muted-foreground">Messages — Phase 4</div>} />

              {/* Admin + Manager only */}
              <Route element={<RequireAuth roles={['admin', 'manager']} />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:id" element={<EmployeeProfilePage />} />
                <Route path="/reports" element={<div className="p-6 text-muted-foreground">Reports — Phase 5</div>} />
              </Route>

              {/* Admin only */}
              <Route element={<RequireAuth roles={['admin']} />}>
                <Route path="/settings" element={<div className="p-6 text-muted-foreground">Settings — Phase 5</div>} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DndProvider>
  );
}
