'use strict';

/**
 * Adversarial: patient_record_facts PHI at rest must be ciphertext in a raw DB dump.
 * Ownership tests (P5.11/P5.12/P5.14) must still pass against decrypted app reads.
 */

const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');
const {
  isEncryptedFactField,
  PREFIX,
} = require('../services/patient-record-field-crypto');
const {
  listMarksForPatient,
  getCompareGroupTimeline,
} = require('../services/medical-tracker-domain/marks-compare');
const { buildUnifiedAlertsFeed } = require('../services/medical-tracker-domain/alerts-feed');

describe('patient_record_facts field encryption at rest', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });

  afterEach(() => db.close());

  test('adversarial DB dump: structured_json + raw_extract_text are not human-readable plaintext', () => {
    const secretNote = 'SECRET_CLINICAL_NOTE_cheek_flare_XYZ';
    const secretOcr = 'OCR_SECRET_line_tretinoin_0.025_ABC';
    const fact = factsRepo.insertFact(db, {
      patient_id: 'pat_enc',
      session_id: 'sess_enc',
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: {
        date: '2026-07-16',
        body_area: 'cheek',
        note: secretNote,
        ai_suggestion: null,
      },
      raw_extract_text: secretOcr,
    });

    const raw = db
      .prepare(`SELECT structured_json, raw_extract_text, entry_date FROM patient_record_facts WHERE id = ?`)
      .get(fact.id);

    expect(raw.structured_json).toMatch(new RegExp(`^${PREFIX}`));
    expect(isEncryptedFactField(raw.structured_json)).toBe(true);
    expect(raw.structured_json).not.toContain(secretNote);
    expect(raw.structured_json).not.toContain('cheek');
    expect(raw.structured_json).not.toMatch(/\{/);

    expect(raw.raw_extract_text).toMatch(new RegExp(`^${PREFIX}`));
    expect(isEncryptedFactField(raw.raw_extract_text)).toBe(true);
    expect(raw.raw_extract_text).not.toContain(secretOcr);
    expect(raw.raw_extract_text).not.toContain('tretinoin');

    // Denorm date stays plaintext for range queries (not PHI body)
    expect(raw.entry_date).toBe('2026-07-16');

    // App hydrate still yields plaintext
    const hydrated = factsRepo.getFactById(db, fact.id);
    expect(hydrated.structured_json.note).toBe(secretNote);
    expect(hydrated.raw_extract_text).toBe(secretOcr);
  });

  test('P5.11 ownership still holds with encrypted storage (cross-user body_location not leaked)', () => {
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
      structured_json: { date: '2026-07-02', body_location: 'leg_LEAK_SHOULD_NOT_APPEAR' },
      confirmed_at: new Date().toISOString(),
    });
    const mine = listMarksForPatient(db, { patientId: 'pat_owner' });
    expect(mine.marks).toHaveLength(1);
    expect(mine.marks[0].body_location).toBe('arm');
    expect(JSON.stringify(mine)).not.toMatch(/leg_LEAK/);
  });

  test('P5.12 compare timeline decrypts own rows only — leaked note absent', () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_cg',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_x',
      structured_json: { date: '2026-07-01', body_location: 'cheek', note: 'mine-a' },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_cg',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_x',
      structured_json: { date: '2026-07-10', body_location: 'cheek', note: 'mine-b' },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_evil',
      tag: 'mark',
      ai_or_manual: 'manual',
      compare_group_id: 'cg_x',
      structured_json: { date: '2026-07-11', body_location: 'leaked', note: 'EVIL_NOTE_PLAIN' },
      confirmed_at: new Date().toISOString(),
    });
    const tl = getCompareGroupTimeline(db, { patientId: 'pat_cg', compareGroupId: 'cg_x' });
    expect(tl.facts).toHaveLength(2);
    expect(JSON.stringify(tl)).not.toMatch(/EVIL_NOTE_PLAIN/);
    expect(tl.facts.every((f) => f.body_location !== 'leaked')).toBe(true);
    // Ordering by entry_date still works under encryption
    expect(tl.facts[0].date).toBe('2026-07-01');
    expect(tl.facts[1].date).toBe('2026-07-10');
  });

  test('P5.14 alerts feed ownership — other patient Rx drug not present in feed payload', () => {
    const expiry = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    factsRepo.insertFact(db, {
      patient_id: 'pat_alerts',
      tag: 'prescription',
      ai_or_manual: 'manual',
      structured_json: {
        date: '2026-07-01',
        drug: 'tretinoin',
        expiry,
        reminder_opt_in: true,
      },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_other_rx',
      tag: 'prescription',
      ai_or_manual: 'manual',
      structured_json: {
        date: '2026-07-01',
        drug: 'SECRET_OTHER_DRUG_XYZ',
        expiry,
        reminder_opt_in: true,
      },
      confirmed_at: new Date().toISOString(),
    });
    const feed = buildUnifiedAlertsFeed(db, {
      patientId: 'pat_alerts',
      todayIso: new Date().toISOString().slice(0, 10),
    });
    const blob = JSON.stringify(feed);
    expect(blob).not.toMatch(/SECRET_OTHER_DRUG_XYZ/);
  });

  test('listFacts date range uses entry_date — still finds encrypted rows', () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_range',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-05', amount_cents: 1000, currency: 'USD' },
      confirmed_at: new Date().toISOString(),
    });
    factsRepo.insertFact(db, {
      patient_id: 'pat_range',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-08-01', amount_cents: 2000, currency: 'USD' },
      confirmed_at: new Date().toISOString(),
    });
    const july = factsRepo.listFacts(db, {
      patientId: 'pat_range',
      startIso: '2026-07-01',
      endIso: '2026-07-31',
    });
    expect(july).toHaveLength(1);
    expect(july[0].structured_json.amount_cents).toBe(1000);
  });
});
