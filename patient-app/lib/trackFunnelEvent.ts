import { patientPost } from '@/lib/patient-api';

export type FunnelEventDetail = {
  route?: string;
  concern_id?: string;
  user_goal?: string;
};

/** Signed-in funnel handoff events — whitelist in patient-funnel-bridge.js */
export function trackFunnelEvent(event: string, detail?: FunnelEventDetail): void {
  void patientPost('/api/patient/funnel/event', {
    event,
    event_name: event,
    ...detail,
  }).catch(() => {});
}
