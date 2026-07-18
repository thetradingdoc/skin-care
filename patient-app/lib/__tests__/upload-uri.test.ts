import { describe, expect, it, vi } from 'vitest';

import {
  appendUploadToForm,
  mimeTypeFromImagePickerAsset,
  uriToUploadFile,
} from '@/lib/upload-uri';

describe('uriToUploadFile (options object)', () => {
  it('returns native file payload for file:// URIs', async () => {
    const file = await uriToUploadFile({ uri: 'file:///tmp/spot.jpg', fileName: 'spot-1.jpg' });
    expect(file).toEqual({
      uri: 'file:///tmp/spot.jpg',
      name: 'spot-1.jpg',
      type: 'image/jpeg',
    });
  });

  it('returns native file payload for content:// URIs', async () => {
    const file = await uriToUploadFile({
      uri: 'content://media/photo/1',
      fileName: 'spot-1.jpg',
      mimeType: 'image/png',
    });
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
    const file = await uriToUploadFile({ uri: 'blob:http://localhost/abc', fileName: 'photo.jpg' });
    expect(file).toBeInstanceOf(Blob);
    vi.unstubAllGlobals();
  });

  it('fetches data URIs on web', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => blob })),
    );
    const file = await uriToUploadFile({ uri: 'data:image/png;base64,abc', fileName: 'photo.png' });
    expect(file).toBeInstanceOf(Blob);
    vi.unstubAllGlobals();
  });

  it('rejects positional / non-object calls at runtime', async () => {
    await expect(
      // @ts-expect-error intentional misuse
      uriToUploadFile('file:///a.jpg', 'a.jpg'),
    ).rejects.toThrow(/options|pass \{ uri/);
  });
});

describe('appendUploadToForm (options object)', () => {
  it('appends Blob with field name + fileName', () => {
    const calls: unknown[] = [];
    const form = {
      append(key: string, value: unknown, filename?: string) {
        calls.push({ key, value, filename });
      },
    } as unknown as FormData;
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    appendUploadToForm({ form, file: blob, fileName: 'x.jpg' });
    expect(calls).toEqual([{ key: 'file', value: blob, filename: 'x.jpg' }]);
  });

  it('rejects string file (the device FormData swap signature)', () => {
    const form = new FormData();
    expect(() =>
      // @ts-expect-error intentional misuse
      appendUploadToForm({ form, file: 'file', fileName: 'x.jpg' }),
    ).toThrow(/got a string/);
  });

  it('rejects bare positional misuse at runtime', () => {
    expect(() =>
      // @ts-expect-error intentional misuse
      appendUploadToForm(new FormData(), 'file', { uri: 'x' }),
    ).toThrow(/pass \{ form, file, fileName \}/);
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
