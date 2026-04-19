import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateOrgRequest {
  org_name: string;
  timezone: string;
  admin_first_name: string;
  admin_last_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw { code: 'UNAUTHORIZED', message: 'Missing authorization header' };

    // User-scoped client — lets the Auth server verify ES256 JWTs
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw { code: 'UNAUTHORIZED', message: 'Invalid token' };

    // Service role client for privileged writes
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Prevent creating a second org if user already has one
    const { data: existing } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (existing?.organization_id) {
      throw { code: 'CONFLICT', message: 'User already belongs to an organization' };
    }

    const body: CreateOrgRequest = await req.json();
    if (!body.org_name || !body.timezone || !body.admin_first_name || !body.admin_last_name) {
      throw { code: 'VALIDATION_ERROR', message: 'Missing required fields' };
    }

    const slug = body.org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Create org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: body.org_name, slug, timezone: body.timezone })
      .select()
      .single();

    if (orgError) {
      if (orgError.code === '23505') throw { code: 'CONFLICT', message: 'Organization name already taken' };
      throw { code: 'INTERNAL_ERROR', message: orgError.message };
    }

    // Create admin profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        organization_id: org.id,
        role: 'admin',
        status: 'active',
        first_name: body.admin_first_name,
        last_name: body.admin_last_name,
        email: user.email!,
      });

    if (profileError) throw { code: 'INTERNAL_ERROR', message: profileError.message };

    return new Response(JSON.stringify({ data: { organization: org } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const statusMap: Record<string, number> = { UNAUTHORIZED: 401, FORBIDDEN: 403, CONFLICT: 409, INTERNAL_ERROR: 500 };
    const status = statusMap[err.code] ?? 400;
    return new Response(JSON.stringify({ error: err }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
