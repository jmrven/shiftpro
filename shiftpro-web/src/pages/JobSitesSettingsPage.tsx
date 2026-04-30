import { useState } from 'react';
import { useJobSites, useUpsertJobSite, type JobSiteRow } from '@/hooks/useJobSites';

type FormState = {
  id?: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofence_radius_meters: number;
};

const empty: FormState = { name: '', address: '', latitude: '', longitude: '', geofence_radius_meters: 200 };

export function JobSitesSettingsPage() {
  const { data: jobSites = [], isLoading } = useJobSites();
  const upsert = useUpsertJobSite();
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(site: JobSiteRow) {
    setForm({
      id: site.id,
      name: site.name,
      address: site.address ?? '',
      latitude: '',
      longitude: '',
      geofence_radius_meters: site.geofence_radius_meters,
    });
    setEditing(true);
  }

  function startNew() {
    setForm(empty);
    setEditing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await upsert.mutateAsync({
        id: form.id,
        name: form.name,
        address: form.address || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        geofence_radius_meters: form.geofence_radius_meters,
      });
      setEditing(false);
      setForm(empty);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold">Job Sites & Geofences</h1>
      </div>
      <div className="flex-1 overflow-auto p-4 max-w-2xl space-y-6">
        <div className="flex justify-end">
          <button
            onClick={startNew}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            + Add Job Site
          </button>
        </div>

        {editing && (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-4 space-y-4">
            <h2 className="font-medium">{form.id ? 'Edit Job Site' : 'New Job Site'}</h2>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-1 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Name *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Address</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 47.6062"
                    value={form.latitude}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. -122.3321"
                    value={form.longitude}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Geofence Radius: {form.geofence_radius_meters}m
                </span>
                <input
                  type="range"
                  min={50}
                  max={2000}
                  step={50}
                  value={form.geofence_radius_meters}
                  onChange={(e) => setForm((f) => ({ ...f, geofence_radius_meters: parseInt(e.target.value) }))}
                  className="mt-1 block w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>50m</span><span>2000m</span>
                </div>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-md border border-border text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={upsert.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
              >
                {upsert.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : jobSites.length === 0 ? (
          <div className="text-sm text-muted-foreground">No job sites configured yet.</div>
        ) : (
          <ul className="space-y-2">
            {jobSites.map((site) => (
              <li key={site.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{site.name}</div>
                  {site.address && <div className="text-xs text-muted-foreground">{site.address}</div>}
                  <div className="text-xs text-muted-foreground">
                    Geofence: {site.geofence_radius_meters}m radius
                  </div>
                </div>
                <button
                  onClick={() => startEdit(site)}
                  className="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
