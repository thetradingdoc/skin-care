export const CONSENT_POLICY_VERSION = '2026-06';

export const KEYS = {
  /** JSON face_read: age, findings[], concern_scores, zone_polygons, scan_summary, reject fields, etc. */
  FACE_READ: 'sc_onboarding_face_read',
  FACE_PHOTO_URL: 'sc_onboarding_face_photo_url',
  JOURNEY_ID: 'sc_onboarding_journey_id',
  CONSENT: 'sc_onboarding_consent',
  CONFIRMED_AGE: 'sc_onboarding_confirmed_age',
  CONCERN_ID: 'sc_onboarding_concern_id',
  MATCH_JSON: 'sc_onboarding_match_json',
  QUICK_CHECK: 'sc_onboarding_quick_check',
  SUGGESTED_CONCERNS: 'sc_onboarding_suggested_concerns',
  ZONE_BREAKDOWN: 'sc_onboarding_zone_breakdown',
  QUICK_CHECK_DONE: 'sc_onboarding_quick_check_done',
  WATCH_ONLY: 'sc_onboarding_watch_only',
};

export function getFaceRead() {
  try {
    const raw = sessionStorage.getItem(KEYS.FACE_READ);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setFaceRead(payload) {
  if (!payload) {
    sessionStorage.removeItem(KEYS.FACE_READ);
    return;
  }
  sessionStorage.setItem(KEYS.FACE_READ, JSON.stringify(payload));
}

export function getFacePhotoUrl() {
  try {
    return sessionStorage.getItem(KEYS.FACE_PHOTO_URL);
  } catch {
    return null;
  }
}

export function setFacePhotoUrl(dataUrl) {
  if (!dataUrl) {
    sessionStorage.removeItem(KEYS.FACE_PHOTO_URL);
    return;
  }
  sessionStorage.setItem(KEYS.FACE_PHOTO_URL, dataUrl);
}

export function getPhotoAnalysisConsent() {
  try {
    const raw = sessionStorage.getItem(KEYS.CONSENT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasPhotoAnalysisConsent() {
  const c = getPhotoAnalysisConsent();
  return Boolean(c?.consent_photo_analysis && c?.policy_version === CONSENT_POLICY_VERSION);
}

export function setPhotoAnalysisConsent() {
  sessionStorage.setItem(
    KEYS.CONSENT,
    JSON.stringify({
      consent_photo_analysis: true,
      policy_version: CONSENT_POLICY_VERSION,
      consent_at: new Date().toISOString(),
      consent_channel: 'web_scan',
    })
  );
}

export function getConfirmedAge() {
  try {
    const raw = sessionStorage.getItem(KEYS.CONFIRMED_AGE);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setConfirmedAge(age) {
  if (age == null) {
    sessionStorage.removeItem(KEYS.CONFIRMED_AGE);
    return;
  }
  sessionStorage.setItem(KEYS.CONFIRMED_AGE, String(Math.round(age)));
}

export function getConcernId() {
  return sessionStorage.getItem(KEYS.CONCERN_ID);
}

export function setConcernId(id) {
  sessionStorage.setItem(KEYS.CONCERN_ID, id);
}

export function getMatchJson() {
  try {
    const raw = sessionStorage.getItem(KEYS.MATCH_JSON);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setMatchJson(match) {
  if (!match) {
    sessionStorage.removeItem(KEYS.MATCH_JSON);
    return;
  }
  sessionStorage.setItem(KEYS.MATCH_JSON, JSON.stringify(match));
}

export function getQuickCheck() {
  try {
    const raw = sessionStorage.getItem(KEYS.QUICK_CHECK);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setQuickCheck(answers) {
  if (!answers) {
    sessionStorage.removeItem(KEYS.QUICK_CHECK);
    sessionStorage.removeItem(KEYS.QUICK_CHECK_DONE);
    return;
  }
  sessionStorage.setItem(KEYS.QUICK_CHECK, JSON.stringify(answers));
  sessionStorage.setItem(KEYS.QUICK_CHECK_DONE, '1');
}

export function isQuickCheckDone() {
  return sessionStorage.getItem(KEYS.QUICK_CHECK_DONE) === '1';
}

export function getSuggestedConcerns() {
  try {
    const raw = sessionStorage.getItem(KEYS.SUGGESTED_CONCERNS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setSuggestedConcerns(ids) {
  if (!ids?.length) {
    sessionStorage.removeItem(KEYS.SUGGESTED_CONCERNS);
    return;
  }
  sessionStorage.setItem(KEYS.SUGGESTED_CONCERNS, JSON.stringify(ids));
}

export function getZoneBreakdown() {
  try {
    const raw = sessionStorage.getItem(KEYS.ZONE_BREAKDOWN);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setZoneBreakdown(zones) {
  if (!zones) {
    sessionStorage.removeItem(KEYS.ZONE_BREAKDOWN);
    return;
  }
  sessionStorage.setItem(KEYS.ZONE_BREAKDOWN, JSON.stringify(zones));
}

export function getJourneyId() {
  try {
    return sessionStorage.getItem(KEYS.JOURNEY_ID);
  } catch {
    return null;
  }
}

export function setJourneyId(id) {
  if (!id) {
    sessionStorage.removeItem(KEYS.JOURNEY_ID);
    return;
  }
  sessionStorage.setItem(KEYS.JOURNEY_ID, String(id));
}

export function clearJourney() {
  Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k));
}

export function hasJourneyData() {
  return Boolean(getConcernId() || getFaceRead());
}

export function isWatchOnlyOnboarding() {
  try {
    return sessionStorage.getItem(KEYS.WATCH_ONLY) === '1';
  } catch {
    return false;
  }
}

export function setWatchOnlyOnboarding(enabled) {
  if (enabled) {
    sessionStorage.setItem(KEYS.WATCH_ONLY, '1');
  } else {
    sessionStorage.removeItem(KEYS.WATCH_ONLY);
  }
}
