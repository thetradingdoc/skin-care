import { patientGet, patientPost, patientPostPublic } from '@/lib/patient-api';
import type {
  BarrierInsight,
  BioProfile,
  EvaluateResult,
  VerdictHistoryDay,
} from '@/lib/conflict-types';

export async function fetchEvaluateLineup(): Promise<EvaluateResult> {
  const data = await patientGet('/api/patient/routine/evaluate');
  return data as EvaluateResult;
}

export async function fetchBioProfile(): Promise<BioProfile> {
  const data = await patientGet('/api/patient/bio-profile');
  return (data?.profile || { conditions: [], prescriptions: [], profile_complete: false }) as BioProfile;
}

export async function saveBioProfile(patch: Partial<BioProfile>): Promise<BioProfile> {
  const data = await patientPost('/api/patient/bio-profile', patch);
  return data?.profile as BioProfile;
}

export async function scanBarcodeToShelf(barcode: string, usageTime = 'pm') {
  return patientPost('/api/patient/shelf/products/scan', { barcode, usage_time: usageTime });
}

export async function addProductManual(body: {
  product_name: string;
  brand?: string;
  usage_time?: string;
  ingredients_text?: string;
}) {
  return patientPost('/api/patient/shelf/products', body);
}

export async function shelfVerdictAction(productId: string, action: 'remove' | 'keep') {
  return patientPost(`/api/patient/shelf/products/${encodeURIComponent(productId)}/verdict-action`, {
    action,
  });
}

export async function fetchVerdictHistory(days = 8): Promise<VerdictHistoryDay[]> {
  const data = await patientGet(`/api/patient/routine/verdict-history?days=${days}`);
  return Array.isArray(data?.days) ? data.days : [];
}

export async function fetchLineupPreview(date: string) {
  return patientGet(`/api/patient/routine/daily/${encodeURIComponent(date)}/lineup-preview`);
}

export async function fetchBarrierInsight(): Promise<BarrierInsight> {
  const data = await patientGet('/api/patient/home/barrier-insight');
  return data?.insight ?? null;
}

export async function fetchStreakPercentile(streakDays: number): Promise<{ copy?: string; percentile?: number }> {
  const data = await patientGet(`/api/patient/home/streak-percentile?streak=${streakDays}`);
  return {
    copy: typeof data?.copy === 'string' ? data.copy : undefined,
    percentile: typeof data?.percentile === 'number' ? data.percentile : undefined,
  };
}

export async function fetchEvaluatePair(productId: string): Promise<EvaluateResult> {
  const data = await patientPost('/api/patient/shelf/evaluate-pair', {
    product_ids: [productId],
  });
  return data as EvaluateResult;
}

export async function publicEvaluateProducts(
  products: Array<{ product_name?: string; barcode?: string; ingredients_text?: string }>,
  bioProfile?: Partial<BioProfile>
) {
  return patientPostPublic('/api/public/routine/evaluate', { products, bio_profile: bioProfile });
}
