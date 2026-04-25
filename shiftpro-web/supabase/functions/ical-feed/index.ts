import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function escapeIcal(str: string): string {
  return str.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

function formatDtStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const profileId = url.searchParams.get('profile_id');
  if (!profileId) return new Response('profile_id is required', { status: 400, headers: CORS });

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile, error: pErr } = await svc
    .from('profiles')
    .select('id, first_name, last_name, organization_id')
    .eq('id', profileId)
    .maybeSingle();

  if (pErr || !profile) return new Response('Profile not found', { status: 404, headers: CORS });

  const { data: org } = await svc
    .from('organizations')
    .select('name, timezone')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const { data: shifts, error: sErr } = await svc
    .from('shifts')
    .select(`
      id, start_time, end_time, break_minutes, notes,
      position:positions!position_id(name),
      job_site:job_sites!job_site_id(name, address)
    `)
    .eq('profile_id', profileId)
    .eq('status', 'published')
    .gte('start_time', now.toISOString())
    .lt('start_time', horizon.toISOString())
    .order('start_time');

  if (sErr) return new Response('Internal error', { status: 500, headers: CORS });

  const orgName = org?.name ?? 'ShiftPro';
  const name = `${profile.first_name} ${profile.last_name}`;

  const veventBlocks = (shifts ?? []).map((s: any) => {
    const dtStart = formatDtStamp(new Date(s.start_time));
    const dtEnd = formatDtStamp(new Date(s.end_time));
    const dtStamp = formatDtStamp(now);
    const uid = `shift-${s.id}@shiftpro.app`;
    const summary = escapeIcal(s.position?.name ?? 'Shift');
    const location = s.job_site
      ? escapeIcal(`${s.job_site.name}${s.job_site.address ? `, ${s.job_site.address}` : ''}`)
      : '';
    const desc = s.notes ? escapeIcal(s.notes) : '';

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      location ? `LOCATION:${location}` : '',
      desc ? `DESCRIPTION:${desc}` : '',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  });

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ShiftPro//ShiftPro Calendar//EN',
    `X-WR-CALNAME:${escapeIcal(`${orgName} – ${name}`)}`,
    `X-WR-TIMEZONE:${org?.timezone ?? 'UTC'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...veventBlocks,
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ical, {
    headers: {
      ...CORS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="shiftpro-${profile.first_name.toLowerCase()}.ics"`,
      'Cache-Control': 'no-cache',
    },
  });
});
