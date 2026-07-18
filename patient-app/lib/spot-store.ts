import { persistGet, persistSet } from '@/lib/local-persist';
import { patientGet, patientPost, patientUploadForm } from '@/lib/patient-api';
import { uriToUploadFile, appendUploadToForm } from '@/lib/upload-uri';

export type SpotChangeTag = 'same' | 'watch' | 'alert';

export type SpotPhoto = {
  date: string;
  uri?: string;
  thumbnail_url?: string;
  journalEntryId?: string;
  storage_ref?: string;
  change_tag?: SpotChangeTag;
  size_signal?: number | null;
};

export type SpotSnapshot = {
  id?: string;
  date: string;
  thumbnail_url?: string;
  uri?: string;
  change_tag?: SpotChangeTag | null;
  size_signal?: number | null;
};

export type SpotTimeline = {
  spot_id: string;
  label: string;
  body_region: BodyRegion;
  snapshots: SpotSnapshot[];
};

export type BodyRegion = 'head' | 'neck' | 'chest' | 'arm' | 'leg' | 'other';

export type Spot = {
  id: string;
  label: string;
  bodyRegion: BodyRegion;
  createdAt: string;
  photos: SpotPhoto[];
};

const KEY = 'patient_spots_v1';
const PENDING_KEY = 'patient_spots_pending_v1';
const MIGRATED_KEY = 'patient_spots_migrated_v1';

type PendingUpload = {
  spotId: string;
  date: string;
  uri: string;
  journalEntryId?: string;
};

function parseSpotChangeTag(value: unknown): SpotChangeTag | undefined {
  return value === 'same' || value === 'watch' || value === 'alert' ? value : undefined;
}

function parsePhotoAnalysis(p: Record<string, unknown>) {
  const analysis = (p.analysis ?? p.analysis_json) as Record<string, unknown> | undefined;
  const changeTag = analysis?.change_tag;
  const sizeSignal = analysis?.size_signal;
  return {
    change_tag: parseSpotChangeTag(changeTag),
    size_signal: typeof sizeSignal === 'number' ? sizeSignal : null,
  };
}

function mapApiSpot(raw: Record<string, unknown>): Spot {
  const photos = Array.isArray(raw.photos)
    ? (raw.photos as Record<string, unknown>[]).map((p) => {
        const analysis = parsePhotoAnalysis(p);
        const thumb = (p.thumbnail_url as string) || (p.thumb_storage_ref as string) || undefined;
        const uri = (p.uri as string) || thumb || (p.storage_ref as string) || undefined;
        return {
          date: String(p.date ?? p.captured_at ?? '').slice(0, 10),
          uri,
          thumbnail_url: thumb || uri,
          storage_ref: (p.storage_ref as string) || undefined,
          journalEntryId: (p.journal_entry_id as string) || undefined,
          change_tag: analysis.change_tag,
          size_signal: analysis.size_signal,
        };
      })
    : [];
  return {
    id: String(raw.id),
    label: String(raw.label || 'Skin spot'),
    bodyRegion: (raw.bodyRegion ?? raw.body_region ?? 'other') as BodyRegion,
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    photos,
  };
}

