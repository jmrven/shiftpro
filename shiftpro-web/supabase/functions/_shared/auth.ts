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

  const token = authHeader.replace('Bearer ', '');

  // Service role client — Auth server verifies the JWT (supports ES256/HS256)
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: { user }, error } = await serviceClient.auth.getUser(token);
  if (error || !user) throw { code: 'UNAUTHORIZED', message: 'Invalid token' };

  // Fetch org + role from profiles directly (JWT hook may not have embedded claims)
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.organization_id || !profile?.role) {
    throw { code: 'FORBIDDEN', message: 'No organization — complete onboarding first' };
  }

  // User-scoped client for RLS-aware queries (if needed by callers)
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  return { userId: user.id, organizationId: profile.organization_id, role: profile.role as AuthContext['role'], userClient };
}

export function requireRole(
  auth: AuthContext,
  ...roles: Array<'admin' | 'manager' | 'employee'>
): void {
  if (!roles.includes(auth.role)) {
    throw { code: 'FORBIDDEN', message: 'Insufficient permissions' };
  }
}
