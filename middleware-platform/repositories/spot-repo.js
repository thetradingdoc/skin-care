'use strict';

const crypto = require('crypto');
const {
  getDataStoreMode,
  getPostgresSql,
  ensurePostgresConsumerTables,
  ensureSqliteConsumerTables,
  resolveOwnerKey,
} = require('../db/client');

function spotId() {
  return `spot_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function snapshotId() {
  return `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function parseAnalysis(row) {
  if (!row?.analysis_json) return null;
  if (typeof row.analysis_json === 'object') return row.analysis_json;
  try {
    return JSON.parse(row.analysis_json);
  } catch {
    return null;
  }
}

function rowToSnapshot(row) {
  return {
    id: row.id,
    spot_id: row.spot_id,
    captured_at: row.captured_at,
    date: String(row.captured_at || '').slice(0, 10),
    storage_ref: row.storage_ref || null,
    thumb_storage_ref: row.thumb_storage_ref || null,
    journal_entry_id: row.journal_entry_id || null,
    analysis: parseAnalysis(row),
    analysis_json: parseAnalysis(row),
  };
}

function rowToSpot(row, latestSnapshot) {
  return {
    id: row.id,
    label: row.label,
    bodyRegion: row.body_region,
    body_region: row.body_region,
    createdAt: row.created_at,
    created_at: row.created_at,
    photos: latestSnapshot ? [latestSnapshot] : [],
    latest_snapshot: latestSnapshot || null,
    thumbnail_url: latestSnapshot?.thumb_storage_ref || latestSnapshot?.storage_ref || null,
  };
}

async function listSpots(sqliteDb, { patientId, sessionId }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return [];

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    const spots = await sql`
      SELECT * FROM patient_spots
      WHERE owner_key = ${ownerKey} AND archived_at IS NULL
      ORDER BY created_at DESC
    `;
    const out = [];
    for (const spot of spots) {
      const snaps = await sql`
        SELECT * FROM patient_spot_snapshots WHERE spot_id = ${spot.id}
        ORDER BY captured_at DESC LIMIT 1
      `;
      out.push(rowToSpot(spot, snaps[0] ? rowToSnapshot(snaps[0]) : null));
    }
    return out;
  }

  ensureSqliteConsumerTables(sqliteDb);
  const spots = sqliteDb
    .prepare(
      `SELECT * FROM patient_spots WHERE owner_key = ? AND archived_at IS NULL ORDER BY datetime(created_at) DESC`,
    )
    .all(ownerKey);
  return spots.map((spot) => {
    const snap = sqliteDb
      .prepare(
        `SELECT * FROM patient_spot_snapshots WHERE spot_id = ? ORDER BY datetime(captured_at) DESC LIMIT 1`,
      )
      .get(spot.id);
    return rowToSpot(spot, snap ? rowToSnapshot(snap) : null);
  });
}

async function getSpot(sqliteDb, { patientId, sessionId, spotId: id }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey || !id) return null;

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    const spots = await sql`
      SELECT * FROM patient_spots WHERE id = ${id} AND owner_key = ${ownerKey} LIMIT 1
    `;
    if (!spots[0]) return null;
    const snaps = await sql`
      SELECT * FROM patient_spot_snapshots WHERE spot_id = ${id} ORDER BY captured_at ASC
    `;
    const spot = rowToSpot(spots[0], null);
    spot.photos = snaps.map(rowToSnapshot);
    return spot;
  }

  ensureSqliteConsumerTables(sqliteDb);
  const spot = sqliteDb
    .prepare(`SELECT * FROM patient_spots WHERE id = ? AND owner_key = ? LIMIT 1`)
    .get(id, ownerKey);
  if (!spot) return null;
  const snaps = sqliteDb
    .prepare(`SELECT * FROM patient_spot_snapshots WHERE spot_id = ? ORDER BY datetime(captured_at) ASC`)
    .all(id);
  const out = rowToSpot(spot, null);
  out.photos = snaps.map(rowToSnapshot);
  return out;
}

