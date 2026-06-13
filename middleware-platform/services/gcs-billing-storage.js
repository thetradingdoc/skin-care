'use strict';

const path = require('path');
const crypto = require('crypto');

/**
 * Patient media upload helper used by routine, journal, spots, and billing routes.
 * Uses Azure blob storage when configured; otherwise stores a deterministic local ref for dev/test.
 */
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
      return {
        storageRef: uploaded.url || `${uploaded.provider}://${uploaded.bucket}/${uploaded.key}`,
        provider: uploaded.provider,
      };
    }
  } catch (_) {}

  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  return {
    storageRef: `local://${path.posix.join('patient-media', String(patientId || 'session'), `${hash}_${safeName}`)}`,
    provider: 'local',
  };
}

module.exports = {
  uploadBuffer,
};
