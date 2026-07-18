'use strict';

const Database = require('better-sqlite3');
const {
  validateSkinStructured,
  validateBillStructured,
  validatePrescriptionStructured,
  validateMarkStructured,
  validateLabStructured,
  validateOtherStructured,
  validateTagStructured,
  RECORD_TAGS,
} = require('../services/patient-record-fact-validators');
const factsRepo = require('../repositories/patient-record-facts-repo');
const {
  dualWriteJournalSkin,
  dualWriteSpotMark,
  dualWriteBillingBill,
} = require('../services/patient-record-dual-write');
const { detectLanguageStub } = require('../services/patient-record-language-stub');
const { presentFact, redactStorageRef } = require('../services/patient-record-media-access');

describe('patient-record-fact-validators', () => {
  test('six tags registered', () => {
    expect(RECORD_TAGS).toEqual(['skin', 'bill', 'prescription', 'mark', 'lab', 'other']);
  });

  test('skin requires date and keeps ai_suggestion separate', () => {
    const ok = validateSkinStructured({
      date: '2026-07-16',
      body_area: 'cheek',
      note: 'mine',
      ai_suggestion: { text: 'looks calmer' },
    });
    expect(ok.valid).toBe(true);
    expect(ok.normalized.note).toBe('mine');
    expect(ok.normalized.ai_suggestion).toEqual({ text: 'looks calmer' });
    expect(validateSkinStructured({ body_area: 'x' }).valid).toBe(false);
  });

  test('bill / prescription / mark / lab / other validators', () => {
    const bill = validateBillStructured({ date: '2026-07-01', amount: 12.5, currency: 'USD' });
    expect(bill.valid).toBe(true);
    expect(bill.normalized.amount_cents).toBe(1250);
    expect(bill.normalized).not.toHaveProperty('amount');
    expect(
      validateBillStructured({ date: '2026-07-01', amount_cents: 8400 }).normalized.amount_cents,
    ).toBe(8400);
    expect(
      validatePrescriptionStructured({ drug: 'tretinoin', strength: '0.025%' }).valid,
    ).toBe(true);
    expect(
      validatePrescriptionStructured({
        drug: 'tretinoin',
        commerce_variant_id: 'gid://shopify/ProductVariant/1',
      }).valid,
    ).toBe(false);
    expect(
      validatePrescriptionStructured({
        drug: 'tretinoin',
        commerce_variant_id: 'x',
      }).errors,
    ).toContain('prescription_commerce_forbidden');
    expect(
      validateMarkStructured({ date: '2026-07-01', body_location: 'forearm' }).normalized
        .compare_group_id,
    ).toBeNull();
    expect(validateLabStructured({ date: '2026-07-01', title: 'CBC' }).valid).toBe(true);
    expect(validateOtherStructured({ date: '2026-07-01', label: 'note' }).valid).toBe(true);
  });

  test('lab stores source_language and display_language (P2.17)', () => {
    const ok = validateLabStructured({
      date: '2026-07-01',
      title: 'CBC',
      source_language: 'es',
      display_language: 'en',
    });
    expect(ok.valid).toBe(true);
    expect(ok.normalized.source_language).toBe('es');
    expect(ok.normalized.display_language).toBe('en');
  });

  test('validateTagStructured rejects unknown tag', () => {
    expect(validateTagStructured('video', {}).errors).toContain('tag_invalid');
  });
});

