import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { requireAuth, requireRole } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAuth(req.headers.get('Authorization'));
    requireRole(auth, 'admin', 'manager');

    const body = await req.json();
    const {
      schedule_id,
      profile_id,
      position_id,
      job_site_id,
      start_time,
      end_time,
      break_minutes = 0,
      notes,
    } = body;

    if (!schedule_id || !start_time || !end_time) {
      throw { code: 'VALIDATION_ERROR', message: 'schedule_id, start_time, end_time are required' };
    }
    if (new Date(end_time) <= new Date(start_time)) {
      throw { code: 'VALIDATION_ERROR', message: 'end_time must be after start_time' };
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

    // Conflict detection: same employee, overlapping time
    if (profile_id) {
      const { data: conflicts } = await svc
        .from('shifts')
        .select('id, start_time, end_time')
        .eq('profile_id', profile_id)
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
