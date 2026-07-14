'use strict';

/**
 * TOUCH-039/042 — Severity enum ↔ chart rank helpers.
 * Never invent silent 0–10 without advanced mode (TOUCH-102/103).
 */

const LEVELS = Object.freeze(['low', 'some', 'a_lot']);
const CALM = Object.freeze(['yes', 'no']);

function normalizeLevel(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (v === 'alot' || v === 'a-lot') return 'a_lot';
  if (LEVELS.includes(v)) return v;
  return null;
}

function normalizeCalm(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'true' || v === '1') return 'yes';
  if (v === 'false' || v === '0') return 'no';
  if (CALM.includes(v)) return v;
  return null;
}

/** low→1, some→2, a_lot→3 */
function levelToRank(level) {
  const n = normalizeLevel(level);
  if (n === 'low') return 1;
  if (n === 'some') return 2;
  if (n === 'a_lot') return 3;
  return null;
}

function rankToLevel(rank) {
  const r = Number(rank);
  if (r === 1) return 'low';
  if (r === 2) return 'some';
  if (r === 3) return 'a_lot';
  return null;
}

/** Map advanced 1–10 score → plain rank bucket (TOUCH-103). */
function scoreToRank(score) {
  const s = Number(score);
  if (!Number.isFinite(s) || s < 1 || s > 10) return null;
  if (s <= 3) return 1;
  if (s <= 6) return 2;
  return 3;
}

function scoreToLevel(score) {
  return rankToLevel(scoreToRank(score));
}

function normalizeSeverityPayload(body = {}) {
  const advanced = Boolean(body.advanced_severity || body.advanced);
  let dryness_level = normalizeLevel(body.dryness_level ?? body.dryness);
  let breakout_level = normalizeLevel(body.breakout_level ?? body.breakout ?? body.breakout_y);
  const calm_flag = normalizeCalm(body.calm_flag ?? body.calm);

  let dryness_score = null;
  let breakout_score = null;

  if (advanced) {
    dryness_score = Number(body.dryness_score);
    breakout_score = Number(body.breakout_score);
    if (!Number.isFinite(dryness_score) || dryness_score < 1 || dryness_score > 10) dryness_score = null;
    if (!Number.isFinite(breakout_score) || breakout_score < 1 || breakout_score > 10) breakout_score = null;
    if (dryness_score != null && !dryness_level) dryness_level = scoreToLevel(dryness_score);
    if (breakout_score != null && !breakout_level) breakout_level = scoreToLevel(breakout_score);
  }

  return {
    dryness_level,
    breakout_level,
    calm_flag,
    dryness_score: advanced ? dryness_score : null,
    breakout_score: advanced ? breakout_score : null,
    advanced_severity: advanced ? 1 : 0,
    dryness_rank: levelToRank(dryness_level),
    breakout_rank: levelToRank(breakout_level),
  };
}

module.exports = {
  LEVELS,
  CALM,
  normalizeLevel,
  normalizeCalm,
  levelToRank,
  rankToLevel,
  scoreToRank,
  scoreToLevel,
  normalizeSeverityPayload,
};
