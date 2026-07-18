'use strict';

/**
 * P2.29 — Present facts to clients without leaking long-lived blob URLs.
 * Prefer short-TTL Azure SAS from opaque storage_key; else DB-backed token path
 * (works across Cloud Run instances — not process memory).
 */

const crypto = require('crypto');
const BlobStorage = require('./blob-storage');
const { parseStorageRef } = require('./gcs-billing-storage');

const DEFAULT_TTL_SEC = Math.max(60, Number(process.env.PATIENT_RECORD_MEDIA_TTL_SEC || 300));

/** Optional in-memory cache; source of truth is SQLite when db is provided. */
const mediaTokensMemory = new Map();

function ensureMediaTokenTable(db) {
  if (!db || typeof db.exec !== 'function') return;
  require('../migrations/070_patient_record_media_tokens').up(db);
}

function redactStorageRef(ref) {
  const s = String(ref || '');
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    // Legacy permanent URL → opaque if parseable
    const parsed = parseStorageRef(s);
    return parsed?.storage_ref && !/^https?:\/\//i.test(parsed.storage_ref)
      ? parsed.storage_ref
      : null;
  }
  if (s.startsWith('azure://') || s.startsWith('local://')) return s;
  return null;
}

function resolveFactMediaIdentity(fact) {
  let key = fact.storage_key || null;
  let provider = fact.storage_provider || null;
  let storageRef = fact.storage_ref || null;
  if (!key && storageRef) {
    const parsed = parseStorageRef(storageRef);
    if (parsed) {
      key = parsed.key || key;
      provider = parsed.provider || provider;
      storageRef = parsed.storage_ref || storageRef;
    }
  }
  return { key, provider, storageRef };
}

function persistMediaToken(db, token, entry) {
  ensureMediaTokenTable(db);
  db.prepare(
    `INSERT OR REPLACE INTO patient_record_media_tokens
      (token, fact_id, storage_key, storage_provider, storage_ref, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(
    token,
    entry.fact_id || null,
    entry.storage_key || null,
    entry.storage_provider || null,
    entry.storage_ref || null,
    new Date(entry.expires_at).toISOString(),
  );
}

function issueSignedOrTokenUrl(fact, { ttlSec = DEFAULT_TTL_SEC, db = null } = {}) {
  if (!fact) return { media_url: null, media_url_expires_at: null };

  const { key, provider, storageRef } = resolveFactMediaIdentity(fact);
  const expiresAtMs = Date.now() + ttlSec * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();

  if (key && provider === 'azure' && BlobStorage.isAzureConfigured && BlobStorage.isAzureConfigured()) {
    try {
      const media_url = BlobStorage.generateSignedUrl({
        blobName: key,
        expiresInSeconds: ttlSec,
      });
      return { media_url, media_url_expires_at: expiresAt };
    } catch (e) {
      console.warn('[patient-record-media-access] SAS failed:', e.message);
    }
  }

  if (key || storageRef) {
    const token = crypto.randomBytes(24).toString('hex');
    const entry = {
      fact_id: fact.id,
      storage_key: key,
      storage_provider: provider,
      storage_ref: storageRef,
      expires_at: expiresAtMs,
    };
    if (db) {
      try {
        persistMediaToken(db, token, entry);
      } catch (e) {
        console.warn('[patient-record-media-access] persist token failed:', e.message);
        mediaTokensMemory.set(token, entry);
      }
    } else {
      mediaTokensMemory.set(token, entry);
    }
    return {
      media_url: `/api/patient/records/media/${token}`,
      media_url_expires_at: expiresAt,
    };
  }

  return { media_url: null, media_url_expires_at: null };
}

function consumeMediaToken(token, db = null, { burn = true } = {}) {
  const t = String(token || '');
  if (!t) return null;

  if (db) {
    try {
      ensureMediaTokenTable(db);
      // Opportunistic cleanup
      db.prepare(
        `DELETE FROM patient_record_media_tokens WHERE datetime(expires_at) < datetime('now')`,
      ).run();
      const row = db
        .prepare(`SELECT * FROM patient_record_media_tokens WHERE token = ? LIMIT 1`)
        .get(t);
      if (!row) return null;
      if (new Date(row.expires_at).getTime() < Date.now()) {
        db.prepare(`DELETE FROM patient_record_media_tokens WHERE token = ?`).run(t);
        return null;
      }
      // SEC-30: burn-on-use — single consume capability URL
      if (burn) {
        db.prepare(`DELETE FROM patient_record_media_tokens WHERE token = ?`).run(t);
      }
      return {
        fact_id: row.fact_id,
        storage_key: row.storage_key,
        storage_provider: row.storage_provider,
        storage_ref: row.storage_ref,
        expires_at: new Date(row.expires_at).getTime(),
      };
    } catch (e) {
      console.warn('[patient-record-media-access] token lookup failed:', e.message);
    }
  }

  const entry = mediaTokensMemory.get(t);
  if (!entry) return null;
  if (Date.now() > entry.expires_at) {
    mediaTokensMemory.delete(t);
    return null;
  }
  if (burn) mediaTokensMemory.delete(t);
  return entry;
}

function presentFact(fact, { db = null } = {}) {
  if (!fact) return null;
  const access = issueSignedOrTokenUrl(fact, { db });
  let structured = fact.structured_json;
  if (typeof structured === 'string') {
    try {
      structured = JSON.parse(structured);
    } catch (_) {
      structured = {};
    }
  }
  if (structured && typeof structured === 'object') {
    structured = { ...structured };
    if (structured.photo_ref != null) {
      structured.photo_ref = redactStorageRef(structured.photo_ref);
    }
    if (structured.storage_ref != null) {
      structured.storage_ref = redactStorageRef(structured.storage_ref);
    }
  }
  return {
    ...fact,
    structured_json: structured != null ? structured : fact.structured_json,
    storage_ref: redactStorageRef(fact.storage_ref),
    storage_key: (fact.storage_key || resolveFactMediaIdentity(fact).key) ? '[opaque]' : null,
    media_url: access.media_url,
    media_url_expires_at: access.media_url_expires_at,
  };
}

module.exports = {
  presentFact,
  issueSignedOrTokenUrl,
  consumeMediaToken,
  redactStorageRef,
  DEFAULT_TTL_SEC,
  ensureMediaTokenTable,
};
