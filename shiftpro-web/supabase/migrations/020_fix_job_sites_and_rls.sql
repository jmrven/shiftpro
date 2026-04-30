-- Migration 020: Fix job_sites schema + tighten RLS policies

-- 1. Fix job_sites table schema
ALTER TABLE job_sites RENAME COLUMN geofence_radius TO geofence_radius_meters;
ALTER TABLE job_sites ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Fix clock_events_insert policy (restrict to own profile_id)
DROP POLICY IF EXISTS "clock_events_insert" ON clock_events;
CREATE POLICY "clock_events_insert" ON clock_events FOR INSERT
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND profile_id = auth.uid()
  );

-- 3. Fix timesheets RLS: drop conflicting FOR ALL policy, add proper INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "timesheets_all" ON timesheets;

CREATE POLICY "timesheets_insert" ON timesheets FOR INSERT
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND profile_id = auth.uid()
  );

CREATE POLICY "timesheets_update" ON timesheets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND organization_id = timesheets.organization_id
  ));

CREATE POLICY "timesheets_delete" ON timesheets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id = timesheets.organization_id
  ));

-- 4. Fix timesheets_select to include org guard on own-row branch
DROP POLICY IF EXISTS "timesheets_select" ON timesheets;
CREATE POLICY "timesheets_select" ON timesheets FOR SELECT
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

-- 5. Recreate find_job_site_for_location with SET search_path and ST_MakePoint
CREATE OR REPLACE FUNCTION find_job_site_for_location(
  p_org_id UUID,
  p_latitude FLOAT,
  p_longitude FLOAT
) RETURNS TABLE(job_site_id UUID, job_site_name TEXT, within_geofence BOOLEAN) AS $$
DECLARE
  p_point GEOGRAPHY := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
BEGIN
  RETURN QUERY
  SELECT
    js.id,
    js.name,
    ST_DWithin(p_point, js.location, js.geofence_radius_meters::FLOAT) AS within_geofence
  FROM job_sites js
  WHERE js.organization_id = p_org_id
    AND js.is_active = true
    AND js.location IS NOT NULL
  ORDER BY ST_Distance(p_point, js.location)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Add spatial index on clock_events.location
CREATE INDEX IF NOT EXISTS idx_clock_events_location ON clock_events USING GIST(location);

-- Document that clock_events is intentionally append-only
COMMENT ON TABLE clock_events IS 'Immutable audit trail of clock actions. No UPDATE or DELETE policies are defined intentionally.';
