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

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON' };
    }

    const { schedule_id, week_start, week_end } = body as {
      schedule_id: string;
      week_start?: string;
      week_end?: string;
    };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!schedule_id || !uuidRegex.test(schedule_id)) {
      throw { code: 'VALIDATION_ERROR', message: 'schedule_id must be a valid UUID' };
    }

    if (week_start && week_end && week_start >= week_end) {
      throw { code: 'VALIDATION_ERROR', message: 'week_end must be after week_start' };
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify schedule belongs to org
    const { data: schedule } = await svc
      .from('schedules')
      .select('id')
      .eq('id', schedule_id)
      .eq('organization_id', auth.organizationId)
      .maybeSingle();
    if (!schedule) throw { code: 'NOT_FOUND', message: 'Schedule not found' };

    // Build the update — optionally scoped to a week range
    const publishedAt = new Date().toISOString();
    let query = svc
      .from('shifts')
      .update({ status: 'published', published_at: publishedAt })
      .eq('schedule_id', schedule_id)
      .eq('status', 'draft');

    if (week_start) query = query.gte('start_time', week_start);
    if (week_end)   query = query.lt('start_time', week_end);

    const { count, error: updateErr } = await query.select('id', { count: 'exact', head: true });
    if (updateErr) throw { code: 'INTERNAL_ERROR', message: updateErr.message };

    await createAuditLog(svc, {
      actor_id: auth.userId,
      organization_id: auth.organizationId,
      action: 'publish',
      entity_type: 'schedule',
      entity_id: schedule_id,
      changes: {
        published_count: { old: null, new: count ?? 0 },
        ...(week_start ? { week_start: { old: null, new: week_start } } : {}),
        ...(week_end   ? { week_end:   { old: null, new: week_end   } } : {}),
      },
    });

    return new Response(JSON.stringify({ data: { published_count: count ?? 0 } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400, UNAUTHORIZED: 401, FORBIDDEN: 403,
      NOT_FOUND: 404, INTERNAL_ERROR: 500,
    };
    const status = statusMap[(err as { code?: string }).code ?? ''] ?? 400;
    return new Response(JSON.stringify({ error: err }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
