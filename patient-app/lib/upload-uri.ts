export type UploadFilePayload = Blob | { uri: string; name: string; type: string };

function defaultMimeForUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.heic') || lower.includes('.heif')) return 'image/heic';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Normalize local/web URIs into FormData-compatible file payloads. */
export async function uriToUploadFile(
  uri: string,
  fileName: string,
  mimeType?: string,
): Promise<UploadFilePayload> {
  const trimmed = String(uri || '').trim();
  if (!trimmed) {
    throw new Error('uri is required');
  }

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    const res = await fetch(trimmed);
    const blob = await res.blob();
    const type = mimeType || blob.type || defaultMimeForUri(trimmed);
    return blob.type ? blob : new Blob([blob], { type });
  }

  return {
    uri: trimmed,
    name: fileName,
    type: mimeType || defaultMimeForUri(trimmed),
  };
}

export function appendUploadToForm(form: FormData, file: UploadFilePayload, filename: string): void {
  if (file instanceof Blob) {
    form.append('file', file, filename);
  } else {
    form.append('file', file as unknown as Blob);
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
