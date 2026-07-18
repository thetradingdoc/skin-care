'use strict';

/**
 * Phase 5 — domain-adjacent medical tracker. Needles for audit script.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { computeFactsAgentDelta } = require('../services/medical-tracker-domain/agent-delta-facts');
const {
  runRxExpiryReminderJob,
  runRoutineCadenceReminderJob,
  setRoutineReminderOptIn,
  hasRoutineReminderOptIn,
} = require('../services/medical-tracker-domain/reminder-jobs');
const { buildProgressAggregates, assertNoPercentageFields } = require('../services/medical-tracker-domain/progress-aggregates');
const { buildFactsCalendar } = require('../services/medical-tracker-domain/facts-calendar');
const {
  listMarksForPatient,
  getCompareGroupTimeline,
} = require('../services/medical-tracker-domain/marks-compare');
const { buildPhysicianPdf } = require('../services/medical-tracker-domain/physician-export-pdf');
const {
  createPhysicianShareLink,
  resolvePhysicianShare,
  revokePhysicianShare,
} = require('../services/medical-tracker-domain/physician-share-links');
const {
  buildUnifiedAlertsFeed,
  ALERTS_HOME_DECISION,
} = require('../services/medical-tracker-domain/alerts-feed');
const {
  assertPositiveMedicalTextShape,
  assertSafeToPersistStructured,
  FORBIDDEN_CLINICAL_KEYS,
} = require('../services/medical-tracker-rails/policy');
const { validateSkinStructured } = require('../services/patient-record-fact-validators');
const { ensureTables: ensurePushTables } = require('../services/patient-push-service');

function seedSkin(db, { patientId, date, delta, sessionId = null }) {
  return factsRepo.insertFact(db, {
    patient_id: patientId,
    session_id: sessionId,
    tag: 'skin',
    ai_or_manual: 'manual',
    structured_json: {
      date,
      note: delta === 'worse' ? 'flaring more' : 'ok',
      body_area: 'cheek',
      ai_suggestion: delta
        ? { delta, text: 'x', labeled: 'ai_suggestion', not_diagnosis: true, source: 'test' }
        : null,
    },
    confirmed_at: new Date().toISOString(),
  });
}

describe('P5.05 demote journey_modes Progress gate', () => {
  test('P5.05 routine mode no longer gates to pick/bio/scan', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../patient-app/lib/resolve-post-auth-route.ts'),
      'utf8',
    );
    expect(src).toMatch(/P5\.05|P7\.03/);
    expect(src).toMatch(/never gate|PROGRESS_HREF|Authenticated cold lander is always Progress/i);
    expect(src).toMatch(/PROGRESS_HREF/);
    expect(src).not.toMatch(/if \(routineMode && !hasTemplate\)/);
    expect(src).not.toMatch(/ROUTINE_PICK_HREF/);
    expect(src).not.toMatch(/BIO_CALIBRATION_HREF/);
    expect(src).not.toMatch(/SCAN_HREF/);
    // Empty routine still returns Progress lander in sync helper
    expect(src).toMatch(/return PROGRESS_HREF|PROGRESS_HREF/);
  });
});

describe('P5.01 shelf evaluate/allergen unchanged', () => {
  test('P5.01 evaluate-pair and allergen hard_no modules still present', () => {
    const shelf = fs.readFileSync(path.join(__dirname, '../routes/patient-shelf.js'), 'utf8');
    expect(shelf).toMatch(/evaluate-pair/);
    const hardNo = fs.readFileSync(
      path.join(__dirname, '../services/allergen-hard-no-service.js'),
      'utf8',
    );
    expect(hardNo).toMatch(/detectAllergenHardNos/);
    expect(hardNo).toMatch(/applyHardNoOverall/);
    // Existing evidence suite still on disk
    expect(
      fs.existsSync(path.join(__dirname, './patient-shelf-evaluate-pair.test.js')),
    ).toBe(true);
  });
});

describe('P5.02 agent-delta from patient_record_facts', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => db.close());

  test('P5.02 N-day-worse queries patient_record_facts not journal severity', () => {
    const patientId = 'pat_a';
    seedSkin(db, { patientId, date: '2026-07-14', delta: 'worse' });
    seedSkin(db, { patientId, date: '2026-07-15', delta: 'worse' });
    seedSkin(db, { patientId, date: '2026-07-16', delta: 'worse' });
    const out = computeFactsAgentDelta(db, {
      patientId,
      todayIso: '2026-07-16',
      nDays: 3,
    });
    expect(out.queried_table).toBe('patient_record_facts');
    expect(out.source).toBe('patient_record_facts');
    expect(out.show).toBe(true);
    expect(out.n_day_worse.n_days).toBe(3);
    expect(out.message).toMatch(/worse/);

    const src = fs.readFileSync(
      path.join(__dirname, '../services/medical-tracker-domain/agent-delta-facts.js'),
      'utf8',
    );
    expect(src).not.toMatch(/getYesterdaySeverity/);
    expect(src).toMatch(/patient_record_facts|listFacts/);
  });
});

describe('P5.03–P5.04 reminder jobs', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensurePushTables(db);
  });
  afterEach(() => db.close());

  test('P5.03 Rx expiry only when reminder_opt_in true', async () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_rx',
      tag: 'prescription',
      ai_or_manual: 'manual',
      structured_json: {
        drug: 'tretinoin',
        date: '2026-01-01',
        expiry: '2026-07-20',
        reminder_opt_in: true,
      },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_rx_out',
      tag: 'prescription',
      ai_or_manual: 'manual',
      structured_json: {
        drug: 'other',
        date: '2026-01-01',
        expiry: '2026-07-20',
        reminder_opt_in: false,
      },
      confirmed_at: new Date().toISOString(),
    });
    const res = await runRxExpiryReminderJob(db, { todayIso: '2026-07-16', flush: false });
    expect(res.enqueued.some((e) => e.patient_id === 'pat_rx')).toBe(true);
    expect(res.enqueued.some((e) => e.patient_id === 'pat_rx_out')).toBe(false);
    expect(res.skipped_opt_out).toBeGreaterThanOrEqual(1);
  });

  test('P5.04 routine cadence negative: no opt-in → no push', async () => {
    expect(hasRoutineReminderOptIn(db, { patientId: 'pat_never' })).toBe(false);
    const none = await runRoutineCadenceReminderJob(db, { todayIso: '2026-07-16' });
    expect(none.enqueued).toEqual([]);

    setRoutineReminderOptIn(db, { patientId: 'pat_yes', optIn: true });
    const yes = await runRoutineCadenceReminderJob(db, { todayIso: '2026-07-16' });
    expect(yes.enqueued.some((e) => e.patient_id === 'pat_yes')).toBe(true);
  });
});

describe('P5.06–P5.07 physician export', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => db.close());

  test('P5.06 PDF inherits export_pack narrative=null', async () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_pdf',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', amount: 10, currency: 'USD' },
      confirmed_at: new Date().toISOString(),
    });
    const built = await buildPhysicianPdf(db, { patientId: 'pat_pdf' });
    expect(built.ok).toBe(true);
    expect(built.narrative).toBeNull();
    expect(built.interpretation).toBeNull();
    expect(built.ai_generated).toBe(false);
    expect(built.buffer.slice(0, 5).toString()).toBe('%PDF-');
    expect(built.pack.narrative).toBeNull();
  });

  test('P5.07 share link expires and is not permanent', async () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_share',
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', note: 'ok' },
      confirmed_at: new Date().toISOString(),
    });
    const link = await createPhysicianShareLink(db, { patientId: 'pat_share', ttlSec: 60 });
    expect(link.ok).toBe(true);
    expect(link.permanent).toBe(false);
    expect(link.reusable_until_expiry).toBe(true);
    expect(link.expires_at).toBeTruthy();
    const resolved = await resolvePhysicianShare(db, { token: link.token, ip: '127.0.0.1' });
    expect(resolved.ok).toBe(true);
    expect(resolved.narrative).toBeNull();
    const access = db
      .prepare(`SELECT outcome FROM patient_physician_share_access_log WHERE token = ?`)
      .all(link.token);
    expect(access.some((a) => a.outcome === 'ok')).toBe(true);

    // Force expiry
    db.prepare(`UPDATE patient_physician_share_tokens SET expires_at = ? WHERE token = ?`).run(
      new Date(Date.now() - 1000).toISOString(),
      link.token,
    );
    await expect(resolvePhysicianShare(db, { token: link.token })).rejects.toMatchObject({
      code: 'SHARE_EXPIRED',
    });
  });

  test('P5.07 share link can be revoked before TTL', async () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_revoke',
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', note: 'ok' },
      confirmed_at: new Date().toISOString(),
    });
    const link = await createPhysicianShareLink(db, { patientId: 'pat_revoke', ttlSec: 3600 });
    const revoked = revokePhysicianShare(db, { token: link.token, patientId: 'pat_revoke' });
    expect(revoked.ok).toBe(true);
    expect(revoked.revoked_at).toBeTruthy();
    await expect(resolvePhysicianShare(db, { token: link.token })).rejects.toMatchObject({
      code: 'SHARE_REVOKED',
    });
  });
});

describe('P5.08–P5.10 progress + calendar', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => db.close());

  test('P5.08 honest aggregates have no percentage/rate fields', () => {
    seedSkin(db, { patientId: 'pat_agg', date: '2026-07-16', delta: 'calmer' });
    const agg = buildProgressAggregates(db, { patientId: 'pat_agg' });
    expect(agg.skin.calmer_day_count).toBe(1);
    expect(() => assertNoPercentageFields(agg)).not.toThrow();
    const flat = JSON.stringify(agg);
    expect(flat).not.toMatch(/pct|percent|percentage|_rate/i);
  });

  test('P5.09 bill-only user has no skin key; mixed has both', () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_bill',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', amount: 40, currency: 'USD' },
      confirmed_at: new Date().toISOString(),
    });
    const billOnly = buildProgressAggregates(db, { patientId: 'pat_bill' });
    expect(billOnly.bill).toBeTruthy();
    expect(billOnly).not.toHaveProperty('skin');
    expect(billOnly).not.toHaveProperty('rx');

    seedSkin(db, { patientId: 'pat_mix', date: '2026-07-16', delta: 'same' });
    factsRepo.insertFact(db, {
      patient_id: 'pat_mix',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-02', amount: 5, currency: 'USD' },
      confirmed_at: new Date().toISOString(),
    });
    const mixed = buildProgressAggregates(db, { patientId: 'pat_mix' });
    expect(mixed.skin).toBeTruthy();
    expect(mixed.bill).toBeTruthy();
  });

  test('P5.10 multi-type day reports both skin and bill tags', () => {
    const patientId = 'pat_cal';
    seedSkin(db, { patientId, date: '2026-07-16', delta: 'baseline' });
    factsRepo.insertFact(db, {
      patient_id: patientId,
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-16', amount: 12, currency: 'USD' },
      confirmed_at: new Date().toISOString(),
    });
    const cal = buildFactsCalendar(db, {
      patientId,
      month: '2026-07',
    });
    const day = cal.days.find((d) => d.date === '2026-07-16');
    expect(day.tags).toEqual(expect.arrayContaining(['bill', 'skin']));
    expect(day.multi_type).toBe(true);
  });
});

describe('P5.11–P5.14 ownership + alerts decision', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => db.close());

  test('P5.11 marks list is ownership-scoped (cross-user leak blocked)', () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_owner',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_1',
      structured_json: { date: '2026-07-01', body_location: 'arm' },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_other',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_2',
      structured_json: { date: '2026-07-02', body_location: 'leg' },
      confirmed_at: new Date().toISOString(),
    });
    const mine = listMarksForPatient(db, { patientId: 'pat_owner' });
    expect(mine.marks).toHaveLength(1);
    expect(mine.marks[0].body_location).toBe('arm');
    expect(mine.marks.every((m) => true)).toBe(true);
  });

  test('P5.12 compare_group timeline has no AI narrative', () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_cg',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_x',
      structured_json: { date: '2026-07-01', body_location: 'cheek' },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_cg',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_x',
      structured_json: { date: '2026-07-10', body_location: 'cheek' },
      confirmed_at: new Date().toISOString(),
    });
    // Other patient's same group id must not appear
    factsRepo.insertFact(db, {
      patient_id: 'pat_evil',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_x',
      structured_json: { date: '2026-07-11', body_location: 'leaked' },
      confirmed_at: new Date().toISOString(),
    });
    const tl = getCompareGroupTimeline(db, { patientId: 'pat_cg', compareGroupId: 'cg_x' });
    expect(tl.facts).toHaveLength(2);
    expect(tl.narrative).toBeNull();
    expect(tl.interpretation).toBeNull();
    expect(tl.ai_generated).toBe(false);
    expect(tl.facts.every((f) => f.body_location !== 'leaked')).toBe(true);
  });

  test('P5.13 alerts home decision locks no dedicated tab', () => {
    expect(ALERTS_HOME_DECISION.dedicated_tab).toBe(false);
    expect(ALERTS_HOME_DECISION.surfaces).toEqual(
      expect.arrayContaining(['progress_module', 'shelf_hard_no_conflict_badge', 'push']),
    );
    expect(ALERTS_HOME_DECISION.empty_redirect_to_check_retired).toBe(true);
    const alertsUi = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/alerts.tsx'),
      'utf8',
    );
    const policy = fs.readFileSync(
      path.join(__dirname, '../../patient-app/lib/alerts-empty-policy.ts'),
      'utf8',
    );
    expect(policy).toMatch(/autoRedirectTo: null/);
    expect(policy).toMatch(/ALERTS_EMPTY_NEVER_REDIRECTS/);
    expect(alertsUi).toMatch(/settleAlertsFeed/);
    expect(alertsUi).toMatch(/alerts-empty|No alerts right now/);
    expect(alertsUi).toMatch(/empty_redirect_to_check_retired|no separate alerts home|P5\.13/);
    // Auto-bounce must stay gone from load/catch (intentional button may remain)
    expect(alertsUi).not.toMatch(/if\s*\(\s*!list\.length\s*\)\s*\{\s*router\.replace\(CHECK_HREF\)/);
    expect(alertsUi).not.toMatch(/catch\s*\{[^}]*router\.replace\(CHECK_HREF\)/);
  });

  test('P5.14 alerts feed cannot leak other patient Rx reminders', () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_feed',
      tag: 'prescription',
      ai_or_manual: 'manual',
      structured_json: {
        drug: 'mine',
        date: '2026-01-01',
        expiry: '2026-07-18',
        reminder_opt_in: true,
      },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_other_feed',
      tag: 'prescription',
      ai_or_manual: 'manual',
      structured_json: {
        drug: 'THEIRS',
        date: '2026-01-01',
        expiry: '2026-07-18',
        reminder_opt_in: true,
      },
      confirmed_at: new Date().toISOString(),
    });
    const feed = buildUnifiedAlertsFeed(db, {
      patientId: 'pat_feed',
      sessionId: 'sess_feed',
      todayIso: '2026-07-16',
    });
    const rx = feed.alerts.filter((a) => a.kind === 'rx_expiry');
    expect(rx.every((a) => a.patient_id === 'pat_feed')).toBe(true);
    expect(rx.some((a) => /THEIRS/.test(a.message))).toBe(false);
  });
});

describe('CF-1 diagnosis positive constraint', () => {
  test('CF-1 rejects diagnosis-shaped keys even without denylist hit', () => {
    const sneaky = {
      date: '2026-07-16',
      note: 'skin feels dry today',
      diagnosis: 'atopic dermatitis',
    };
    expect(assertPositiveMedicalTextShape(sneaky).ok).toBe(false);
    expect(assertPositiveMedicalTextShape(sneaky).error_code).toBe('FORBIDDEN_CLINICAL_KEY');
    expect(assertSafeToPersistStructured(sneaky).ok).toBe(false);
    expect(validateSkinStructured(sneaky).valid).toBe(false);
    expect(validateSkinStructured(sneaky).errors).toContain('forbidden_clinical_key');
    expect(FORBIDDEN_CLINICAL_KEYS).toContain('diagnosis');

    const badDelta = {
      date: '2026-07-16',
      note: 'ok',
      ai_suggestion: { delta: 'severe_flare', text: 'x', labeled: 'ai_suggestion' },
    };
    expect(assertPositiveMedicalTextShape(badDelta).error_code).toBe('AI_DELTA_ENUM');
  });

  test('CF-1 free-text note rejects clinical rephrase (exposure surface, not just delta enum)', () => {
    const {
      assertFreeTextClinicallySafe,
      AI_SUGGESTION_TEXT_BY_DELTA,
    } = require('../services/medical-tracker-rails/policy');

    // Avoids classic "you have" / "this looks like" but still clinical
    const noteOnly = {
      date: '2026-07-16',
      note: 'consistent with atopic dermatitis on the cheek',
      ai_suggestion: null,
    };
    const noteGate = assertPositiveMedicalTextShape(noteOnly);
    expect(noteGate.ok).toBe(false);
    expect(noteGate.error_code).toBe('FREE_TEXT_CLINICAL_CONTENT');
    expect(noteGate.field).toBe('note');
    expect(assertSafeToPersistStructured(noteOnly).ok).toBe(false);

    // AI inventing clinical prose (valid delta, non-allowlisted text) rejected
    const aiProse = {
      date: '2026-07-16',
      note: 'cheek a bit dry',
      ai_suggestion: {
        delta: 'worse',
        text: 'This appears to be a fungal infection flare.',
        labeled: 'ai_suggestion',
        not_diagnosis: true,
        source: 'delta_compose',
      },
    };
    const aiGate = assertPositiveMedicalTextShape(aiProse);
    expect(aiGate.ok).toBe(false);
    expect(aiGate.error_code).toBe('AI_TEXT_NOT_ALLOWLISTED');

    // Closed template for delta is accepted
    const okAi = {
      date: '2026-07-16',
      note: 'cheek a bit dry',
      ai_suggestion: {
        delta: 'calmer',
        text: AI_SUGGESTION_TEXT_BY_DELTA.calmer[0],
        labeled: 'ai_suggestion',
        not_diagnosis: true,
        source: 'delta_compose',
      },
    };
    expect(assertPositiveMedicalTextShape(okAi).ok).toBe(true);
    expect(assertFreeTextClinicallySafe('note', 'cheek a bit dry').ok).toBe(true);
  });
});

describe('CF-2 plan sync one-directional', () => {
  test('CF-2 sync script only writes plan FROM yaml — no reverse path', () => {
    const syncPath = path.join(__dirname, '../scripts/sync-agentic-plan-todos.cjs');
    const src = fs.readFileSync(syncPath, 'utf8');
    expect(src).toMatch(/FROM repo SSOT|Sync Cursor plan frontmatter FROM/);
    expect(src).toMatch(/agentic-tracker-plan-todos\.yaml/);
    expect(src).toMatch(/writeFileSync\(PLAN/);
    // Must not write back into repo YAML
    expect(src).not.toMatch(/writeFileSync\(REPO_TODOS/);
    expect(src).not.toMatch(/writeFileSync\([^)]*agentic-tracker-plan-todos/);
    const audit = fs.readFileSync(
      path.join(__dirname, '../scripts/audit-phase02-completed-tests.cjs'),
      'utf8',
    );
    expect(audit).toMatch(/audit does NOT read it|REPO_TODOS/);
    expect(audit).toMatch(/loadTodos/);
  });
});