async function createSpot(sqliteDb, { patientId, sessionId, label, bodyRegion }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) throw new Error('owner_key_required');
  const id = spotId();
  const region = String(bodyRegion || 'other').trim();
  const spotLabel = String(label || 'Skin spot').trim();

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    await sql`
      INSERT INTO patient_spots (id, owner_key, label, body_region, created_at)
      VALUES (${id}, ${ownerKey}, ${spotLabel}, ${region}, NOW())
    `;
    return getSpot(sqliteDb, { patientId, sessionId, spotId: id });
  }

  ensureSqliteConsumerTables(sqliteDb);
  const createdAt = new Date().toISOString();
  sqliteDb
    .prepare(
      `INSERT INTO patient_spots (id, owner_key, label, body_region, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, ownerKey, spotLabel, region, createdAt);
  return getSpot(sqliteDb, { patientId, sessionId, spotId: id });
}

async function addSnapshot(sqliteDb, { spotId: sid, storageRef, thumbStorageRef, journalEntryId, analysis }) {
  const id = snapshotId();
  const capturedAt = new Date().toISOString();
  const analysisJson = analysis ? JSON.stringify(analysis) : null;

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    await sql`
      INSERT INTO patient_spot_snapshots (
        id, spot_id, captured_at, storage_ref, thumb_storage_ref, journal_entry_id, analysis_json
      ) VALUES (
        ${id}, ${sid}, ${capturedAt}, ${storageRef || null}, ${thumbStorageRef || null},
        ${journalEntryId || null}, ${analysis ? JSON.stringify(analysis) : null}
      )
    `;
    return rowToSnapshot({
      id,
      spot_id: sid,
      captured_at: capturedAt,
      storage_ref: storageRef,
      thumb_storage_ref: thumbStorageRef,
      journal_entry_id: journalEntryId,
      analysis_json: analysis,
    });
  }

  ensureSqliteConsumerTables(sqliteDb);
  sqliteDb
    .prepare(
      `INSERT INTO patient_spot_snapshots (
        id, spot_id, captured_at, storage_ref, thumb_storage_ref, journal_entry_id, analysis_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(id, sid, capturedAt, storageRef || null, thumbStorageRef || null, journalEntryId || null, analysisJson);
  return rowToSnapshot({
    id,
    spot_id: sid,
    captured_at: capturedAt,
    storage_ref: storageRef,
    thumb_storage_ref: thumbStorageRef,
    journal_entry_id: journalEntryId,
    analysis_json: analysis,
  });
}

async function getSpotTimeline(sqliteDb, { patientId, sessionId, spotId: id }) {
  const spot = await getSpot(sqliteDb, { patientId, sessionId, spotId: id });
  if (!spot) return null;
  return {
    spot_id: spot.id,
    label: spot.label,
    body_region: spot.body_region,
    snapshots: (spot.photos || []).map((p) => ({
      id: p.id,
      date: p.date,
      captured_at: p.captured_at,
      thumbnail_url: p.thumb_storage_ref || p.storage_ref,
      change_tag: p.analysis?.change_tag || null,
      size_signal: p.analysis?.size_signal ?? null,
      disclaimer: p.analysis?.disclaimer || null,
    })),
  };
}

async function migrateSpots(sqliteDb, { patientId, sessionId, spots }) {
  const imported = [];
  if (!Array.isArray(spots)) return imported;
  for (const local of spots) {
    const bodyRegion = local.bodyRegion || local.body_region || 'other';
    const label = local.label || 'Skin spot';
    const created = await createSpot(sqliteDb, { patientId, sessionId, label, bodyRegion });
    const photos = Array.isArray(local.photos) ? local.photos : [];
    for (const photo of photos) {
      if (!photo?.uri && !photo?.storage_ref) continue;
      await addSnapshot(sqliteDb, {
        spotId: created.id,
        storageRef: photo.storage_ref || photo.uri || null,
        journalEntryId: photo.journalEntryId || photo.journal_entry_id || null,
        analysis: photo.analysis || null,
      });
    }
    imported.push(created.id);
  }
  return imported;
}

module.exports = {
  listSpots,
  getSpot,
  createSpot,
  addSnapshot,
  getSpotTimeline,
  migrateSpots,
};
