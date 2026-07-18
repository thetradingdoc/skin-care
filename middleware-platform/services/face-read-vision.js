'use strict';

const MODEL_ID = 'gpt-4o-vision-v1';
const MODEL_VERSION = '2.2.0';

/** ISO BMFF HEIC/HEIF family — OpenAI vision does not accept these. */
function isHeifFamilyBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (buffer.slice(4, 8).toString('ascii') !== 'ftyp') return false;
  return /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|avic)/i.test(
    buffer.slice(8, 12).toString('ascii'),
  );
}

/** Face-named zones (optional). Empty for non-face body photos — free-text observed_region instead. */
const VALID_ZONES = [
  'forehead',
  't_zone',
  'left_cheek',
  'right_cheek',
  'nose',
  'chin',
  'perioral',
  'under_eye',
  'temples',
  'neck',
];

const ZONE_LABELS = Object.freeze({
  forehead: 'forehead',
  t_zone: 'T-zone',
  left_cheek: 'left cheek',
  right_cheek: 'right cheek',
  nose: 'nose',
  chin: 'chin',
  perioral: 'around the mouth',
  under_eye: 'under-eye',
  temples: 'temples',
  neck: 'neck',
});

/**
 * Category ban: never narrate the model's own quality/confidence/limitations,
 * or tell the user they could have gotten a better read (lighting, angle, retake,
 * tone, resolution, crop). Same discipline as diagnosis vocab — category, not a
 * one-off phrase list.
 */
