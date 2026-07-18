import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getPatientSessionId,
  patientUploadForm,
  patientPost,
  patientPostPublic,
  setPendingCaptureToken,
  uriToUploadFile,
  appendUploadToForm,
} = vi.hoisted(() => ({
  getPatientSessionId: vi.fn(async (): Promise<string | null> => null),
  patientUploadForm: vi.fn(async () => ({ success: true, fact: { id: 'f_auth' } })),
  patientPost: vi.fn(async () => ({ success: true })),
  patientPostPublic: vi.fn(async () => ({
    success: true,
    fact: { id: 'f_anon' },
    capture_token: 'cap_test_token',
  })),
  setPendingCaptureToken: vi.fn(async () => undefined),
  uriToUploadFile: vi.fn(async () => ({ uri: 'file://x.jpg', name: 'x.jpg', type: 'image/jpeg' })),
  appendUploadToForm: vi.fn((opts: {
    form: FormData;
    file: { uri: string; name: string; type: string };
    fileName: string;
  }) => {
    const { form, file, fileName } = opts;
    (form as FormData & { __files?: unknown[] }).__files = [
      ...(((form as FormData & { __files?: unknown[] }).__files) || []),
      { file, fileName },
    ];
    form.append('file', new Blob(['x'], { type: file.type || 'image/jpeg' }), fileName || file.name);
  }),
}));

vi.mock('@/lib/patient-session', () => ({ getPatientSessionId }));
vi.mock('@/lib/patient-api', () => ({
  patientUploadForm,
  patientPost,
  patientPostPublic,
  PatientApiError: class PatientApiError extends Error {
    status?: number;
    error_code?: string;
    body?: unknown;
    constructor(
      message: string,
      opts?: { status?: number; error_code?: string; body?: unknown; message?: string },
    ) {
      super(opts?.message || message);
      this.status = opts?.status;
      this.error_code = opts?.error_code || message;
      this.body = opts?.body;
    }
  },
}));
vi.mock('@/lib/pending-capture-token', () => ({
  setPendingCaptureToken,
  getPendingCaptureToken: vi.fn(async () => null),
  clearPendingCaptureToken: vi.fn(async () => undefined),
}));
vi.mock('@/lib/upload-uri', () => ({ uriToUploadFile, appendUploadToForm }));
vi.mock('@/config', () => ({
  getEffectiveApiBaseUrl: () => 'https://api.test',
}));
vi.mock('@/lib/routine-day-mode', () => ({
  localTodayIso: () => '2026-07-16',
}));

import { captureRecordFact, confirmRecordFact } from '@/lib/patient-record-capture';
import { uploadAnonymousRecord } from '@/lib/anonymous-record-upload';

