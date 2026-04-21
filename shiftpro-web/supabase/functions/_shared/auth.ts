import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: 'admin' | 'manager' | 'employee';
  userClient: SupabaseClient;
}

export async function requireAuth(
  authHeader: string | null
): Promise<AuthContext> {
  if (!authHeader) throw { code: 'UNAUTHORIZED', message: 'Missing authorization header' };

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Call the Auth REST API directly — avoids SDK-level ES256 JWT parsing
  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
    },
  });
  if (!authRes.ok) throw { code: 'UNAUTHORIZED', message: 'Invalid token' };
  const authUser = await authRes.json();
  if (!authUser?.id) throw { code: 'UNAUTHORIZED', message: 'Invalid token' };

  // Fetch org + role from profiles (JWT hook may not embed claims)
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('organization_id, role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!profile?.organization_id || !profile?.role) {
    throw { code: 'FORBIDDEN', message: 'No organization — complete onboarding first' };
  }

  // User-scoped client for RLS-aware queries (if needed by callers)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  return { userId: authUser.id, organizationId: profile.organization_id, role: profile.role as AuthContext['role'], userClient };
}

export function requireRole(
  auth: AuthContext,
  ...roles: Array<'admin' | 'manager' | 'employee'>
): void {
  if (!roles.includes(auth.role)) {
    throw { code: 'FORBIDDEN', message: 'Insufficient permissions' };
  }
}
