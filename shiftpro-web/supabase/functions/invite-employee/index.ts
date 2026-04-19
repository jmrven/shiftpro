import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { requireAuth, requireRole } from '../_shared/auth.ts';
import { createAuditLog } from '../_shared/audit.ts';

interface InviteRequest {
  email: string;
  first_name: string;
  last_name: string;
  role: 'manager' | 'employee';
  position_ids?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAuth(req.headers.get('Authorization'));
    requireRole(auth, 'admin', 'manager');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: InviteRequest = await req.json();
    if (!body.email || !body.first_name || !body.last_name || !body.role) {
      throw { code: 'VALIDATION_ERROR', message: 'Missing required fields: email, first_name, last_name, role' };
    }

    // Check for duplicate in this org
    const { data: dup } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('email', body.email)
      .maybeSingle();

    if (dup) throw { code: 'CONFLICT', message: 'An employee with this email already exists' };

    // Managers can only invite employees, not other managers
    if (auth.role === 'manager' && body.role !== 'employee') {
      throw { code: 'FORBIDDEN', message: 'Managers can only invite employees' };
    }

    // Send Supabase auth invite email
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      body.email,
      {
        data: { organization_id: auth.organizationId, invited_role: body.role },
        redirectTo: `${siteUrl}/accept-invite`,
      }
    );

    if (inviteError) throw { code: 'INTERNAL_ERROR', message: inviteError.message };

    // Create profile record (status: invited)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: inviteData.user.id,
        organization_id: auth.organizationId,
        role: body.role,
        status: 'invited',
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
      })
      .select()
      .single();

    if (profileError) throw { code: 'INTERNAL_ERROR', message: profileError.message };

    // Assign positions if provided
    if (body.position_ids?.length) {
      await supabase.from('profile_positions').insert(
        body.position_ids.map((pid) => ({ profile_id: profile.id, position_id: pid }))
      );
    }

    await createAuditLog(supabase, {
      actor_id: auth.userId,
      organization_id: auth.organizationId,
      action: 'invite_employee',
      entity_type: 'profile',
      entity_id: profile.id,
    });

    return new Response(JSON.stringify({ data: { profile } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const statusMap: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INTERNAL_ERROR: 500 };
    const status = statusMap[err.code] ?? 400;
    return new Response(JSON.stringify({ error: err }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
