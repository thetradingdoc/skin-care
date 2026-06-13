import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { getVisitorId } from '../lib/visitorId.js';
import { trackUIEvent } from '../lib/trackUIEvent.js';

export default function FunnelRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    getVisitorId();
    trackUIEvent('page_view', { pathname: location.pathname });
  }, [location.pathname]);

  return null;
}
