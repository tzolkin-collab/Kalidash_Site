import { API_URL } from './api';

// GET /api/analytics/tracking-health (apps/api/analytics.go): entregas para a Meta e o GA4 por evento e status.

export type HealthCount = { name: string; layer: 'meta' | 'ga4'; status: string; count: number };
export type HealthError = { name: string; source: string; error: string; at?: string };
export type TrackingHealth = { days: number; configured: { meta?: boolean; ga4?: boolean }; offline: boolean; counts: HealthCount[]; errors: HealthError[] };

export async function loadTrackingHealth(days = 30): Promise<TrackingHealth> {
  const res = await fetch(`${API_URL}/api/analytics/tracking-health?days=${days}`, { credentials: 'include' });
  if (!res.ok) {
    let msg = `erro ${res.status}`;
    try { msg = (await res.json())?.error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return res.json();
}
