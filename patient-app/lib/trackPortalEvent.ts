import { patientPost } from '@/lib/patient-api';

export type PortalAnalyticsDetail = Record<string, unknown>;

/** Post-auth UI audit — whitelisted server-side in portal-analytics-events.js */
export function trackPortalEvent(event: string, metadata?: PortalAnalyticsDetail): void {
  void patientPost('/api/patient/analytics/event', { event, metadata: metadata || {} }).catch(() => {});
}
