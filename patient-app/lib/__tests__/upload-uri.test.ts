import { describe, expect, it, vi } from 'vitest';

import { mimeTypeFromImagePickerAsset, uriToUploadFile } from '@/lib/upload-uri';

describe('uriToUploadFile', () => {
  it('returns native file payload for file:// URIs', async () => {
    const file = await uriToUploadFile('file:///tmp/spot.jpg', 'spot-1.jpg');
    expect(file).toEqual({
      uri: 'file:///tmp/spot.jpg',
      name: 'spot-1.jpg',
      type: 'image/jpeg',
    });
  });

  it('returns native file payload for content:// URIs', async () => {
    const file = await uriToUploadFile('content://media/photo/1', 'spot-1.jpg', 'image/png');
    expect(file).toEqual({
      uri: 'content://media/photo/1',
      name: 'spot-1.jpg',
      type: 'image/png',
    });
  });

  it('fetches blob URIs on web', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => blob })),
    );
    const file = await uriToUploadFile('blob:http://localhost/abc', 'photo.jpg');
    expect(file).toBeInstanceOf(Blob);
    vi.unstubAllGlobals();
  });

  it('fetches data URIs on web', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => blob })),
    );
    const file = await uriToUploadFile('data:image/png;base64,abc', 'photo.png');
    expect(file).toBeInstanceOf(Blob);
    vi.unstubAllGlobals();
  });
});

describe('mimeTypeFromImagePickerAsset', () => {
  it('prefers asset mimeType', () => {
    expect(mimeTypeFromImagePickerAsset({ mimeType: 'image/heic', uri: 'file:///a.jpg' })).toBe(
      'image/heic',
    );
  });

  it('infers from uri extension', () => {
    expect(mimeTypeFromImagePickerAsset({ uri: 'file:///a.heic' })).toBe('image/heic');
  });
});
