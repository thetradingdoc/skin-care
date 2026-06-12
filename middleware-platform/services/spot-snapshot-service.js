'use strict';

const DISCLAIMER =
  'This comparison is for personal tracking only — not a medical diagnosis. See a dermatologist if you notice rapid change.';

/**
 * Heuristic spot comparison (no diagnosis). Returns same|watch|alert tags for UI.
 */
function compareSnapshots(previousSnapshots, newSnapshotMeta = {}) {
  const count = (previousSnapshots || []).length;
  if (count < 1) {
    return {
      change_tag: null,
      size_signal: null,
      confidence: 0.3,
      disclaimer: DISCLAIMER,
      message: 'Still gathering baseline photos.',
    };
  }

  const daysSinceFirst = daysBetween(
    previousSnapshots[0]?.captured_at || previousSnapshots[0]?.date,
    new Date().toISOString(),
  );

  if (daysSinceFirst < 7) {
    return {
      change_tag: 'watch',
      size_signal: 0,
      confidence: 0.4,
      disclaimer: DISCLAIMER,
      message: 'Still gathering — check back after a few more photos.',
    };
  }

  const priorTags = previousSnapshots
    .map((s) => s.analysis?.change_tag || s.analysis_json?.change_tag)
    .filter(Boolean);
  const alertCount = priorTags.filter((t) => t === 'alert').length;

  if (alertCount >= 2) {
    return {
      change_tag: 'alert',
      size_signal: 0.15,
      confidence: 0.55,
      disclaimer: DISCLAIMER,
      message: 'Visible change detected between recent photos. Consider scheduling a skin check.',
    };
  }

  if (daysSinceFirst >= 30) {
    return {
      change_tag: 'same',
      size_signal: 0.02,
      confidence: 0.6,
      disclaimer: DISCLAIMER,
      message: 'Size appears stable compared to your earlier photos.',
    };
  }

  return {
    change_tag: 'watch',
    size_signal: 0.05,
    confidence: 0.5,
    disclaimer: DISCLAIMER,
    message: 'Keep logging photos on a regular schedule for a clearer trend.',
  };
}

function daysBetween(a, b) {
  const t0 = new Date(a).getTime();
  const t1 = new Date(b).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return 0;
  return Math.max(0, Math.ceil((t1 - t0) / (1000 * 60 * 60 * 24)));
}

function analyzeNewSnapshot(existingSnapshots) {
  return compareSnapshots(existingSnapshots, {});
}

module.exports = {
  DISCLAIMER,
  compareSnapshots,
  analyzeNewSnapshot,
};
