import { useState } from 'react';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import {
  useScheduleTemplates, useSaveTemplate, useApplyTemplate, useDeleteTemplate,
} from '@/hooks/useScheduleTemplates';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  currentWeek: Date;
}

export function TemplateModal({ open, onClose, scheduleId, currentWeek }: Props) {
  const organization = useAuthStore((s) => s.organization);
  const timezone     = organization?.timezone ?? 'UTC';

  const { data: templates = [] } = useScheduleTemplates(scheduleId);
  const saveTemplate   = useSaveTemplate();
  const applyTemplate  = useApplyTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [newName, setNewName] = useState('');
  const [tab, setTab] = useState<'save' | 'apply'>('apply');

  const weekStart    = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd      = addDays(endOfWeek(weekStart, { weekStartsOn: 0 }), 1);
  const weekLabel    = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  async function handleSave() {
    if (!newName.trim()) return;
    await saveTemplate.mutateAsync({
      scheduleId,
      name: newName.trim(),
      weekStart: weekStart.toISOString(),
      weekEnd:   weekEnd.toISOString(),
    });
    setNewName('');
  }

  async function handleApply(templateId: string) {
    await applyTemplate.mutateAsync({ template_id: templateId, week_start: weekStartStr, timezone });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-background rounded-lg shadow-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Schedule Templates</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="flex gap-2 border-b border-border pb-3 mb-4">
          <button
            onClick={() => setTab('apply')}
            className={`text-sm px-3 py-1.5 rounded-md ${tab === 'apply' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Apply Template
          </button>
          <button
            onClick={() => setTab('save')}
            className={`text-sm px-3 py-1.5 rounded-md ${tab === 'save' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Save as Template
          </button>
        </div>

        {tab === 'save' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Save all shifts from <strong>{weekLabel}</strong> as a reusable template.
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Standard Week"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            />
            <button
              onClick={handleSave}
              disabled={!newName.trim() || saveTemplate.isPending}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saveTemplate.isPending ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        )}

        {tab === 'apply' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Apply a template to <strong>{weekLabel}</strong>. Creates open draft shifts from the template.
            </p>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No templates yet. Switch to "Save as Template" to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded border border-border">
                    <span className="text-sm font-medium">{t.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApply(t.id)}
                        disabled={applyTemplate.isPending}
                        className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => deleteTemplate.mutateAsync(t.id)}
                        className="h-7 px-3 rounded border border-destructive text-destructive text-xs hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
