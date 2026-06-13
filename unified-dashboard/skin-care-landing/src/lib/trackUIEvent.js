import { apiUrl } from './apiBase.js';
import { getJourneyId, setJourneyId } from './skinAgeStorage.js';
import { getVisitorId } from './visitorId.js';
import { publicPost } from './publicApi.js';

const QUEUE_KEY = 'sc_funnel_event_queue';

function readQueue() {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)));
  } catch {
    /* ignore */
  }
}

async function postEvent(journeyId, eventType, metadata = {}) {
  const payload = {
    url: typeof window !== 'undefined' ? window.location.pathname : null,
    ts: new Date().toISOString(),
    visitor_id: getVisitorId(),
    ...metadata,
  };
  await fetch(apiUrl(`/api/public/funnel/journey/${encodeURIComponent(journeyId)}/event`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ event_type: eventType, payload }),
  });
}

export async function ensureJourneyId() {
  let jid = getJourneyId();
  if (jid) return jid;
  try {
    const res = await publicPost('/api/public/funnel/journey', { visitor_id: getVisitorId() });
    if (res?.journey_id) {
      setJourneyId(res.journey_id);
      return res.journey_id;
    }
  } catch {
    /* optional */
  }
  return null;
}

export async function flushQueuedEvents() {
  const jid = getJourneyId() || (await ensureJourneyId());
  if (!jid) return;
  const queue = readQueue();
  if (!queue.length) return;
  writeQueue([]);
  for (const item of queue) {
    try {
      await postEvent(jid, item.event_type, item.metadata || {});
    } catch {
      /* never block UX */
    }
  }
}

/**
 * Security observability — fire-and-forget UI events to funnel_journey_events.
 */
export function trackUIEvent(eventType, metadata = {}) {
  const jid = getJourneyId();
  const run = async () => {
    const journeyId = jid || (await ensureJourneyId());
    if (!journeyId) {
      const q = readQueue();
      q.push({ event_type: eventType, metadata });
      writeQueue(q);
      return;
    }
    await flushQueuedEvents();
    await postEvent(journeyId, eventType, metadata);
  };
  void run().catch(() => {});
}