const SELF_REFERENTIAL_COMMENTARY_PATTERNS = Object.freeze([
  // Tone / race as analysis limitation
  /\bdark skin tones?\b.*\b(less visible|harder|difficult|limit|obscur)/i,
  /\b(less visible|harder|difficult)\b.*\bdark skin tones?\b/i,
  /\b(deep|dark) (skin )?tones?\b.*\b(make|can|may)\b.*\b(features|details|analysis)\b/i,
  /\bfeatures (are|may be|can be) less visible\b/i,
  /\bdue to (your |the )?(dark|deep|light|medium) (skin )?tone\b/i,
  /\bfitzpatrick\b.*\b(limit|harder|difficult|less visible|less accurate)\b/i,
  /\bskin tone\b.*\b(limitation|less accurate|harder to (see|read|detect)|obscur)/i,
  /\bmelanin\b.*\b(obscur|limit|harder|difficult)\b/i,
  /\b(people of color|poc|racial)\b.*\b(harder|difficult|less visible)\b/i,
  /\bestimate may vary\b.*\b(skin tone|tone|light)/i,
  // Lighting / retake / angle / resolution meta
  /\bretake\b/i,
  /\bbetter (light|lighting|photo|angle|resolution|focus)\b/i,
  /\b(in|with) (better|good|more) light(ing)?\b/i,
  /\bharder to (read|see|detect|assess)\b/i,
  /\b(lighting|light) (made it|makes it|can make it) harder\b/i,
  /\bpoor (light|lighting|resolution|angle|framing)\b.*\b(result|accurate|precise|clear|accurac)/i,
  /\b(poor|low) resolution\b.*\b(accurac|precise|clear|result)/i,
  /\bresolution\b.*\b(reduce|reduces|limit|limits|affect|affects)\b.*\baccurac/i,
  /\bfor (best|better|more accurate|clearer) results?\b/i,
  /\b(try|please) (again|a (new|clearer) (photo|shot)|retaking)\b/i,
  /\b(angle|crop|framing|resolution|focus) (is|was|may be) (poor|bad|low|suboptimal)\b/i,
  /\b(could|would) (be|have been) (clearer|better|more accurate)\b.*\b(light|angle|photo|retake)/i,
  // Model self-meta
  /\bas (an? )?(ai|model|vision system)\b.*\b(cannot|can't|struggle|unable)\b/i,
  /\bi (cannot|can't|may not) (accurately |fully )?(assess|see|detect|analyze)\b/i,
  /\bmy (analysis|accuracy|confidence) (is|may be) (limited|reduced)\b/i,
  /\b(limited|low) (confidence|accuracy|certainty)\b.*\b(because|due to)\b/i,
  /\bmention this in scan_summary\b/i,
]);

/** @deprecated alias — prefer containsSelfReferentialCommentary */
const TONE_LIMITATION_DISCLAIMER_PATTERNS = SELF_REFERENTIAL_COMMENTARY_PATTERNS;

function containsSelfReferentialCommentary(text) {
  const s = String(text || '');
  if (!s.trim()) return false;
  return SELF_REFERENTIAL_COMMENTARY_PATTERNS.some((re) => re.test(s));
}

function containsToneLimitationDisclaimer(text) {
  return containsSelfReferentialCommentary(text);
}

/** Drop sentences that narrate analysis limits or retake coaching. */
function sanitizeVisionProse(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (!containsSelfReferentialCommentary(raw)) return raw;
  const parts = raw.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((p) => p.trim() && !containsSelfReferentialCommentary(p));
  return kept.join(' ').trim();
}

/** Face-only reject codes from older prompts — neutralize; body skin is valid. */
const FACE_ONLY_REJECT_REASONS = Object.freeze(['not_a_face', 'wrong_subject']);

/** Legitimate hard rejects after perceive (blur / darkness / not skin at all). */
const HARD_VISION_REJECT_REASONS = Object.freeze(['too_blurry', 'too_dark', 'not_skin']);

const VISION_SYSTEM_PROMPT = `You are a skincare wellness AI analyzing a photo of skin.
You are NOT a doctor. This is a wellness estimate only — not medical diagnosis.

The photo may be a face OR any other body region (leg, arm, shoulder, neck, torso, scalp, etc.).
Do NOT require a face. Clear in-focus skin of any region is valid.

Analyze the image and return ONLY a valid JSON object. No markdown, no explanation.

JSON schema (all fields required):
{
  "apparent_age_estimate": <integer 10-80 or null if not a face>,
  "quality": "ok" | "low",
  "reject_reason": null | "too_blurry" | "too_dark" | "not_skin",
  "observed_region": "<short free-text region, e.g. lower leg, left shoulder, neck, T-zone — or null>",
  "fit_skin_tone": "light" | "medium" | "tan" | "dark" | "deep",
  "fitzpatrick_estimate": "I-II" | "III" | "IV" | "V" | "VI",
  "concern_scores": {
    "acne": <0-3>,
    "hyperpigmentation": <0-3>,
    "redness": <0-3>,
    "dryness": <0-3>,
    "texture": <0-3>,
    "pores": <0-3>,
    "dark_circles": <0-3>,
    "oiliness": <0-3>
  },
  "findings": [
    {
      "id": "<snake_case unique id>",
      "label": "<2-4 word label>",
      "plain_language": "<one sentence, plain English, no medical jargon>",
      "severity": <1-3>,
      "zones": [<face zone names only when a face is clearly present; else []>],
      "confidence": <0.0-1.0>
    }
  ],
  "health_scores": {
    "hydration": <0-100>,
    "clarity": <0-100>,
    "evenness": <0-100>,
    "barrier": <0-100>
  },
  "scan_summary": "<2 sentences max — describe what you observe only>",
  "positive_observations": ["<thing skin is doing well>"],
  "not_diagnosis": true
}

RULES:
- health_scores: higher = healthier (100 = excellent). Never return all 100 when findings exist.
- findings: minimum 1, maximum 5 when quality is ok; confidence >= 0.5 (>= 0.4 for Fitzpatrick V-VI / dark/deep tones)
- reject_reason=too_blurry only if the photo is unusable from blur; too_dark only if unusable from darkness; not_skin only if this is clearly not skin (document, product bottle, landscape, empty wall).
- NEVER reject a clear photo of a leg, arm, shoulder, neck, torso, scalp, hand, or other body skin as "not a face" or wrong subject.
- severity: 1=mild, 2=moderate, 3=significant
- zones: use ONLY when a face is present, from: ${VALID_ZONES.join(', ')}. For non-face body photos, zones MUST be [] and observed_region MUST be set (free text).
- Never use: lesion, pathology, disease, medical, diagnosis, condition
- Use: bumps, dryness, uneven tone, dark marks, oiliness, pores, redness, rough texture

EQUITY (internal calibration only — never narrate to the user):
- For Fitzpatrick V-VI (dark/deep tones), use confidence floor 0.4. Still report what you observe.
- Never return an empty findings array when skin is clearly visible.
- Describe appearance neutrally: tone evenness, texture, redness, dryness, oiliness, marks.
- NEVER comment on skin tone, race, or Fitzpatrick as a limitation on analysis.
- NEVER generate self-referential commentary: do not mention your confidence, accuracy, what you cannot see, lighting limits, retakes, better angles, resolution, or that the user could get a better read another way.
- fit_skin_tone and fitzpatrick_estimate are structured fields only — do not echo them into prose.
- If lighting is imperfect but skin is still readable: set quality="low" and still describe what you see — do NOT coach a retake in plain_language or scan_summary.`;

const HEALTH_SCORE_KEYS = ['hydration', 'clarity', 'evenness', 'barrier'];

function clampHealthScore(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeHealthScores(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of HEALTH_SCORE_KEYS) {
    out[key] = clampHealthScore(src[key]);
  }
  return out;
}

function parseVisionJson(text) {
  let raw = String(text || '').trim();
  raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function humanizeZone(zone) {
  return ZONE_LABELS[zone] || String(zone || '').replace(/_/g, ' ');
}

/** Suggest body_area from face zones and/or free-text observed_region — never invent a face area. */
function bodyAreaFromVisionFindings(vision) {
  const findings = Array.isArray(vision?.findings) ? vision.findings : [];
  const seen = [];
  for (const f of findings) {
    for (const z of Array.isArray(f.zones) ? f.zones : []) {
      if (!VALID_ZONES.includes(z) || seen.includes(z)) continue;
      seen.push(z);
    }
  }
  if (seen.length) return seen.map(humanizeZone).join(', ');
  const region = String(vision?.observed_region || '').trim();
  if (region) return region.slice(0, 120);
  return null;
}

function normalizeVisionPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const scores =
    parsed.concern_scores && typeof parsed.concern_scores === 'object' ? parsed.concern_scores : {};
  const tone = String(parsed.fit_skin_tone || '').toLowerCase();
  let fit_skin_tone = 'light';
  if (tone === 'dark' || tone === 'deep') fit_skin_tone = 'dark';
  else if (tone === 'medium' || tone === 'tan') fit_skin_tone = 'medium';

  let quality = String(parsed.quality || 'ok');
  let reject_reason = parsed.reject_reason || null;
  // Neutralize legacy face-only rejects — body skin is valid.
  if (
    FACE_ONLY_REJECT_REASONS.includes(String(reject_reason)) ||
    quality === 'no_face' ||
    quality === 'wrong_subject'
  ) {
    reject_reason = null;
    if (quality === 'no_face' || quality === 'wrong_subject' || quality === 'reject') {
      quality = 'ok';
    }
  }
  if (reject_reason && !HARD_VISION_REJECT_REASONS.includes(String(reject_reason))) {
    reject_reason = null;
  }

  const confFloor = fit_skin_tone === 'dark' ? 0.4 : 0.5;
  let filteredFindings = (Array.isArray(parsed.findings) ? parsed.findings : [])
    .map((f) => {
      const plain = sanitizeVisionProse(f.plain_language || '');
      const label = sanitizeVisionProse(f.label || '') || String(f.label || '').slice(0, 40);
      return {
        ...f,
        id: f.id,
        label,
        // Never restore banned prose — empty after sanitize stays empty.
        plain_language: plain,
        confidence: f.confidence ?? 1.0,
        zones: (Array.isArray(f.zones) ? f.zones : []).filter((z) => VALID_ZONES.includes(z)),
      };
    })
    .filter((f) => String(f.id || '') !== 'poor_lighting')
    .filter((f) => f.confidence >= confFloor)
    .filter((f) => Boolean(String(f.plain_language || '').trim() || String(f.label || '').trim()))
    .slice(0, 5);

  // If model returned empty findings after clearing face reject, keep a neutral stub so compose can proceed
  if (!filteredFindings.length && !reject_reason) {
    filteredFindings = [
      {
        id: 'skin_visible',
        label: 'Skin visible',
        plain_language: 'Skin is visible in this photo.',
        severity: 1,
        zones: [],
        confidence: 0.6,
      },
    ];
  }

  let scan_summary = sanitizeVisionProse(parsed.scan_summary || '');
  if (!scan_summary && filteredFindings[0]) {
    scan_summary = sanitizeVisionProse(
      filteredFindings[0].plain_language || filteredFindings[0].label || '',
    );
  }

  const positive_observations = (Array.isArray(parsed.positive_observations)
    ? parsed.positive_observations
    : []
  )
    .map((p) => sanitizeVisionProse(p))
    .filter(Boolean);

  const observed_region = (() => {
    const r = String(parsed.observed_region || '').trim();
    if (!r || containsSelfReferentialCommentary(r)) return null;
    return r.slice(0, 120);
  })();

  const apparent = Number(parsed.apparent_age_estimate);
  const hasAge = Number.isFinite(apparent);

  return {
    apparent_age_estimate: hasAge ? apparent : undefined,
    quality,
    reject_reason,
    observed_region,
    user_message: null,
    fit_skin_tone,
    fitzpatrick_estimate: parsed.fitzpatrick_estimate || null,
    concern_scores: scores,
    health_scores: normalizeHealthScores(parsed.health_scores),
    findings: filteredFindings,
    scan_summary,
    positive_observations,
    not_diagnosis: true,
    model_id: MODEL_ID,
    model_version: MODEL_VERSION,
  };
}

/**
 * GPT-4o Vision — findings for face OR body-region skin.
 * Set FACE_READ_VISION_ENABLED=1 and OPENAI_API_KEY.
 */
async function analyzeWithVision(imageBuffer, mime = 'image/jpeg', _faceBbox = null) {
  if (process.env.FACE_READ_VISION_ENABLED !== '1') return null;
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  const resolvedMime = String(mime || 'image/jpeg').toLowerCase();
  if (
    resolvedMime.includes('heic') ||
    resolvedMime.includes('heif') ||
    isHeifFamilyBuffer(imageBuffer)
  ) {
    const err = new Error('HEIC_UNSUPPORTED');
    err.code = 'HEIC_UNSUPPORTED';
    throw err;
  }

  const b64 = Buffer.from(imageBuffer).toString('base64');
  const dataUrl = `data:${resolvedMime || 'image/jpeg'};base64,${b64}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.FACE_READ_VISION_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
            {
              type: 'text',
              text: 'Analyze this skin photo (face or any body region). Return only the JSON.',
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `vision_http_${res.status}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  const parsed = parseVisionJson(text);
  if (!parsed) {
    console.error('[vision] JSON parse failed. Raw:', text?.slice(0, 300));
    return null;
  }
  const normalized = normalizeVisionPayload(parsed);
  const usage = data?.usage || null;
  if (usage && normalized) {
    normalized._usage = {
      model: process.env.FACE_READ_VISION_MODEL || 'gpt-4o',
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
    };
  }
  return normalized;
}

module.exports = {
  analyzeWithVision,
  normalizeVisionPayload,
  normalizeHealthScores,
  clampHealthScore,
  isHeifFamilyBuffer,
  containsSelfReferentialCommentary,
  containsToneLimitationDisclaimer,
  sanitizeVisionProse,
  bodyAreaFromVisionFindings,
  humanizeZone,
  HEALTH_SCORE_KEYS,
  MODEL_ID,
  MODEL_VERSION,
  VALID_ZONES,
  ZONE_LABELS,
  SELF_REFERENTIAL_COMMENTARY_PATTERNS,
  TONE_LIMITATION_DISCLAIMER_PATTERNS,
  FACE_ONLY_REJECT_REASONS,
  HARD_VISION_REJECT_REASONS,
  VISION_SYSTEM_PROMPT,
};
