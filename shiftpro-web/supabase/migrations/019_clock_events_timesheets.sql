-- Migration 019: clock_events + timesheets tables

CREATE TYPE clock_event_type AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end');
CREATE TYPE timesheet_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS clock_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    event_type clock_event_type NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location GEOGRAPHY(POINT, 4326),
    is_within_geofence BOOLEAN,
    geofence_job_site_id UUID REFERENCES job_sites(id),
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clock_events_org ON clock_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_clock_events_profile ON clock_events(profile_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_clock_events_time ON clock_events(organization_id, timestamp);

ALTER TABLE clock_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clock_events_select" ON clock_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "clock_events_insert" ON clock_events FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    schedule_id UUID REFERENCES schedules(id),
    shift_id UUID REFERENCES shifts(id),
    date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    clock_in_location GEOGRAPHY(POINT, 4326),
    clock_out_location GEOGRAPHY(POINT, 4326),
    break_minutes INTEGER NOT NULL DEFAULT 0,
    total_minutes INTEGER,
    regular_minutes INTEGER,
    overtime_minutes INTEGER,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    status timesheet_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_timesheets_org ON timesheets(organization_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_profile ON timesheets(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(organization_id, status);

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_select" ON timesheets FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND organization_id = timesheets.organization_id
    )
  );

CREATE POLICY "timesheets_all" ON timesheets FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER set_updated_at_timesheets
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC function used by clock-action Edge Function to find nearest job site
CREATE OR REPLACE FUNCTION find_job_site_for_location(
  p_org_id UUID,
  p_latitude FLOAT,
  p_longitude FLOAT
) RETURNS TABLE(job_site_id UUID, job_site_name TEXT, within_geofence BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    js.id,
    js.name,
    ST_DWithin(
      ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')'),
      js.location,
      js.geofence_radius_meters::FLOAT
    ) AS within_geofence
  FROM job_sites js
  WHERE js.organization_id = p_org_id
    AND js.is_active = true
    AND js.location IS NOT NULL
  ORDER BY ST_Distance(
    ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')'),
    js.location
  )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
