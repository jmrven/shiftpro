import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { requireAuth, requireRole } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAuth(req.headers.get('Authorization'));
    requireRole(auth, 'admin', 'manager');

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' };
    }

    const { schedule_id, target_week_start } = body as {
      schedule_id?: string;
      target_week_start?: string;
    };

    if (!schedule_id || !target_week_start) {
      throw { code: 'VALIDATION_ERROR', message: 'schedule_id and target_week_start are required' };
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: schedule } = await svc
      .from('schedules')
      .select('id')
      .eq('id', schedule_id)
      .eq('organization_id', auth.organizationId)
      .maybeSingle();
    if (!schedule) throw { code: 'NOT_FOUND', message: 'Schedule not found' };

    const targetStart = new Date(`${target_week_start}T00:00:00Z`);
    const sourceStart = new Date(targetStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sourceEnd   = new Date(targetStart.getTime());

    const { data: sourceShifts, error: fetchErr } = await svc
      .from('shifts')
      .select('profile_id, position_id, job_site_id, start_time, end_time, break_minutes, notes, is_open_shift, color')
      .eq('schedule_id', schedule_id)
      .eq('organization_id', auth.organizationId)
      .gte('start_time', sourceStart.toISOString())
      .lt('start_time', sourceEnd.toISOString());

    if (fetchErr) throw { code: 'INTERNAL_ERROR', message: fetchErr.message };
    if (!sourceShifts || sourceShifts.length === 0) {
      return new Response(JSON.stringify({ data: { copied: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const newShifts = sourceShifts.map((s) => ({
      organization_id: auth.organizationId,
      schedule_id,
      profile_id:    s.profile_id,
      position_id:   s.position_id,
      job_site_id:   s.job_site_id,
      start_time:    new Date(new Date(s.start_time).getTime() + ONE_WEEK_MS).toISOString(),
      end_time:      new Date(new Date(s.end_time).getTime() + ONE_WEEK_MS).toISOString(),
      break_minutes: s.break_minutes,
      notes:         s.notes,
      is_open_shift: s.is_open_shift,
      color:         s.color,
      status:        'draft',
      created_by:    auth.userId,
    }));

    const { data: inserted, error: insertErr } = await svc
      .from('shifts')
      .insert(newShifts)
      .select('id');

    if (insertErr) throw { code: 'INTERNAL_ERROR', message: insertErr.message };

    return new Response(JSON.stringify({ data: { copied: inserted?.length ?? 0 } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400, UNAUTHORIZED: 401, FORBIDDEN: 403,
      NOT_FOUND: 404, INTERNAL_ERROR: 500,
    };
    const status = statusMap[e.code ?? ''] ?? 400;
    return new Response(JSON.stringify({ error: e }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
