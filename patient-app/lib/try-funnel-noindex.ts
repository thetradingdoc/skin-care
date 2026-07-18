/**
 * Phase E — try-* funnel is noindex.
 * Decision: avoid thin mid-funnel pages ranking as cold entry (product scan tools, not marketing).
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

const ROBOTS = 'noindex,nofollow';

export function useTryFunnelNoIndex() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let el = document.querySelector('meta[name="robots"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', ROBOTS);
  }, []);
}
