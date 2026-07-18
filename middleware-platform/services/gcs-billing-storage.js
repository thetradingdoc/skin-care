'use strict';

/**
 * AZ-03 — Misnamed historically: this module is NOT Google Cloud Storage.
 * It stores billing/routine/journal media via Azure Blob when configured, else local://.
 * New medical-tracker writes should prefer `patient-record-media.js` (GCS-first, AZ-02).
 * Rename/fold into patient-record-media is a follow-up once AZ-01 proves no azure:// hot path.
 *
 * Patient media upload helper used by routine, journal, spots, and billing routes.
 * Uses Azure blob storage when configured; otherwise stores a deterministic local ref for dev/test.
 *
 * P2.29 / P3.06: Prefer opaque azure:// or local:// refs + storageKey — not permanent HTTPS URLs.
 */

function opaqueAzureRef(bucket, key) {
  return `azure://${bucket}/${key}`;
}

/**
 * Parse storage refs for download / dual-write.
 * Supports azure://bucket/key, local://path, and legacy permanent Azure HTTPS URLs.
 */
function parseStorageRef(storageRef) {
  const s = String(storageRef || '').trim();
  if (!s) return null;

  if (s.startsWith('azure://')) {
    const rest = s.slice('azure://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return { provider: 'azure', bucket: null, key: rest, storage_ref: s };
    return {
      provider: 'azure',
      bucket: rest.slice(0, slash),
      key: rest.slice(slash + 1),
      storage_ref: s,
    };
  }

  if (s.startsWith('local://')) {
    const key = s.slice('local://'.length);
    return { provider: 'local', bucket: null, key, storage_ref: s };
  }

  // Legacy permanent Azure blob URL
  const m = s.match(/\.blob\.core\.windows\.net\/([^/?]+)\/([^?]+)/i);
  if (m) {
    const bucket = decodeURIComponent(m[1]);
    const key = decodeURIComponent(m[2]);
    return {
      provider: 'azure',
      bucket,
      key,
      storage_ref: opaqueAzureRef(bucket, key),
    };
  }

  return { provider: null, bucket: null, key: null, storage_ref: s };
}

async function uploadBuffer({ buffer, contentType, patientId, fileName }) {
  const safeName = String(fileName || 'upload.jpg').replace(/[^\w.\-]+/g, '_');
  const blobName = `patients/${String(patientId || 'session')}/${Date.now()}_${safeName}`;

  try {
    const BlobStorage = require('./blob-storage');
    if (BlobStorage.isAzureConfigured && BlobStorage.isAzureConfigured()) {
      const uploaded = await BlobStorage.uploadBuffer({
        buffer,
        contentType: contentType || 'application/octet-stream',
        blobName,
      });
      const bucket = uploaded.bucket || process.env.AZURE_STORAGE_CONTAINER;
      const key = uploaded.key || blobName;
      return {
        storageRef: opaqueAzureRef(bucket, key),
        storageKey: key,
        provider: uploaded.provider || 'azure',
        bucket,
        // Intentionally omit permanent block.url (P2.29)
      };
    }
  } catch (_) {}

  const { writeLocalMedia, makeLocalKey } = require('./local-media-store');
  const localKey = makeLocalKey({
    owner: patientId || 'session',
    fileName: safeName,
    buffer,
    prefix: 'patient-media',
  });
  const written = writeLocalMedia({ buffer, localKey });
  return {
    storageRef: written.storage_ref,
    storageKey: written.localKey,
    provider: 'local',
    bucket: null,
  };
}

/**
 * P3.06 — Download bytes for a previously stored ref (OCR round-trip).
 */
async function downloadBuffer(storageRef) {
  const parsed = parseStorageRef(storageRef);
  if (!parsed) {
    throw new Error('storage_ref_required');
  }

  if (parsed.provider === 'azure' && parsed.key) {
    const BlobStorage = require('./blob-storage');
    if (!BlobStorage.isAzureConfigured || !BlobStorage.isAzureConfigured()) {
      throw new Error('azure_storage_not_configured');
    }
    return BlobStorage.downloadBuffer({ blobName: parsed.key });
  }

  if (parsed.provider === 'local' && parsed.key) {
    const { readLocalMedia } = require('./local-media-store');
    return readLocalMedia(parsed.key);
  }

  throw new Error(`unsupported_storage_ref:${String(storageRef).slice(0, 80)}`);
}

/**
 * Delete bytes for azure:// or local:// refs (retention purge).
 */
async function deleteBuffer(storageRef) {
  const parsed = parseStorageRef(storageRef);
  if (!parsed) return { deleted: false, reason: 'no_ref' };

  if (parsed.provider === 'azure' && parsed.key) {
    const BlobStorage = require('./blob-storage');
    if (!BlobStorage.isAzureConfigured || !BlobStorage.isAzureConfigured()) {
      return { deleted: false, reason: 'azure_storage_not_configured' };
    }
    const result = await BlobStorage.deleteBlob({ blobName: parsed.key });
    return { deleted: Boolean(result?.deleted), reason: result?.deleted ? 'azure_deleted' : 'azure_missing' };
  }

  if (parsed.provider === 'local' && parsed.key) {
    const fs = require('fs');
    const path = require('path');
    const root = process.env.PATIENT_LOCAL_MEDIA_ROOT;
    if (!root) return { deleted: false, reason: 'no_local_root' };
    const abs = path.isAbsolute(parsed.key) ? parsed.key : path.join(root, parsed.key);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      return { deleted: true, reason: 'local_unlinked' };
    }
    return { deleted: true, reason: 'local_already_gone' };
  }

  return { deleted: false, reason: 'unsupported_storage_ref' };
}

/**
 * Short-TTL URL for opaque refs (journal/spots API responses).
 */
function issueReadUrl(storageRef, { expiresInSeconds = 300 } = {}) {
  const parsed = parseStorageRef(storageRef);
  if (!parsed) return null;
  if (parsed.provider === 'azure' && parsed.key) {
    try {
      const BlobStorage = require('./blob-storage');
      if (BlobStorage.isAzureConfigured && BlobStorage.isAzureConfigured()) {
        return BlobStorage.generateSignedUrl({
          blobName: parsed.key,
          expiresInSeconds,
        });
      }
    } catch (_) {}
  }
  // local / unknown: return opaque ref (client must not treat as fetchable https)
  return parsed.storage_ref && !/^https?:\/\//i.test(parsed.storage_ref)
    ? parsed.storage_ref
    : null;
}

module.exports = {
  uploadBuffer,
  downloadBuffer,
  deleteBuffer,
  parseStorageRef,
  issueReadUrl,
};
