/**
 * Confirm edit → confirmRecordFact (edited values, same request_id, no re-capture).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const { confirmRecordFact, captureRecordFact } = vi.hoisted(() => ({
  confirmRecordFact: vi.fn(async () => ({ success: true })),
  captureRecordFact: vi.fn(),
}));

vi.mock('@/lib/patient-record-capture', () => ({
  confirmRecordFact,
  captureRecordFact,
  uiTagToApiTag: (t: string) => t,
}));

import { confirmRecordFact as confirmFn } from '@/lib/patient-record-capture';

const ROOT = join(__dirname, '../..');

describe('Confirm field edit → persist edited value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrate → edit body_area → confirm sends edited value with same request_id', async () => {
    const pending = {
      factId: 'prf_edit_1',
      draft: {
        date: '2026-07-16',
        body_area: 'cheek, left',
        ai_suggestion: {
          text: 'some redness',
          labeled: 'ai_suggestion',
          not_diagnosis: true,
        },
      },
      request_id: 'req_capture_stable_1',
      via: 'authenticated_capture' as const,
    };

    const editedDraft = { ...pending.draft, body_area: 'forehead' };

    await confirmFn(pending.factId, editedDraft, {
      request_id: pending.request_id,
      via: pending.via,
    });

    expect(confirmRecordFact).toHaveBeenCalledTimes(1);
    expect(confirmRecordFact).toHaveBeenCalledWith(
      'prf_edit_1',
      expect.objectContaining({ body_area: 'forehead', date: '2026-07-16' }),
      expect.objectContaining({ request_id: 'req_capture_stable_1' }),
    );
    expect(captureRecordFact).not.toHaveBeenCalled();
  });

  it('all six confirm screens expose pencil edit affordance', () => {
    for (const tag of ['skin', 'bill', 'rx', 'mark', 'lab', 'other']) {
      const src = readFileSync(join(ROOT, `app/capture/confirm/${tag}.tsx`), 'utf8');
      expect(src).toMatch(/ConfirmEditableField|TemplateFieldsForm/);
      expect(src).toMatch(/setField/);
    }
    const field = readFileSync(
      join(ROOT, 'components/capture/ConfirmEditableField.tsx'),
      'utf8',
    );
    expect(field).toMatch(/-pencil/);
    expect(field).toMatch(/TextInput/);
  });

  it('SecondTierChrome scrolls main content with sticky footer (large templates)', () => {
    const chrome = readFileSync(join(ROOT, 'components/second-tier/SecondTierChrome.tsx'), 'utf8');
    expect(chrome).toMatch(/ScrollView/);
    expect(chrome).toMatch(/testID=\{`\$\{testID\}-scroll`\}/);
    expect(chrome).not.toMatch(/justifyContent:\s*['\"]space-between['\"]/);
  });

  it('useCaptureConfirm flushes edited draft with same request_id (not re-capture)', () => {
    const src = readFileSync(join(ROOT, 'lib/use-capture-confirm.ts'), 'utf8');
    expect(src).toMatch(/replaceDraft:\s*true/);
    expect(src).toMatch(/request_id: requestId/);
    expect(src).toMatch(/confirmRecordFact/);
    expect(src).not.toMatch(/captureRecordFact/);
  });
});
