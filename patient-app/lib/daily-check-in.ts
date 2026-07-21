export const CHECK_IN_API = '/api/patient/records/check-in';

export function feelingSlugFromLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '_');
}

type PostFn = (path: string, body: unknown) => Promise<unknown>;

export async function submitDailyCheckIn(feeling: string, post?: PostFn) {
  const doPost =
    post ||
    (await import('@/lib/patient-api')).patientPost;
  return doPost(CHECK_IN_API, {
    feeling,
    source: 'daily_checkin',
  });
}

export type CheckInSaveResult = { ok: true } | { ok: false; error: string };

/**
 * Fail-closed save: never treat network/API failure as success.
 */
export async function performCheckInSave(deps: {
  feeling: string;
  submit?: (feeling: string) => Promise<unknown>;
}): Promise<CheckInSaveResult> {
  try {
    const submit = deps.submit || submitDailyCheckIn;
    await submit(deps.feeling);
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not save',
    };
  }
}
