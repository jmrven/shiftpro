import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NotificationType =
  | 'shift_published'
  | 'shift_reminder'
  | 'timeoff_approved'
  | 'timeoff_rejected'
  | 'timeoff_request'
  | 'task_assigned'
  | 'policy_published'
  | 'message_received'
  | 'clock_reminder';

interface NotificationPayload {
  user_id: string;
  organization_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendNotification(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<void> {
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) console.error('Notification insert failed:', error);
}

export async function sendNotifications(
  supabase: SupabaseClient,
  payloads: NotificationPayload[]
): Promise<void> {
  if (payloads.length === 0) return;
  const { error } = await supabase.from('notifications').insert(payloads);
  if (error) console.error('Batch notification insert failed:', error);
}
