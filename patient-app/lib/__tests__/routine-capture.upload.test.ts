import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/patient-api', () => ({
  patientGet: vi.fn(),
  patientPost: vi.fn(),
  patientUploadForm: vi.fn(),
}));

vi.mock('@/lib/upload-uri', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/upload-uri')>();
  return {
    ...actual,
    uriToUploadFile: vi.fn(),
  };
});

import { patientGet, patientPost, patientUploadForm } from '@/lib/patient-api';
import { uploadRoutineProgressPhoto } from '@/lib/routine-capture';
import { uriToUploadFile } from '@/lib/upload-uri';

describe('uploadRoutineProgressPhoto', () => {
  beforeEach(() => {
    vi.mocked(patientGet).mockReset();
    vi.mocked(patientPost).mockReset();
    vi.mocked(patientUploadForm).mockReset();
    vi.mocked(uriToUploadFile).mockReset();
  });

  it('uploads with mimeType via shared uri helper', async () => {
    vi.mocked(patientGet).mockResolvedValue({ daily_entry: { id: 'daily-1' } });
    vi.mocked(uriToUploadFile).mockResolvedValue(new Blob(['x'], { type: 'image/heic' }));
    vi.mocked(patientUploadForm).mockResolvedValue({
      completion_score: 100,
      assistant_summary: 'Logged',
    });

    await uploadRoutineProgressPhoto({
      entryDate: '2026-06-11',
      uri: 'file:///tmp/progress.jpg',
      mimeType: 'image/heic',
    });

    expect(uriToUploadFile).toHaveBeenCalledWith(
      'file:///tmp/progress.jpg',
      expect.stringMatching(/^progress-/),
      'image/heic',
    );
    expect(patientUploadForm).toHaveBeenCalledWith(
      '/api/patient/routine/daily/daily-1/photo',
      expect.any(FormData),
    );
  });

  it('creates daily entry when missing', async () => {
    vi.mocked(patientGet).mockResolvedValue({});
    vi.mocked(patientPost).mockResolvedValue({ daily_entry_id: 'daily-new' });
    vi.mocked(uriToUploadFile).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    vi.mocked(patientUploadForm).mockResolvedValue({ completion_score: 100 });

    await uploadRoutineProgressPhoto({
      entryDate: '2026-06-11',
      uri: 'file:///tmp/progress.jpg',
    });

    expect(patientPost).toHaveBeenCalledWith('/api/patient/routine/daily', {
      entry_date: '2026-06-11',
      item_logs: [],
    });
  });
});
