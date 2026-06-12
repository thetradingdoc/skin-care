'use strict';

const Database = require('better-sqlite3');
const spotRepo = require('../repositories/spot-repo');
const { ensureSqliteConsumerTables } = require('../db/client');

describe('spot-repo', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    delete process.env.POSTGRES_URL;
  });

  afterEach(() => {
    db.close();
  });

  test('create spot and add snapshot', async () => {
    const spot = await spotRepo.createSpot(db, {
      sessionId: 'sess_spot',
      label: 'Neck spot',
      bodyRegion: 'neck',
    });
    expect(spot.id).toBeTruthy();

    await spotRepo.addSnapshot(db, {
      spotId: spot.id,
      storageRef: 'gs://bucket/spot1.jpg',
      analysis: { change_tag: 'watch' },
    });

    const loaded = await spotRepo.getSpot(db, { sessionId: 'sess_spot', spotId: spot.id });
    expect(loaded.photos.length).toBe(1);
    expect(loaded.photos[0].storage_ref).toBe('gs://bucket/spot1.jpg');
  });

  test('migrate local spots', async () => {
    const ids = await spotRepo.migrateSpots(db, {
      sessionId: 'sess_mig',
      spots: [
        {
          label: 'Arm spot',
          bodyRegion: 'arm',
          photos: [{ date: '2026-06-01', uri: 'file:///local.jpg' }],
        },
      ],
    });
    expect(ids.length).toBe(1);
    const list = await spotRepo.listSpots(db, { sessionId: 'sess_mig' });
    expect(list.length).toBe(1);
  });
});
