'use strict';

/**
 * Shared local filesystem persistence for opaque local:// media refs.
 * Both patient-record-media and gcs-billing-storage must write AND read the same paths.
 *
 * SEC-06: read path must reject `..` and stay under localMediaRoot (no cwd/__dirname fallbacks).
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function localMediaRoot() {
  return (
    process.env.PATIENT_LOCAL_MEDIA_ROOT ||
    path.join(__dirname, '..', 'uploads')
  );
}

/**
 * Normalize + validate a relative key under the media root.
 * Rejects traversal, absolute paths, NUL, and empty keys.
 */
function assertSafeLocalKey(localKeyOrRef) {
  const raw = String(localKeyOrRef || '');
  // Reject absolute / drive paths before stripping scheme or leading slashes
  const withoutScheme = raw.replace(/^local:\/\//, '');
  if (path.isAbsolute(withoutScheme) || /^[a-zA-Z]:[\\/]/.test(withoutScheme)) {
    throw new Error('invalid_local_key');
  }
  const key = withoutScheme.replace(/^\/+/, '');
  if (!key) throw new Error('invalid_local_key');
  if (key.includes('\0')) throw new Error('invalid_local_key');
  if (key.includes('..')) throw new Error('invalid_local_key');
  if (path.isAbsolute(key)) throw new Error('invalid_local_key');
  // Windows-style absolute or drive-relative
  if (/^[a-zA-Z]:/.test(key)) throw new Error('invalid_local_key');

  const root = path.resolve(localMediaRoot());
  const candidate = path.resolve(root, key);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    throw new Error('invalid_local_key');
  }
  return { key, absolutePath: candidate, root };
}

/**
 * Write buffer under uploads/<localKey> and return { absolutePath, localKey, storage_ref }.
 */
function writeLocalMedia({ buffer, localKey }) {
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('buffer_required');
  const { key, absolutePath } = assertSafeLocalKey(localKey);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, buffer);
  return {
    absolutePath,
    localKey: key,
    storage_ref: `local://${key}`,
  };
}

/** @deprecated Prefer assertSafeLocalKey; kept for callers that listed candidates historically. */
function resolveLocalAbsolutePaths(localKey) {
  const { absolutePath } = assertSafeLocalKey(localKey);
  return [absolutePath];
}

function readLocalMedia(localKeyOrRef) {
  const { key, absolutePath } = assertSafeLocalKey(localKeyOrRef);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`local_file_not_found:${key}`);
  }
  return fs.readFileSync(absolutePath);
}

function makeLocalKey({ owner, fileName, buffer, prefix = 'patient-media' }) {
  const safeName = String(fileName || 'upload.bin').replace(/[^\w.\-]+/g, '_');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  return path.posix.join(prefix, String(owner || 'session'), `${hash}_${safeName}`);
}

module.exports = {
  localMediaRoot,
  writeLocalMedia,
  readLocalMedia,
  resolveLocalAbsolutePaths,
  assertSafeLocalKey,
  makeLocalKey,
};
