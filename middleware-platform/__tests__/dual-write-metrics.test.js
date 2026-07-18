'use strict';

const Database = require('better-sqlite3');
const Metrics = require('../services/metrics');
const {
  dualWriteJournalSkin,
  dualWriteSpotMark,
  dualWriteBillingBill,
} = require('../services/patient-record-dual-write');
const factsRepo = require('../repositories/patient-record-facts-repo');

describe('M18 dual-write failure metrics (all three bridges)', () => {
  let db;
  const logs = [];

  beforeEach(() => {
    Metrics.resetForTests();
    logs.length = 0;
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    // Force upsert to throw so safeDualWrite catches
    jest.spyOn(factsRepo, 'upsertFactByRequestId').mockImplementation(() => {
      throw new Error('forced_dual_write_fail');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      db.close();
    } catch (_) {}
  });

  test('journal→skin failure increments bridge + total counters', () => {
    const result = dualWriteJournalSkin(db, {
      patientId: 'p1',
      sessionId: 's1',
      entry: { entry_date: '2026-07-16', note: 'n', condition_tags: [] },
    });
    expect(result).toBeNull();
    expect(Metrics.get(Metrics.DUAL_WRITE_FAIL_TOTAL)).toBe(1);
    expect(Metrics.get(Metrics.DUAL_WRITE_BRIDGES['journal→skin'])).toBe(1);
    expect(Metrics.get(Metrics.DUAL_WRITE_BRIDGES['spots→mark'])).toBe(0);
    expect(Metrics.get(Metrics.DUAL_WRITE_BRIDGES['billing→bill'])).toBe(0);
  });

  test('spots→mark failure increments its own bridge counter', () => {
    dualWriteSpotMark(db, {
      patientId: 'p1',
      sessionId: 's1',
      spot: { id: 'spot_1', body_region: 'arm', label: 'x' },
      snapshot: { id: 'snap_1', captured_at: '2026-07-16T12:00:00.000Z', storage_ref: 'local://x.jpg' },
    });
    expect(Metrics.get(Metrics.DUAL_WRITE_FAIL_TOTAL)).toBe(1);
    expect(Metrics.get(Metrics.DUAL_WRITE_BRIDGES['spots→mark'])).toBe(1);
    expect(Metrics.get(Metrics.DUAL_WRITE_BRIDGES['journal→skin'])).toBe(0);
  });

  test('billing→bill failure increments its own bridge counter', () => {
    dualWriteBillingBill(db, {
      patientId: 'p1',
      sessionId: 's1',
      document: { id: 'doc_1', source_type: 'upload', mime_type: 'image/jpeg', storage_ref: 'local://b.jpg' },
      event: {
        id: 'evt_1',
        service_date: '2026-07-01',
        amount_cents: 1000,
        provider_name: 'Clinic',
        currency: 'USD',
      },
    });
    expect(Metrics.get(Metrics.DUAL_WRITE_FAIL_TOTAL)).toBe(1);
    expect(Metrics.get(Metrics.DUAL_WRITE_BRIDGES['billing→bill'])).toBe(1);
  });

  test('all three bridges share total and trip alert threshold', () => {
    const errors = [];
    const logger = {
      warn: () => {},
      error: (msg) => errors.push(msg),
    };
    process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT = '3';
    process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT_CADENCE = '3';

    Metrics.recordDualWriteFailure('journal→skin', { errorMessage: 'a', logger });
    Metrics.recordDualWriteFailure('spots→mark', { errorMessage: 'b', logger });
    expect(errors).toHaveLength(0);
    const alert = Metrics.recordDualWriteFailure('billing→bill', { errorMessage: 'c', logger });
    expect(alert.alerted).toBe(true);
    expect(alert.total).toBe(3);
    expect(alert.journal_skin).toBe(1);
    expect(alert.spots_mark).toBe(1);
    expect(alert.billing_bill).toBe(1);
    expect(errors.some((m) => String(m).includes('[ALERT] patient_record_dual_write_fail'))).toBe(true);

    delete process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT;
    delete process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT_CADENCE;
  });

  test('alert re-fires on cadence (not one-shot, not every failure)', () => {
    const errors = [];
    const logger = { warn: () => {}, error: (msg) => errors.push(String(msg)) };
    process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT = '5';
    process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT_CADENCE = '5';

    for (let i = 0; i < 4; i += 1) {
      expect(Metrics.recordDualWriteFailure('journal→skin', { logger }).alerted).toBe(false);
    }
    expect(Metrics.recordDualWriteFailure('journal→skin', { logger }).alerted).toBe(true); // 5
    expect(errors).toHaveLength(1);

    for (let i = 0; i < 4; i += 1) {
      expect(Metrics.recordDualWriteFailure('spots→mark', { logger }).alerted).toBe(false); // 6–9
    }
    expect(Metrics.recordDualWriteFailure('billing→bill', { logger }).alerted).toBe(true); // 10
    expect(errors).toHaveLength(2);
    expect(errors[1]).toMatch(/fail=10/);

    delete process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT;
    delete process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT_CADENCE;
  });

  test('shouldFireDualWriteAlert math: trip then every cadence', () => {
    expect(Metrics.shouldFireDualWriteAlert(4, { threshold: 5, cadence: 5 })).toBe(false);
    expect(Metrics.shouldFireDualWriteAlert(5, { threshold: 5, cadence: 5 })).toBe(true);
    expect(Metrics.shouldFireDualWriteAlert(6, { threshold: 5, cadence: 5 })).toBe(false);
    expect(Metrics.shouldFireDualWriteAlert(9, { threshold: 5, cadence: 5 })).toBe(false);
    expect(Metrics.shouldFireDualWriteAlert(10, { threshold: 5, cadence: 5 })).toBe(true);
    expect(Metrics.shouldFireDualWriteAlert(15, { threshold: 5, cadence: 5 })).toBe(true);
  });
});
