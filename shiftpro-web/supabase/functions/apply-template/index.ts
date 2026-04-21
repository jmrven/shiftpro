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

    const { template_id, week_start, timezone } = body as {
      template_id?: string;
      week_start?: string;
      timezone?: string;
    };

    if (!template_id || !week_start || !timezone) {
      throw { code: 'VALIDATION_ERROR', message: 'template_id, week_start, and timezone are required' };
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: template, error: tErr } = await svc
      .from('schedule_templates')
      .select('id, schedule_id, organization_id, schedule_template_shifts(*)')
      .eq('id', template_id)
      .eq('organization_id', auth.organizationId)
      .maybeSingle();

    if (tErr || !template) throw { code: 'NOT_FOUND', message: 'Template not found' };

    const DAY_INDEX: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };

    const weekStartDate = new Date(`${week_start}T00:00:00`);

    const templateShifts = template.schedule_template_shifts as Array<{
      day_of_week: string;
      start_time: string;
      end_time: string;
      position_id: string | null;
      break_minutes: number;
      notes: string | null;
    }>;

    const shiftsToInsert = templateShifts.map((ts) => {
      const dayOffset = DAY_INDEX[ts.day_of_week] ?? 0;
      const shiftDate = new Date(weekStartDate);
      shiftDate.setDate(shiftDate.getDate() + dayOffset);
      const dateStr  = shiftDate.toISOString().slice(0, 10);
      const startUtc = new Date(`${dateStr}T${ts.start_time}`).toISOString();
      const endUtc   = new Date(`${dateStr}T${ts.end_time}`).toISOString();
      return {
        organization_id: auth.organizationId,
        schedule_id:     template.schedule_id,
        position_id:     ts.position_id ?? null,
        start_time:      startUtc,
        end_time:        endUtc,
        break_minutes:   ts.break_minutes,
        notes:           ts.notes ?? null,
        status:          'draft',
        is_open_shift:   true,
        created_by:      auth.userId,
      };
    });

    if (shiftsToInsert.length === 0) {
      return new Response(JSON.stringify({ data: { created: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: created, error: insertErr } = await svc
      .from('shifts')
      .insert(shiftsToInsert)
      .select('id');

    if (insertErr) throw { code: 'INTERNAL_ERROR', message: insertErr.message };

    return new Response(JSON.stringify({ data: { created: created?.length ?? 0 } }), {
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
