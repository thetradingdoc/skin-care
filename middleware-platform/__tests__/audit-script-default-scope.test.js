'use strict';

/**
 * Closing guard: the completed-tests audit tool must default to ALL phases.
 * A silent re-narrow to 0,1,2 (or any subset) is a verification-tool regression —
 * worse than product dual-write, because every "N/N verified" claim lies about scope.
 *
 * Not a plan phase todo — it guards the verifier itself.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  resolveAuditPhases,
  phaseLabel,
  includesPhase,
  DEFAULT_SCOPE_ALL_PHASES,
} = require('../scripts/lib/audit-completed-tests-scope.cjs');

const ROOT = path.join(__dirname, '..');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'audit-phase02-completed-tests.cjs');
const SCOPE_LIB = path.join(ROOT, 'scripts', 'lib', 'audit-completed-tests-scope.cjs');
const REPO_TODOS = path.join(ROOT, '..', 'docs', 'product', 'agentic-tracker-plan-todos.yaml');

describe('audit script default scope (self-check)', () => {
  test('resolveAuditPhases with no --phases is null (all phases) — never 0,1,2', () => {
    expect(DEFAULT_SCOPE_ALL_PHASES).toBeNull();
    expect(resolveAuditPhases(['node', 'audit.cjs'])).toBeNull();
    expect(resolveAuditPhases([])).toBeNull();
    expect(phaseLabel(null)).toBe('all');
    expect(includesPhase(null, 0)).toBe(true);
    expect(includesPhase(null, 7)).toBe(true);
    expect(includesPhase(null, 99)).toBe(true);

    const narrowed = resolveAuditPhases(['node', 'audit.cjs', '--phases=0,1,2']);
    expect(narrowed).toBeInstanceOf(Set);
    expect(narrowed.has(0)).toBe(true);
    expect(narrowed.has(7)).toBe(false);
    expect(phaseLabel(narrowed)).toBe('0,1,2');
  });

  test('audit script source wires resolveAuditPhases — no hard-coded 0,1,2 default', () => {
    const src = fs.readFileSync(AUDIT_SCRIPT, 'utf8');
    expect(src).toMatch(/resolveAuditPhases/);
    expect(src).toMatch(/audit-completed-tests-scope\.cjs/);
    // The regression that bit the whole build:
    expect(src).not.toMatch(/: '0,1,2'/);
    expect(src).not.toMatch(/phasesArg \? phasesArg\.split\(.*?\) : '0,1,2'/);
    expect(src).not.toMatch(/DEFAULT.*0,\s*1,\s*2/);

    const lib = fs.readFileSync(SCOPE_LIB, 'utf8');
    expect(lib).toMatch(/if \(!phasesArg\) \{\s*return null;/);
    expect(lib).toMatch(/do not reintroduce/);
  });

  test('filterless --json run reports phases:all and includes every YAML phase with completed todos', () => {
    const yaml = fs.readFileSync(REPO_TODOS, 'utf8');
    const phaseNums = new Set();
    for (const m of yaml.matchAll(/- id: p(\d+)-\d+\n\s+content: .+\n\s+status: completed/g)) {
      phaseNums.add(Number(m[1]));
    }
    expect(phaseNums.size).toBeGreaterThanOrEqual(8); // 0..7 at minimum after Phase 7
    expect(phaseNums.has(0)).toBe(true);
    expect(phaseNums.has(7)).toBe(true);

    const run = spawnSync(process.execPath, [AUDIT_SCRIPT, '--json'], {
      encoding: 'utf8',
      cwd: ROOT,
      env: process.env,
      timeout: 60_000,
    });
    expect(run.status).toBe(0);
    const payload = JSON.parse(run.stdout);
    expect(payload.phases).toBe('all');
    expect(payload.totals.completed).toBeGreaterThan(50);
    expect(payload.totals.unverified).toBe(0);

    // Behavioral: a 0,1,2-only run must be smaller than the default
    const narrow = spawnSync(
      process.execPath,
      [AUDIT_SCRIPT, '--json', '--phases=0,1,2'],
      { encoding: 'utf8', cwd: ROOT, env: process.env, timeout: 60_000 },
    );
    expect(narrow.status).toBe(0);
    const narrowPayload = JSON.parse(narrow.stdout);
    expect(Array.isArray(narrowPayload.phases) || narrowPayload.phases === '0,1,2').toBe(true);
    expect(narrowPayload.totals.completed).toBeLessThan(payload.totals.completed);
  });
});
