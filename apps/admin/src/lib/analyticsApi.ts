import { API_URL } from './api';
import type { SpendReport } from './spend';

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

// GET /api/analytics/spend (apps/api/analytics_spend.go): gasto por campanha na Meta e no Google Ads, datas AAAA-MM-DD.
export async function loadSpend(from: string, to: string): Promise<SpendReport> {
  const res = await fetch(`${API_URL}/api/analytics/spend?from=${from}&to=${to}`, { credentials: 'include' });
  if (!res.ok) {
    let msg = `erro ${res.status}`;
    try { msg = (await res.json())?.error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return res.json();
}
