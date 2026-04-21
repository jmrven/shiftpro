import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { callFunction } from '@/lib/api';

export type TemplateRow = {
  id: string;
  name: string;
  schedule_id: string;
  created_at: string;
};

export function useScheduleTemplates(scheduleId: string | null) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: ['templates', scheduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_templates')
        .select('id, name, schedule_id, created_at')
        .eq('organization_id', organizationId!)
        .eq('schedule_id', scheduleId!)
        .order('name');
      if (error) throw error;
      return data as TemplateRow[];
    },
    enabled: !!scheduleId && !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: async ({
      scheduleId, name, weekStart, weekEnd,
    }: { scheduleId: string; name: string; weekStart: string; weekEnd: string }) => {
      const { data: template, error: tErr } = await supabase
        .from('schedule_templates')
        .insert({ organization_id: organizationId!, schedule_id: scheduleId, name })
        .select()
        .single();
      if (tErr) throw tErr;

      const { data: shifts, error: sErr } = await supabase
        .from('shifts')
        .select('position_id, start_time, end_time, break_minutes, notes')
        .eq('schedule_id', scheduleId)
        .gte('start_time', weekStart)
        .lt('start_time', weekEnd);
      if (sErr) throw sErr;

      type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
      const DAY_NAMES: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const templateShifts = (shifts ?? []).map((s) => {
        const d = new Date(s.start_time);
        const e = new Date(s.end_time);
        return {
          template_id:   template.id,
          position_id:   s.position_id,
          day_of_week:   DAY_NAMES[d.getUTCDay()],
          start_time:    `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
          end_time:      `${String(e.getUTCHours()).padStart(2, '0')}:${String(e.getUTCMinutes()).padStart(2, '0')}`,
          break_minutes: s.break_minutes,
          notes:         s.notes,
        };
      });

      if (templateShifts.length > 0) {
        const { error: tiErr } = await supabase
          .from('schedule_template_shifts')
          .insert(templateShifts);
        if (tiErr) throw tiErr;
      }

      return template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { template_id: string; week_start: string; timezone: string }) =>
      callFunction('apply-template', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useCopyPreviousWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { schedule_id: string; target_week_start: string }) =>
      callFunction('copy-previous-week', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}
