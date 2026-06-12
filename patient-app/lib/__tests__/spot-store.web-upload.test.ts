import { beforeEach, describe, expect, it, vi } from 'vitest';

const { patientUploadForm, persistGet, persistSet } = vi.hoisted(() => ({
  patientUploadForm: vi.fn(async (_url: string, _form: FormData) => ({ success: true })),
  persistGet: vi.fn(async (_key: string): Promise<string | null> => JSON.stringify([])),
  persistSet: vi.fn(async (_key: string, _value: string) => undefined),
}));

vi.mock('@/lib/patient-api', () => ({
  patientGet: vi.fn(async () => ({ spots: [] })),
  patientPost: vi.fn(),
  patientUploadForm,
}));

vi.mock('@/lib/local-persist', () => ({
  persistGet,
  persistSet,
}));

import { listSpots } from '@/lib/spot-store';

describe('spot-store web URI uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const blob = new Blob(['pixels'], { type: 'image/jpeg' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () => blob,
      })),
    );
    persistGet.mockImplementation(async (key: string) => {
      if (key === 'patient_spots_pending_v1') {
        return JSON.stringify([
          { spotId: 'spot_1', date: '2026-06-11', uri: 'blob:http://localhost/abc' },
        ]);
      }
      if (key === 'patient_spots_v1') return JSON.stringify([]);
      return null;
    });
  });

  it('uploads blob: URIs via FormData on web', async () => {
    await listSpots();
    expect(patientUploadForm).toHaveBeenCalled();
    const form = patientUploadForm.mock.calls[0][1];
    expect(form.get('file')).toBeTruthy();
  });

  it('uploads data: URIs via FormData on web', async () => {
    persistGet.mockImplementation(async (key: string) => {
      if (key === 'patient_spots_pending_v1') {
        return JSON.stringify([
          {
            spotId: 'spot_2',
            date: '2026-06-11',
            uri: 'data:image/png;base64,aaaa',
          },
        ]);
      }
      if (key === 'patient_spots_v1') return JSON.stringify([]);
      return null;
    });
    await listSpots();
    expect(patientUploadForm).toHaveBeenCalled();
  });
});
