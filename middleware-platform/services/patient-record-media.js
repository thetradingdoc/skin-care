'use strict';

/**
 * AZ-02 — Persist patient_record_facts media.
 * GCS-first when GCS_MEDIA_BUCKET is set; Azure only for legacy when explicitly configured
 * and GCS is unavailable; otherwise local disk under uploads/ (ephemeral on Cloud Run).
 */

const path = require('path');
const { writeLocalMedia } = require('./local-media-store');

async function persistToGcs({ buffer, contentType, blobName }) {
  const bucketName = String(process.env.GCS_MEDIA_BUCKET || '').trim();
  if (!bucketName) return null;
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();
  const file = storage.bucket(bucketName).file(blobName);
  await file.save(buffer, {
    contentType: contentType || 'application/octet-stream',
    resumable: false,
    metadata: { cacheControl: 'private, max-age=0' },
  });
  return {
    storage_provider: 'gcs',
    storage_key: blobName,
    storage_ref: `gs://${bucketName}/${blobName}`,
  };
}

async function persistToAzureLegacy({ buffer, contentType, blobName }) {
  const BlobStorage = require('./blob-storage');
  if (!(BlobStorage.isAzureConfigured && BlobStorage.isAzureConfigured())) return null;
  const uploaded = await BlobStorage.uploadBuffer({
    buffer,
    contentType: contentType || 'application/octet-stream',
    blobName,
  });
  return {
    storage_provider: uploaded.provider || 'azure',
    storage_key: uploaded.key || blobName,
    storage_ref: `azure://${uploaded.bucket}/${uploaded.key || blobName}`,
  };
}

async function persistRecordMedia({ buffer, contentType, patientId, sessionId, fileName, mediaType }) {
  const owner = String(patientId || sessionId || 'session');
  const safeName = String(fileName || (mediaType === 'pdf' ? 'upload.pdf' : 'upload.jpg')).replace(
    /[^\w.\-]+/g,
    '_',
  );
  const blobName = `patients/${owner}/records/${Date.now()}_${safeName}`;

  try {
    const gcs = await persistToGcs({ buffer, contentType, blobName });
    if (gcs) return gcs;
  } catch (e) {
    console.warn('[patient-record-media] GCS upload failed, trying Azure legacy/local:', e.message);
  }

  // AZ-02: Azure is legacy write fallback only — never preferred when GCS succeeds
  try {
    const azure = await persistToAzureLegacy({ buffer, contentType, blobName });
    if (azure) return azure;
  } catch (e) {
    console.warn('[patient-record-media] azure legacy upload failed, falling back to local:', e.message);
  }

  const hashKey = require('crypto').createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const key = path.posix.join('patient-media', owner, 'records', `${hashKey}_${safeName}`);
  const written = writeLocalMedia({ buffer, localKey: key });
  return {
    storage_provider: 'local',
    storage_key: written.localKey,
    storage_ref: written.storage_ref,
  };
}

/**
 * STOR-06 — Best-effort delete of a media ref written before a failed persist.
 * Supports gs://, azure://, local://. Never throws to callers (logs instead).
 */
async function deleteRecordMedia(storage) {
  if (!storage || !storage.storage_ref) return { deleted: false, reason: 'no_ref' };
  const ref = String(storage.storage_ref);
  try {
    if (ref.startsWith('local://')) {
      const { assertSafeLocalKey } = require('./local-media-store');
      const fs = require('fs');
      const { absolutePath } = assertSafeLocalKey(ref);
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
      return { deleted: true, provider: 'local' };
    }
    if (ref.startsWith('gs://')) {
      const m = ref.match(/^gs:\/\/([^/]+)\/(.+)$/);
      if (!m) return { deleted: false, reason: 'bad_gs_ref' };
      const { Storage } = require('@google-cloud/storage');
      await new Storage().bucket(m[1]).file(m[2]).delete({ ignoreNotFound: true });
      return { deleted: true, provider: 'gcs' };
    }
    if (ref.startsWith('azure://')) {
      const BlobStorage = require('./blob-storage');
      const key = storage.storage_key || ref.replace(/^azure:\/\/[^/]+\//, '');
      if (BlobStorage.deleteBlob) {
        await BlobStorage.deleteBlob({ blobName: key });
        return { deleted: true, provider: 'azure' };
      }
    }
    return { deleted: false, reason: 'unsupported_ref' };
  } catch (e) {
    console.warn('[patient-record-media] deleteRecordMedia failed:', e.message);
    return { deleted: false, reason: e.message };
  }
}

module.exports = { persistRecordMedia, deleteRecordMedia };
