export const KEYS = {
  FACE_READ: 'sc_onboarding_face_read',
  CONFIRMED_AGE: 'sc_onboarding_confirmed_age',
  CONCERN_ID: 'sc_onboarding_concern_id',
  MATCH_JSON: 'sc_onboarding_match_json',
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

export function clearJourney() {
  Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k));
}

export function hasJourneyData() {
  return Boolean(getConcernId() || getFaceRead());
}
