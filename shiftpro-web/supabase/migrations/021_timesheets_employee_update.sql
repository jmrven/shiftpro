-- Migration 021: Allow employees to update their own timesheet rows
-- (clock_out, break_minutes are written by the service-role Edge Function, but
-- future user-scoped writes should not be blocked)

DROP POLICY IF EXISTS "timesheets_update" ON timesheets;

CREATE POLICY "timesheets_update" ON timesheets FOR UPDATE
  USING (
    (
      profile_id = auth.uid()
      AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND organization_id = timesheets.organization_id
    )
  );
