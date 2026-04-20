import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { requireAuth, requireRole } from '../_shared/auth.ts';
import { createAuditLog } from '../_shared/audit.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAuth(req.headers.get('Authorization'));
    requireRole(auth, 'admin', 'manager');

    // Fix 2: Wrap req.json() in try/catch to guard against malformed bodies
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON' };
    }

    const {
      schedule_id,
      profile_id,
      position_id,
      job_site_id,
      start_time,
      end_time,
      notes,
    } = body;
    const break_minutes = body.break_minutes !== undefined ? body.break_minutes : 0;

    if (!schedule_id || !start_time || !end_time) {
      throw { code: 'VALIDATION_ERROR', message: 'schedule_id, start_time, end_time are required' };
    }
    if (new Date(end_time as string) <= new Date(start_time as string)) {
      throw { code: 'VALIDATION_ERROR', message: 'end_time must be after start_time' };
    }

    // Fix 4: Validate break_minutes range
    if (typeof break_minutes !== 'number' || break_minutes < 0 || break_minutes > 1440) {
      throw { code: 'VALIDATION_ERROR', message: 'break_minutes must be between 0 and 1440' };
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify schedule belongs to auth user's org
    const { data: schedule, error: schedErr } = await svc
      .from('schedules')
      .select('id, organization_id')
      .eq('id', schedule_id)
      .eq('organization_id', auth.organizationId)
      .maybeSingle();

    if (schedErr || !schedule) {
      throw { code: 'NOT_FOUND', message: 'Schedule not found' };
    }

    // Fix 3: Verify profile_id belongs to caller's org before any further use
    if (profile_id) {
      const { data: profile } = await svc
        .from('profiles')
        .select('id')
        .eq('id', profile_id)
        .eq('organization_id', auth.organizationId)
        .maybeSingle();

      if (!profile) throw { code: 'NOT_FOUND', message: 'Employee not found in this organization' };
    }

    // Conflict detection: same employee, overlapping time
    if (profile_id) {
      const { data: conflicts } = await svc
        .from('shifts')
        .select('id, start_time, end_time')
        .eq('profile_id', profile_id)
        .eq('organization_id', auth.organizationId)   // Fix 1: scope overlap check to org
        .lt('start_time', end_time)
        .gt('end_time', start_time);

      if (conflicts && conflicts.length > 0) {
        throw {
          code: 'CONFLICT',
          message: 'Shift overlaps with an existing shift for this employee',
          details: conflicts,
        };
      }
    }

    const { data: shift, error: insertErr } = await svc
      .from('shifts')
      .insert({
        organization_id: auth.organizationId,
        schedule_id,
        profile_id: profile_id ?? null,
        position_id: position_id ?? null,
        job_site_id: job_site_id ?? null,
        start_time,
        end_time,
        break_minutes,
        notes: notes ?? null,
        is_open_shift: !profile_id,
        created_by: auth.userId,
        status: 'draft',
      })
      .select()
      .single();

    if (insertErr) throw { code: 'INTERNAL_ERROR', message: insertErr.message };

    // Fix 5: Audit log — non-blocking, errors are swallowed inside createAuditLog
    await createAuditLog(svc, {
      actor_id: auth.userId,
      action: 'create',
      entity_type: 'shift',
      entity_id: shift.id,
      organization_id: auth.organizationId,
      changes: { shift: { old: null, new: shift } },
    });

    return new Response(JSON.stringify({ data: shift }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INTERNAL_ERROR: 500,
    };
    const status = statusMap[err.code] ?? 400;
    return new Response(JSON.stringify({ error: err }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
