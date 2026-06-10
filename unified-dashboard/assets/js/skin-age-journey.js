/**
 * Web skin-age funnel — sessionStorage handoff to patient session after OTP.
 * Keys mirror skin-care-landing/src/lib/skinAgeStorage.js
 */
(function (global) {
  const KEYS = {
    FACE_READ: 'sc_onboarding_face_read',
    CONFIRMED_AGE: 'sc_onboarding_confirmed_age',
    CONCERN_ID: 'sc_onboarding_concern_id',
    MATCH_JSON: 'sc_onboarding_match_json',
    QUICK_CHECK: 'sc_onboarding_quick_check',
  };

  const EXTRA_KEYS = [
    'sc_onboarding_suggested_concerns',
    'sc_onboarding_zone_breakdown',
    'sc_onboarding_quick_check_done',
  ];

  const DEFAULT_CONCERN = 'anti_aging';

  function getFaceRead() {
    try {
      const raw = sessionStorage.getItem(KEYS.FACE_READ);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getConcernId() {
    return sessionStorage.getItem(KEYS.CONCERN_ID);
  }

  function getMatchJson() {
    try {
      const raw = sessionStorage.getItem(KEYS.MATCH_JSON);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getQuickCheck() {
    try {
      const raw = sessionStorage.getItem(KEYS.QUICK_CHECK);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearJourney() {
    Object.values(KEYS).forEach((k) => {
      try {
        sessionStorage.removeItem(k);
      } catch (_) {}
    });
    EXTRA_KEYS.forEach((k) => {
      try {
        sessionStorage.removeItem(k);
      } catch (_) {}
    });
  }

  function hasJourneyData() {
    return Boolean(getConcernId() || getFaceRead());
  }

  async function patientPost(sessionId, path, body) {
    const base = global.API_BASE || '';
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  async function completeSkinAgeJourney(sessionId) {
    if (!sessionId || !hasJourneyData()) return false;

    const concernId = getConcernId() || DEFAULT_CONCERN;
    const faceRead = getFaceRead();
    const matchJson = getMatchJson();
    const quickCheck = getQuickCheck();
    const confirmedRaw = sessionStorage.getItem(KEYS.CONFIRMED_AGE);
    const confirmedAge = confirmedRaw ? Number(confirmedRaw) : null;

    await patientPost(sessionId, '/api/patient/routine/template', { concern_id: concernId });

    if (faceRead || matchJson || quickCheck) {
      try {
        await patientPost(sessionId, '/api/patient/funnel/bridge', {
          concern_id: concernId,
          face_read: faceRead,
          match_result: matchJson,
          quick_check_answers: quickCheck,
          confirmed_age: Number.isFinite(confirmedAge) ? confirmedAge : undefined,
          user_goal: 'track_program',
        });
      } catch (_) {
        // bridge optional for v1
      }
    }

    clearJourney();
    return true;
  }

  global.SkinAgeJourney = {
    KEYS,
    hasJourneyData,
    completeSkinAgeJourney,
    clearJourney,
  };
})(typeof window !== 'undefined' ? window : globalThis);
