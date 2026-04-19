-- The org_isolation_select policy is recursive (queries profiles to check profiles).
-- Add a direct self-select policy so users can always read their own row.
create policy "self_select" on profiles for select using (id = auth.uid());