describe('patient-record-facts-repo (P2.19 + P2.28)', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('068 drops global idx_prf_request_id and adds owner-scoped unique', () => {
    const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all().map((r) => r.name);
    expect(indexes).not.toContain('idx_prf_request_id');
    expect(indexes).toContain('idx_prf_owner_request_id');
  });

  test('insert + get by request_id is owner-scoped', () => {
    const fact = factsRepo.insertFact(db, {
      patient_id: null,
      session_id: 'sess1',
      tag: 'skin',
      media_type: 'photo',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-16', body_area: 'cheek', note: null, ai_suggestion: null },
      request_id: 'req-abc',
    });
    expect(fact.id).toBeTruthy();
    expect(fact.owner_key).toBe('session:sess1');
    expect(
      factsRepo.getFactByRequestId(db, { sessionId: 'sess1', requestId: 'req-abc' }).id,
    ).toBe(fact.id);
    expect(
      factsRepo.getFactByRequestId(db, { sessionId: 'other', requestId: 'req-abc' }),
    ).toBeNull();
  });

  test('same request_id allowed for different owners (P2.28)', () => {
    factsRepo.insertFact(db, {
      session_id: 'a',
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-16' },
      request_id: 'shared-req',
    });
    const b = factsRepo.insertFact(db, {
      session_id: 'b',
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-16' },
      request_id: 'shared-req',
    });
    expect(b.owner_key).toBe('session:b');
    expect(factsRepo.getFactByRequestId(db, { sessionId: 'a', requestId: 'shared-req' }).session_id).toBe(
      'a',
    );
    expect(factsRepo.getFactByRequestId(db, { sessionId: 'b', requestId: 'shared-req' }).session_id).toBe(
      'b',
    );
  });

  test('upsertFactByRequestId is idempotent per owner', () => {
    const first = factsRepo.upsertFactByRequestId(db, {
      session_id: 's1',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', amount: 10, currency: 'USD' },
      request_id: 'idem-1',
    });
    const second = factsRepo.upsertFactByRequestId(db, {
      session_id: 's1',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', amount: 20, currency: 'USD' },
      request_id: 'idem-1',
    });
    expect(second.id).toBe(first.id);
    // ensureTables runs 073 which canonicalizes amount → amount_cents on read path
    expect(second.structured_json.amount_cents).toBe(2000);
    expect(second.structured_json.amount).toBeUndefined();
  });

  test('confirm + list by tag/range (P2.15/P2.16)', () => {
    const f = factsRepo.insertFact(db, {
      session_id: 's1',
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-10', note: 'draft' },
      request_id: 'c1',
    });
    const confirmed = factsRepo.updateFactConfirm(db, {
      id: f.id,
      sessionId: 's1',
      patch: { structured_json: { date: '2026-07-10', note: 'ok' } },
    });
    expect(confirmed.confirmed_at).toBeTruthy();
    expect(confirmed.structured_json.note).toBe('ok');

    factsRepo.insertFact(db, {
      session_id: 's1',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-11', amount: 5 },
    });
    const skinOnly = factsRepo.listFacts(db, {
      sessionId: 's1',
      tag: 'skin',
      startIso: '2026-07-01',
      endIso: '2026-07-31',
    });
    expect(skinOnly).toHaveLength(1);
    expect(skinOnly[0].tag).toBe('skin');
  });
});

describe('dual-write bridges (P2.12–14)', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('journal → skin', () => {
    const fact = dualWriteJournalSkin(db, {
      sessionId: 'sj',
      patientId: null,
      entry: {
        entry_date: '2026-07-16',
        condition_tags: ['cheek'],
        note: 'flaky',
        photo_storage_ref: 'local://x.jpg',
      },
    });
    expect(fact).toBeTruthy();
    expect(fact.tag).toBe('skin');
    expect(fact.structured_json.date).toBe('2026-07-16');
  });

  test('spots → mark sets compare_group_id = spot.id', () => {
    const fact = dualWriteSpotMark(db, {
      sessionId: 'ss',
      spot: { id: 'spot_1', body_region: 'forearm', label: 'mole' },
      snapshot: { id: 'snap_1', storage_ref: 'local://s.jpg', captured_at: '2026-07-16T12:00:00.000Z' },
    });
    expect(fact.tag).toBe('mark');
    expect(fact.compare_group_id).toBe('spot_1');
  });

  test('billing → bill', () => {
    const fact = dualWriteBillingBill(db, {
      sessionId: 'sb',
      document: { id: 'bdoc_1', source_type: 'upload', mime_type: 'image/jpeg', storage_ref: 'local://b.jpg' },
      event: {
        id: 'bev_1',
        provider_name: 'Clinic',
        service_date: '2026-07-05',
        amount_cents: 4500,
        currency: 'USD',
      },
    });
    expect(fact.tag).toBe('bill');
    expect(fact.structured_json.amount_cents).toBe(4500);
    expect(fact.structured_json.amount).toBeUndefined();
  });
});

describe('language stub + media present (P2.18 / P2.29)', () => {
  test('detectLanguageStub returns stub:true', () => {
    expect(detectLanguageStub('Bonjour le monde').stub).toBe(true);
    expect(detectLanguageStub('你好').source_language).toBe('zh');
  });

  test('presentFact redacts https storage_ref', () => {
    const presented = presentFact({
      id: 'prf_1',
      storage_ref: 'https://account.blob.core.windows.net/c/k?sig=permanent',
      storage_key: null,
      storage_provider: null,
      structured_json: {},
    });
    // Permanent HTTPS → opaque azure:// (not leaked as https)
    expect(presented.storage_ref).toBe('azure://c/k');
    expect(String(presented.storage_ref || '')).not.toMatch(/^https?:\/\//);
    expect(redactStorageRef('https://evil.example/x')).toBeNull();
    expect(redactStorageRef('azure://bucket/key')).toBe('azure://bucket/key');
  });

  test('presentFact redacts nested structured_json.photo_ref (M12)', () => {
    const presented = presentFact({
      id: 'f_nested',
      storage_ref: 'local://ok.jpg',
      structured_json: {
        photo_ref: 'https://account.blob.core.windows.net/c/secret.jpg?sig=permanent',
      },
    });
    expect(String(presented.structured_json.photo_ref || '')).not.toMatch(/^https?:\/\//);
    expect(presented.structured_json.photo_ref).toBe('azure://c/secret.jpg');
  });
});
