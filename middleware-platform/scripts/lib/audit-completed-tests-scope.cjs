'use strict';

/**
 * Audit completed-tests scope.
 * null = every phase in the YAML SSOT (whole-project default).
 * A Set = explicit --phases= filter.
 *
 * Guarded by __tests__/audit-script-default-scope.test.js — do not reintroduce
 * a hard-coded default like '0,1,2' without that test failing.
 */

function resolveAuditPhases(argv = process.argv) {
  const phasesArg = argv.find((a) => String(a).startsWith('--phases='));
  if (!phasesArg) {
    return null;
  }
  return new Set(
    String(phasesArg)
      .split('=')[1]
      .split(',')
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n)),
  );
}

function phaseLabel(phases) {
  if (phases == null) return 'all';
  return [...phases].sort((a, b) => a - b).join(',');
}

function includesPhase(phases, phaseNum) {
  if (phases == null) return true;
  return phases.has(phaseNum);
}

module.exports = {
  resolveAuditPhases,
  phaseLabel,
  includesPhase,
  /** Sentinel for docs/tests: default scope is unscoped (all phases). */
  DEFAULT_SCOPE_ALL_PHASES: null,
};
