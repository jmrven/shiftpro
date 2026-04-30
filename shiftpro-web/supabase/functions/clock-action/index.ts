import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createAuditLog } from '../_shared/audit.ts';

type ClockAction = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAuth(req.headers.get('Authorization'));
    const { action, latitude, longitude } = await req.json() as {
      action: ClockAction;
      latitude?: number;
      longitude?: number;
    };

    if (!['clock_in', 'clock_out', 'break_start', 'break_end'].includes(action)) {
      throw { code: 'VALIDATION_ERROR', message: 'Invalid action' };
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString().slice(0, 10);

    // Get latest clock event today to validate state transitions
    const { data: latestEvent } = await serviceClient
      .from('clock_events')
      .select('event_type, timestamp')
      .eq('profile_id', auth.userId)
      .gte('timestamp', todayStart.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentType = latestEvent?.event_type ?? null;
    const isClockedIn = currentType === 'clock_in' || currentType === 'break_end';
    const isOnBreak = currentType === 'break_start';
    const isClockedOut = !currentType || currentType === 'clock_out';

    // Validate transition
    if (action === 'clock_in' && !isClockedOut) {
      throw { code: 'VALIDATION_ERROR', message: 'Already clocked in' };
    }
    if (action === 'clock_out' && !isClockedIn) {
      throw { code: 'VALIDATION_ERROR', message: 'Not clocked in' };
    }
    if (action === 'break_start' && !isClockedIn) {
      throw { code: 'VALIDATION_ERROR', message: 'Must be clocked in to start a break' };
    }
    if (action === 'break_end' && !isOnBreak) {
      throw { code: 'VALIDATION_ERROR', message: 'Not on break' };
    }

    // Build location string for PostGIS
    let locationStr: string | null = null;
    if (latitude !== undefined && longitude !== undefined) {
      locationStr = `POINT(${longitude} ${latitude})`;
    }

    // Geofence check for clock_in
    let geofenceWarning: string | null = null;
    let withinGeofence: boolean | null = null;
    let geofenceJobSiteId: string | null = null;

    if (action === 'clock_in' && latitude !== undefined && longitude !== undefined) {
      const { data: geoResult } = await serviceClient.rpc('find_job_site_for_location', {
        p_org_id: auth.organizationId,
        p_latitude: latitude,
        p_longitude: longitude,
      });
      if (geoResult && geoResult.length > 0) {
        const nearest = geoResult[0] as { job_site_id: string; job_site_name: string; within_geofence: boolean };
        withinGeofence = nearest.within_geofence;
        geofenceJobSiteId = nearest.job_site_id;
        if (!nearest.within_geofence) {
          geofenceWarning = `Outside geofence for ${nearest.job_site_name}`;
        }
      }
    }

    // Create clock event
    const { data: clockEvent, error: clockErr } = await serviceClient
      .from('clock_events')
      .insert({
        organization_id: auth.organizationId,
        profile_id: auth.userId,
        event_type: action,
        timestamp: new Date().toISOString(),
        ...(locationStr ? { location: locationStr } : {}),
        is_within_geofence: withinGeofence,
        geofence_job_site_id: geofenceJobSiteId,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
        user_agent: req.headers.get('user-agent') ?? null,
      })
      .select()
      .single();

    if (clockErr) throw { code: 'INTERNAL_ERROR', message: clockErr.message };

    // Manage timesheet
    let timesheet: Record<string, unknown> | null = null;
    const now = new Date().toISOString();

    if (action === 'clock_in') {
      const { data: ts, error: tsErr } = await serviceClient
        .from('timesheets')
        .upsert({
          organization_id: auth.organizationId,
          profile_id: auth.userId,
          date: todayStr,
          clock_in: now,
          break_minutes: 0,
          status: 'pending',
          ...(locationStr ? { clock_in_location: locationStr } : {}),
        }, { onConflict: 'profile_id,date' })
        .select()
        .single();
      if (tsErr) throw { code: 'INTERNAL_ERROR', message: tsErr.message };
      timesheet = ts;
    }

    if (action === 'clock_out') {
      const { data: currentTs } = await serviceClient
        .from('timesheets')
        .select('id, clock_in, break_minutes')
        .eq('profile_id', auth.userId)
        .eq('date', todayStr)
        .maybeSingle();

      if (currentTs?.clock_in) {
        const clockInMs = new Date(currentTs.clock_in as string).getTime();
        const clockOutMs = Date.now();
        const totalMinutes = Math.round((clockOutMs - clockInMs) / 60_000) - (currentTs.break_minutes as number);
        const { data: ts, error: tsErr } = await serviceClient
          .from('timesheets')
          .update({
            clock_out: now,
            total_minutes: Math.max(0, totalMinutes),
            ...(locationStr ? { clock_out_location: locationStr } : {}),
          })
          .eq('id', currentTs.id)
          .select()
          .single();
        if (tsErr) throw { code: 'INTERNAL_ERROR', message: tsErr.message };
        timesheet = ts;
      }
    }

    if (action === 'break_end') {
      // Find the most recent break_start timestamp
      const { data: breakStartEvent } = await serviceClient
        .from('clock_events')
        .select('timestamp')
        .eq('profile_id', auth.userId)
        .eq('event_type', 'break_start')
        .gte('timestamp', todayStart.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (breakStartEvent) {
        const breakMs = Date.now() - new Date(breakStartEvent.timestamp as string).getTime();
        const breakMins = Math.round(breakMs / 60_000);
        const { data: currentTs } = await serviceClient
          .from('timesheets')
          .select('id, break_minutes')
          .eq('profile_id', auth.userId)
          .eq('date', todayStr)
          .maybeSingle();
        if (currentTs) {
          const { data: ts, error: tsErr } = await serviceClient
            .from('timesheets')
            .update({ break_minutes: (currentTs.break_minutes as number) + breakMins })
            .eq('id', currentTs.id)
            .select()
            .single();
          if (tsErr) throw { code: 'INTERNAL_ERROR', message: tsErr.message };
          timesheet = ts;
        }
      }
    }

    await createAuditLog(serviceClient, {
      actor_id: auth.userId,
      organization_id: auth.organizationId,
      action: action,
      entity_type: 'clock_event',
      entity_id: clockEvent.id,
    });

    return new Response(
      JSON.stringify({ data: { event: clockEvent, timesheet, geofence_warning: geofenceWarning } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const status = e.code === 'UNAUTHORIZED' ? 401 : e.code === 'FORBIDDEN' ? 403 : e.code === 'VALIDATION_ERROR' ? 400 : 500;
    return new Response(
      JSON.stringify({ error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unknown error' } }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
