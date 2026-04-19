import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { callFunction } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Phoenix', 'Pacific/Honolulu',
  'America/Anchorage', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
];

const schema = z.object({
  org_name: z.string().min(2, 'Organization name is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  admin_first_name: z.string().min(1, 'First name is required'),
  admin_last_name: z.string().min(1, 'Last name is required'),
});
type FormValues = z.infer<typeof schema>;

export function OnboardingPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: 'America/New_York' },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      await callFunction('create-organization', values);
      // Sign out so the next login generates a fresh JWT with org claims via the custom_access_token_hook
      await supabase.auth.signOut();
      navigate('/login', { state: { message: 'Organization created! Sign in to continue.' } });
    } catch (err: unknown) {
      console.error('[onboarding] error:', err);
      // FunctionsHttpError carries the response body — extract it
      let msg = (err as { message?: string }).message ?? 'Something went wrong';
      try {
        const body = await (err as { context?: Response }).context?.json();
        console.error('[onboarding] error body:', body);
        if (body?.error?.message) msg = body.error.message;
      } catch { /* response not JSON */ }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Set up your organization</h1>
          <p className="text-sm text-muted-foreground mt-1">This takes about 30 seconds</p>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Sign out
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {(['org_name', 'admin_first_name', 'admin_last_name'] as const).map((field) => (
            <div key={field} className="space-y-1">
              <label className="text-sm font-medium" htmlFor={field}>
                {field === 'org_name' ? 'Organization name' : field === 'admin_first_name' ? 'Your first name' : 'Your last name'}
              </label>
              <input
                id={field}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...register(field)}
              />
              {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
            </div>
          ))}

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="timezone">Timezone</label>
            <select
              id="timezone"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('timezone')}
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
