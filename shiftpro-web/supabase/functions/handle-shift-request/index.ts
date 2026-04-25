import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { requireAuth, requireRole } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAuth(req.headers.get('Authorization'));
    requireRole(auth, 'admin', 'manager');

    const { request_id, action, manager_note } = await req.json();

    if (!request_id || !action || !['approve', 'deny'].includes(action)) {
      throw { code: 'VALIDATION_ERROR', message: 'request_id and action (approve|deny) are required' };
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Load and validate the request
    const { data: request, error: rErr } = await svc
      .from('shift_requests')
      .select('id, type, status, requester_id, shift_id, target_shift_id, target_profile_id, organization_id')
      .eq('id', request_id)
      .eq('organization_id', auth.organizationId)
      .maybeSingle();

    if (rErr || !request) throw { code: 'NOT_FOUND', message: 'Request not found' };
    if (request.status !== 'pending') {
      throw { code: 'CONFLICT', message: 'Request has already been resolved' };
    }

    // Mark reviewed
    await svc.from('shift_requests').update({
      status: action === 'approve' ? 'approved' : 'denied',
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      manager_note: manager_note ?? null,
    }).eq('id', request_id);

    // Apply business logic on approve
    if (action === 'approve') {
      if (request.type === 'swap') {
        const { data: shiftA, error: errA } = await svc.from('shifts').select('profile_id').eq('id', request.shift_id).single();
        const { data: shiftB, error: errB } = await svc.from('shifts').select('profile_id').eq('id', request.target_shift_id).single();
        if (errA || errB || !shiftA || !shiftB) throw { code: 'NOT_FOUND', message: 'Shift not found for swap' };
        await svc.from('shifts').update({ profile_id: shiftB.profile_id }).eq('id', request.shift_id);
        await svc.from('shifts').update({ profile_id: shiftA.profile_id }).eq('id', request.target_shift_id);
      }
      if (request.type === 'offer') {
        await svc.from('shifts').update({ profile_id: request.target_profile_id, is_open_shift: false }).eq('id', request.shift_id);
      }
      if (request.type === 'drop') {
        await svc.from('shifts').update({ profile_id: null, is_open_shift: true }).eq('id', request.shift_id);
      }
      if (request.type === 'open_shift') {
        await svc.from('shifts').update({ profile_id: request.requester_id, is_open_shift: false }).eq('id', request.shift_id);
      }
    }

    return new Response(JSON.stringify({ data: { ok: true, action } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400, UNAUTHORIZED: 401, FORBIDDEN: 403,
      NOT_FOUND: 404, CONFLICT: 409, INTERNAL_ERROR: 500,
    };
    const status = statusMap[err.code] ?? 400;
    return new Response(JSON.stringify({ error: err }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