async function readLocalSpots(): Promise<Spot[]> {
  try {
    const raw = await persistGet(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Spot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalCache(spots: Spot[]): Promise<void> {
  await persistSet(KEY, JSON.stringify(spots));
}

async function readPending(): Promise<PendingUpload[]> {
  try {
    const raw = await persistGet(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingUpload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePending(items: PendingUpload[]): Promise<void> {
  await persistSet(PENDING_KEY, JSON.stringify(items));
}

async function maybeMigrateLocalToServer(local: Spot[]): Promise<void> {
  const migrated = await persistGet(MIGRATED_KEY);
  if (migrated === '1' || !local.length) return;
  try {
    await patientPost('/api/patient/spots/migrate', { spots: local });
    await persistSet(MIGRATED_KEY, '1');
  } catch {
    // retry on next list
  }
}


async function flushPendingUploads(): Promise<void> {
  const pending = await readPending();
  if (!pending.length) return;
  const remaining: PendingUpload[] = [];
  for (const item of pending) {
    try {
      if (!item.uri) continue;
      const form = new FormData();
      const file = await uriToUploadFile({
        uri: item.uri,
        fileName: `spot-${item.spotId}.jpg`,
      });
      appendUploadToForm({ form, file, fileName: `spot-${item.spotId}.jpg` });
      if (item.journalEntryId) {
        form.append('journal_entry_id', item.journalEntryId);
      }
      await patientUploadForm(`/api/patient/spots/${item.spotId}/snapshots`, form);
    } catch {
      remaining.push(item);
    }
  }
  await writePending(remaining);
}

export async function listSpots(): Promise<Spot[]> {
  const local = await readLocalSpots();
  try {
    await maybeMigrateLocalToServer(local);
    await flushPendingUploads();
    const data = await patientGet('/api/patient/spots');
    const spots = Array.isArray(data?.spots)
      ? (data.spots as Record<string, unknown>[]).map(mapApiSpot)
      : [];
    if (spots.length) {
      await writeLocalCache(spots);
      return spots;
    }
  } catch {
    // offline — use cache
  }
  return local;
}

export async function getSpot(id: string): Promise<Spot | null> {
  try {
    const data = await patientGet(`/api/patient/spots/${id}`);
    if (data?.spot) return mapApiSpot(data.spot as Record<string, unknown>);
  } catch {
    // fallback
  }
  const spots = await readLocalSpots();
  return spots.find((s) => s.id === id) ?? null;
}

export async function fetchSpotTimeline(spotId: string): Promise<SpotTimeline | null> {
  try {
    const data = await patientGet(`/api/patient/spots/${spotId}/timeline`);
    const timeline = data?.timeline as Record<string, unknown> | undefined;
    if (!timeline) return null;
    const snapshots = Array.isArray(timeline.snapshots)
      ? (timeline.snapshots as Record<string, unknown>[]).map((s) => {
          const thumb = (s.thumbnail_url as string) || undefined;
          return {
            id: s.id as string | undefined,
            date: String(s.date ?? s.captured_at ?? '').slice(0, 10),
            thumbnail_url: thumb,
            uri: thumb,
            change_tag: parseSpotChangeTag(s.change_tag) ?? null,
            size_signal: typeof s.size_signal === 'number' ? s.size_signal : null,
          };
        })
      : [];
    return {
      spot_id: String(timeline.spot_id ?? spotId),
      label: String(timeline.label ?? 'Skin spot'),
      body_region: (timeline.body_region ?? 'other') as BodyRegion,
      snapshots,
    };
  } catch {
    return null;
  }
}

export function spotStatusLabel(spot: Spot, snapshots?: SpotSnapshot[]): string {
  const tags = (snapshots ?? spot.photos)
    .map((s) => s.change_tag)
    .filter((t): t is SpotChangeTag => t === 'same' || t === 'watch' || t === 'alert');
  const latest = tags[tags.length - 1];
  if (latest === 'same') return 'size stable';
  if (latest === 'alert') return 'worth watching';
  if (latest === 'watch') return 'still gathering';
  const days = spotDayCount(spot);
  if (days < 7) return 'still gathering';
  if (days >= 14) return 'size stable';
  return 'worth watching';
}

export function growthBarMetrics(snapshots: SpotSnapshot[]): {
  dayOnePct: number;
  todayPct: number;
  dayOneEndLabel: string;
  todayEndLabel: string;
} {
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const signalToPct = (signal: number | null | undefined, fallback: number) => {
    if (signal == null || !Number.isFinite(signal)) return fallback;
    return Math.min(70, Math.max(30, Math.round(50 + signal * 50)));
  };
  const dayOnePct = signalToPct(first?.size_signal, 55);
  const todayPct = signalToPct(last?.size_signal, 52);
  const firstSig = first?.size_signal ?? 0.1;
  const lastSig = last?.size_signal ?? 0.05;
  const delta = lastSig - firstSig;
  let todayEndLabel = 'similar';
  if (delta > 0.03) todayEndLabel = 'larger';
  else if (delta < -0.03) todayEndLabel = 'smaller';
  return { dayOnePct, todayPct, dayOneEndLabel: 'larger', todayEndLabel };
}

export async function createSpot(bodyRegion: BodyRegion, label?: string): Promise<Spot> {
  const regionLabel =
    label ||
    (bodyRegion === 'neck' ? 'Neck spot' : bodyRegion === 'head' ? 'Face spot' : 'Skin spot');
  try {
    const data = await patientPost('/api/patient/spots', {
      label: regionLabel,
      body_region: bodyRegion,
    });
    if (data?.spot) {
      const spot = mapApiSpot(data.spot as Record<string, unknown>);
      const cached = await readLocalSpots();
      cached.unshift(spot);
      await writeLocalCache(cached);
      return spot;
    }
  } catch {
    // offline fallback
  }
  const spot: Spot = {
    id: `spot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: regionLabel,
    bodyRegion,
    createdAt: new Date().toISOString(),
    photos: [],
  };
  const spots = await readLocalSpots();
  spots.unshift(spot);
  await writeLocalCache(spots);
  return spot;
}

export async function addSpotPhoto(spotId: string, photo: SpotPhoto): Promise<Spot | null> {
  if (
    photo.uri &&
    (photo.uri.startsWith('file:') ||
      photo.uri.startsWith('content:') ||
      photo.uri.startsWith('blob:') ||
      photo.uri.startsWith('data:'))
  ) {
    try {
      const form = new FormData();
      const file = await uriToUploadFile({
        uri: photo.uri,
        fileName: `spot-${spotId}.jpg`,
      });
      appendUploadToForm({ form, file, fileName: `spot-${spotId}.jpg` });
      if (photo.journalEntryId) {
        form.append('journal_entry_id', photo.journalEntryId);
      }
      await patientUploadForm(`/api/patient/spots/${spotId}/snapshots`, form);
      return getSpot(spotId);
    } catch {
      const pending = await readPending();
      pending.push({
        spotId,
        date: photo.date,
        uri: photo.uri,
        journalEntryId: photo.journalEntryId,
      });
      await writePending(pending);
    }
  }

  const spots = await readLocalSpots();
  const idx = spots.findIndex((s) => s.id === spotId);
  if (idx < 0) return null;
  spots[idx].photos.push(photo);
  await writeLocalCache(spots);
  return spots[idx];
}

export function spotDayCount(spot: Spot): number {
  if (!spot.photos.length) return 0;
  const first = new Date(spot.createdAt);
  const now = new Date();
  return Math.max(1, Math.ceil((now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
}

export function bodyRegionLabel(region: BodyRegion): string {
  const map: Record<BodyRegion, string> = {
    head: 'Head',
    neck: 'Neck',
    chest: 'Chest',
    arm: 'Arm',
    leg: 'Leg',
    other: 'Other',
  };
  return map[region] || 'Spot';
}
