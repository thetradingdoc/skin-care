'use strict';

const Database = require('better-sqlite3');
const {
  getConsumerProfile,
  upsertConsumerProfile,
  toApiProfile,
} = require('../repositories/consumer-profile-repo');
const { ensureSqliteConsumerTables } = require('../db/client');

describe('consumer-profile-repo', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    delete process.env.POSTGRES_URL;
    delete process.env.DATA_STORE;
  });

  afterEach(() => {
    db.close();
  });

  test('upsert and get journey profile', async () => {
    const profile = await upsertConsumerProfile(db, {
      sessionId: 'sess_1',
      patientId: 'pat_1',
      patch: {
        journey_modes: ['watch', 'routine'],
        primary_mode: 'watch',
        onboarding_complete: true,
        needs_first_photo: true,
      },
    });
    expect(profile.journey_modes).toEqual(['watch', 'routine']);
    expect(profile.primary_mode).toBe('watch');
    expect(profile.onboarding_complete).toBe(true);

    const loaded = await getConsumerProfile(db, { sessionId: 'sess_1', patientId: 'pat_1' });
    const api = toApiProfile(loaded);
    expect(api.modes).toEqual(['watch', 'routine']);
    expect(api.primary).toBe('watch');
    expect(api.needs_first_photo).toBe(true);
  });

  test('patch merges existing profile', async () => {
    await upsertConsumerProfile(db, {
      sessionId: 'sess_2',
      patch: { journey_modes: ['routine'], primary_mode: 'routine' },
    });
    const updated = await upsertConsumerProfile(db, {
      sessionId: 'sess_2',
      patch: { onboarding_complete: true },
    });
    expect(updated.journey_modes).toEqual(['routine']);
    expect(updated.onboarding_complete).toBe(true);
  });
});
