'use strict';

/**
 * TOUCH-115/116 — enqueue / send push reminders (Expo Push API).
 * Token table from TOUCH-114.
 */

function ensureTables(sqliteDb) {
  sqliteDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS patient_device_push_tokens (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        session_id TEXT,
        platform TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(token)
      )`,
    )
    .run();
  sqliteDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS patient_push_outbox (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        session_id TEXT,
        kind TEXT NOT NULL,
        title TEXT,
        body TEXT,
        data_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
      )`,
    )
    .run();
}

function enqueuePush(sqliteDb, { patientId, sessionId, kind, title, body, data }) {
  ensureTables(sqliteDb);
  const id = `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sqliteDb
    .prepare(
      `INSERT INTO patient_push_outbox (id, patient_id, session_id, kind, title, body, data_json, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'pending')`,
    )
    .run(
      id,
      patientId || null,
      sessionId || null,
      kind,
      title || null,
      body || null,
      JSON.stringify(data || {}),
    );
  return id;
}

/**
 * TOUCH-116 — if agent delta would show, enqueue a background push.
 */
function maybeEnqueueAgentDeltaPush(sqliteDb, { patientId, sessionId, message }) {
  if (!message) return null;
  return enqueuePush(sqliteDb, {
    patientId,
    sessionId,
    kind: 'agent_delta',
    title: 'touche',
    body: String(message).slice(0, 180),
    data: { route: '/capture', kind: 'agent_delta' },
  });
}

async function flushOutboxViaExpo(sqliteDb, { limit = 20 } = {}) {
  ensureTables(sqliteDb);
  const rows = sqliteDb
    .prepare(
      `SELECT * FROM patient_push_outbox WHERE status = 'pending' ORDER BY datetime(created_at) ASC LIMIT ?`,
    )
    .all(limit);
  if (!rows.length) return { sent: 0 };

  const messages = [];
  for (const row of rows) {
    const tokens = sqliteDb
      .prepare(
        `SELECT token FROM patient_device_push_tokens
         WHERE (patient_id IS NOT NULL AND patient_id = ?)
            OR (session_id IS NOT NULL AND session_id = ?)
         LIMIT 5`,
      )
      .all(row.patient_id, row.session_id)
      .map((t) => t.token)
      .filter(Boolean);
    for (const to of tokens) {
      messages.push({
        to,
        title: row.title || 'touche',
        body: row.body || '',
        data: (() => {
          try {
            return JSON.parse(row.data_json || '{}');
          } catch {
            return {};
          }
        })(),
        outboxId: row.id,
      });
    }
    if (!tokens.length) {
      sqliteDb
        .prepare(`UPDATE patient_push_outbox SET status = 'no_token', sent_at = datetime('now') WHERE id = ?`)
        .run(row.id);
    }
  }

  if (!messages.length) return { sent: 0 };

  // Best-effort Expo push; no-op if fetch unavailable / no network.
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.map(({ to, title, body, data }) => ({ to, title, body, data }))),
    });
    const ok = res.ok;
    for (const m of messages) {
      sqliteDb
        .prepare(
          `UPDATE patient_push_outbox SET status = ?, sent_at = datetime('now') WHERE id = ?`,
        )
        .run(ok ? 'sent' : 'failed', m.outboxId);
    }
    return { sent: ok ? messages.length : 0 };
  } catch {
    return { sent: 0, error: 'expo_push_failed' };
  }
}

module.exports = {
  ensureTables,
  enqueuePush,
  maybeEnqueueAgentDeltaPush,
  flushOutboxViaExpo,
};
