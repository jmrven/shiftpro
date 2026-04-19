import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AuditEntry {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  organization_id: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip_address?: string;
}

export async function createAuditLog(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert(entry);
  if (error) console.error('Audit log failed:', error);
}