describe('C2/H3 patient-record-capture wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          fact: { id: 'f_anon_mp' },
          capture_token: 'cap_multipart',
        }),
      })),
    );
  });

  it('authenticated capture posts multipart to /api/patient/records/capture', async () => {
    getPatientSessionId.mockResolvedValueOnce('sess_1');
    const result = await captureRecordFact({
      tag: 'mark',
      uri: 'file://spot.jpg',
      mimeType: 'image/jpeg',
      body_location: 'neck',
      label: 'cheek',
      request_id: 'req_stable_client_1',
    });
    expect(result.via).toBe('authenticated_capture');
    expect(result.request_id).toBe('req_stable_client_1');
    expect(patientUploadForm).toHaveBeenCalledWith(
      '/api/patient/records/capture',
      expect.any(FormData),
    );
    expect(uriToUploadFile).toHaveBeenCalledWith({
      uri: 'file://spot.jpg',
      fileName: 'capture-mark.jpg',
      mimeType: 'image/jpeg',
    });
    expect(appendUploadToForm).toHaveBeenCalledWith({
      form: expect.any(FormData),
      file: expect.objectContaining({ uri: 'file://x.jpg' }),
      fileName: 'capture-mark.jpg',
    });
    // Never the swapped (form, 'file', file) signature that uploaded the string "file".
    expect(appendUploadToForm.mock.calls[0][0]).not.toBeInstanceOf(FormData);
    expect(appendUploadToForm.mock.calls[0][0].file).not.toBe('file');
    const form = patientUploadForm.mock.calls[0][1] as FormData;
    expect(form.get('tag')).toBe('mark');
    expect(form.get('ai_or_manual')).toBe('manual');
    expect(form.get('request_id')).toBe('req_stable_client_1');
  });

  it('always generates request_id when caller omits it', async () => {
    getPatientSessionId.mockResolvedValueOnce('sess_1');
    const result = await captureRecordFact({
      tag: 'skin',
      uri: 'file://skin.jpg',
    });
    expect(result.request_id).toMatch(/^req_/);
    const form = patientUploadForm.mock.calls[0][1] as FormData;
    expect(form.get('request_id')).toBe(result.request_id);
  });

  it('anonymous capture with file stashes capture_token for OTP', async () => {
    getPatientSessionId.mockResolvedValueOnce(null);
    const result = await captureRecordFact({
      tag: 'mark',
      uri: 'file://spot.jpg',
      label: 'pre-auth spot',
      request_id: 'req_anon_1',
    });
    expect(result.via).toBe('anonymous_capture');
    expect(result.request_id).toBe('req_anon_1');
    expect(result.capture_token).toBe('cap_multipart');
    expect(setPendingCaptureToken).toHaveBeenCalledWith('cap_multipart');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/patient/records/anonymous',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData;
    expect(body.get('request_id')).toBe('req_anon_1');
  });

  it('uploadAnonymousRecord JSON path also stashes token (H3 plumbing)', async () => {
    const data = await uploadAnonymousRecord({
      tag: 'skin',
      confirm: true,
      structured_json: { date: '2026-07-16', note: 'n' },
    });
    expect(data.capture_token).toBe('cap_test_token');
    expect(setPendingCaptureToken).toHaveBeenCalledWith('cap_test_token');
    expect(patientPostPublic).toHaveBeenCalledWith(
      '/api/patient/records/anonymous',
      expect.objectContaining({ tag: 'skin', confirm: true }),
    );
  });

  it('authenticated confirm does not throw CAPTURE_TOKEN_REQUIRED when sid is briefly null', async () => {
    // via=authenticated_capture means this fact was created on the auth path —
    // missing SecureStore session must be SESSION_REQUIRED, never the anonymous token error.
    getPatientSessionId.mockResolvedValueOnce(null);
    await expect(
      confirmRecordFact(
        'prf_auth_1',
        { date: '2026-07-16', drug: 'Glasses prescription', rx_kind: 'optical' },
        { via: 'authenticated_capture', request_id: 'req_1' },
      ),
    ).rejects.toMatchObject({ error_code: 'SESSION_REQUIRED' });
    expect(patientPost).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/anonymous/'),
      expect.anything(),
    );
  });

  it('authenticated confirm with session posts to /records/:id/confirm', async () => {
    getPatientSessionId.mockResolvedValueOnce('sess_1');
    patientPost.mockResolvedValueOnce({ success: true });
    await confirmRecordFact(
      'prf_auth_2',
      { date: '2026-07-16', od_sph: '-0.25' },
      { via: 'authenticated_capture', request_id: 'req_2' },
    );
    expect(patientPost).toHaveBeenCalledWith(
      '/api/patient/records/prf_auth_2/confirm',
      expect.objectContaining({ request_id: 'req_2' }),
    );
  });

  it('anonymous confirm still requires capture_token', async () => {
    getPatientSessionId.mockResolvedValue(null);
    await expect(
      confirmRecordFact('prf_anon_1', { date: '2026-07-16' }, { via: 'anonymous_capture' }),
    ).rejects.toMatchObject({ error_code: 'CAPTURE_TOKEN_REQUIRED' });
  });
});
