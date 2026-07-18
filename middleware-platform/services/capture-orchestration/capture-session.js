'use strict';

/**
 * P3.18–P3.21 — Multi-tag capture session model + tag routing order.
 */

const TAG_ORDER = Object.freeze(['skin', 'mark', 'prescription', 'bill', 'lab', 'other']);

/** Locked sequencing for multi-select (P3.19). */
const MULTI_ROUTE_ORDER = Object.freeze(['skin', 'mark', 'bill', 'lab', 'prescription', 'other']);

function normalizeTags(tags) {
  const arr = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const out = [];
  for (const t of arr) {
    const s = String(t || '').trim().toLowerCase();
    if (TAG_ORDER.includes(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

function orderTagsForCapture(tags) {
  const set = new Set(normalizeTags(tags));
  return MULTI_ROUTE_ORDER.filter((t) => set.has(t));
}

function ensureCaptureSessionsTable(db) {
  require('../../migrations/071_capture_sessions').up(db);
}

function createCaptureSession(db, { patientId, sessionId, tags, captureToken = null }) {
  ensureCaptureSessionsTable(db);
  const { v4: uuidv4 } = require('uuid');
  const id = `csess_${uuidv4()}`;
  const ordered = orderTagsForCapture(tags);
  if (!ordered.length) throw new Error('tags_required');
  const queue = ordered.map((tag, i) => ({
    tag,
    status: i === 0 ? 'active' : 'queued',
    fact_id: null,
    reveal_done: false,
    thesis_done: false,
  }));
  db.prepare(
    `INSERT INTO capture_sessions (
      id, patient_id, session_id, capture_token, tags_json, queue_json, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`,
  ).run(
    id,
    patientId || null,
    sessionId || null,
    captureToken || null,
    JSON.stringify(ordered),
    JSON.stringify(queue),
  );
  return getCaptureSession(db, id);
}

function getCaptureSession(db, id) {
  ensureCaptureSessionsTable(db);
  const row = db.prepare(`SELECT * FROM capture_sessions WHERE id = ? LIMIT 1`).get(id);
  if (!row) return null;
  let tags = [];
  let queue = [];
  try {
    tags = JSON.parse(row.tags_json || '[]');
  } catch (_) {}
  try {
    queue = JSON.parse(row.queue_json || '[]');
  } catch (_) {}
  return {
    id: row.id,
    patient_id: row.patient_id,
    session_id: row.session_id,
    capture_token: row.capture_token,
    tags,
    queue,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function advanceCaptureQueue(db, sessionId, { factId, tag, step = 'confirm' } = {}) {
  const sess = getCaptureSession(db, sessionId);
  if (!sess) return null;
  const queue = sess.queue.map((q) => ({ ...q }));
  let idx = queue.findIndex((q) => q.tag === tag);
  if (idx < 0) return sess;

  if (step === 'confirm') {
    queue[idx].status = 'confirmed';
    queue[idx].fact_id = factId || queue[idx].fact_id;
    const next = queue.find((q) => q.status === 'queued');
    if (next) next.status = 'active';
  } else if (step === 'reveal') {
    queue[idx].reveal_done = true;
    if (queue[idx].status === 'confirmed' || queue[idx].status === 'active') {
      queue[idx].status = 'revealed';
    }
  } else if (step === 'thesis') {
    queue[idx].thesis_done = true;
    queue[idx].status = 'done';
  }

  const allThesis = queue.every((q) => q.thesis_done);
  const status = allThesis ? 'complete' : 'active';
  db.prepare(
    `UPDATE capture_sessions SET queue_json = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(queue), status, sessionId);
  return getCaptureSession(db, sessionId);
}

module.exports = {
  TAG_ORDER,
  MULTI_ROUTE_ORDER,
  normalizeTags,
  orderTagsForCapture,
  createCaptureSession,
  getCaptureSession,
  advanceCaptureQueue,
  ensureCaptureSessionsTable,
};
