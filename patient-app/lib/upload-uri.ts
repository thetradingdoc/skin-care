export type UploadFilePayload = Blob | { uri: string; name: string; type: string };

function defaultMimeForUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.heic') || lower.includes('.heif')) return 'image/heic';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export type UriToUploadFileOpts = {
  uri: string;
  fileName: string;
  mimeType?: string;
};

/**
 * Normalize local/web URIs into FormData-compatible file payloads.
 * Options-object only — positional (uri, fileName, mime) was silently swappable
 * with ({ mimeType, fileName }) and produced empty uploads on device.
 */
export async function uriToUploadFile(opts: UriToUploadFileOpts): Promise<UploadFilePayload> {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) {
    throw new Error(
      'uriToUploadFile: pass { uri, fileName, mimeType? } — positional args are not supported',
    );
  }
  const uri = String(opts.uri || '').trim();
  const fileName = String(opts.fileName || '').trim();
  if (!uri) throw new Error('uriToUploadFile: uri is required');
  if (!fileName) throw new Error('uriToUploadFile: fileName is required');

  const mimeType = opts.mimeType;

  if (uri.startsWith('blob:') || uri.startsWith('data:')) {
    const res = await fetch(uri);
    const blob = await res.blob();
    const type = mimeType || blob.type || defaultMimeForUri(uri);
    return blob.type ? blob : new Blob([blob], { type });
  }

  return {
    uri,
    name: fileName,
    type: mimeType || defaultMimeForUri(uri),
  };
}

export type AppendUploadToFormOpts = {
  form: FormData;
  file: UploadFilePayload;
  fileName: string;
  /** Multipart field name — always the field key, never pass the file as this. */
  fieldName?: string;
};

/**
 * Append a file to FormData for RN/web uploads.
 * Options-object only — the positional bug `appendUploadToForm(form, 'file', file)`
 * uploaded the string "file" and triggered QUALITY_GATE_FAILED on every capture.
 */
export function appendUploadToForm(opts: AppendUploadToFormOpts): void {
  if (
    !opts ||
    typeof opts !== 'object' ||
    Array.isArray(opts) ||
    !('form' in opts) ||
    !('file' in opts) ||
    !('fileName' in opts)
  ) {
    throw new Error(
      "appendUploadToForm: pass { form, file, fileName } — do not use positional (form, 'file', file)",
    );
  }
  if (!opts.form || typeof (opts.form as FormData).append !== 'function') {
    throw new Error('appendUploadToForm: form is required');
  }
  if (opts.file == null) {
    throw new Error('appendUploadToForm: file is required');
  }
  if (typeof opts.file === 'string') {
    throw new Error(
      'appendUploadToForm: file must be a Blob or { uri, name, type } — got a string (likely swapped args)',
    );
  }
  const fileName = String(opts.fileName || '').trim();
  if (!fileName) throw new Error('appendUploadToForm: fileName is required');
  const fieldName = String(opts.fieldName || 'file').trim() || 'file';

  if (opts.file instanceof Blob) {
    opts.form.append(fieldName, opts.file, fileName);
  } else {
    const native = opts.file as { uri: string; name: string; type: string };
    if (!native.uri || typeof native.uri !== 'string') {
      throw new Error('appendUploadToForm: native file payload requires uri');
    }
    const payload =
      fileName && native.name !== fileName ? { ...native, name: fileName } : native;
    opts.form.append(fieldName, payload as unknown as Blob);
  }
}

export function mimeTypeFromImagePickerAsset(asset: {
  mimeType?: string | null;
  uri?: string | null;
}): string {
  if (asset.mimeType) return asset.mimeType;
  if (asset.uri) return defaultMimeForUri(asset.uri);
  return 'image/jpeg';
}
