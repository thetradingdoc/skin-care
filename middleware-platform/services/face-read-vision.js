'use strict';

const MODEL_ID = 'gpt-4o-vision-v1';
const MODEL_VERSION = '2.0.0';

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

const VISION_SYSTEM_PROMPT = `You are a skincare wellness AI analyzing a face photo.
You are NOT a doctor. This is a wellness estimate only — not medical diagnosis.

Analyze the face image and return ONLY a valid JSON object. No markdown, no explanation.

JSON schema (all fields required):
{
  "apparent_age_estimate": <integer 10-80>,
  "quality": "ok" | "low" | "no_face" | "wrong_subject",
  "reject_reason": null | "not_a_face" | "wrong_subject" | "too_blurry" | "too_dark",
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
      "zones": [<zone names>],
      "confidence": <0.0-1.0>
    }
  ],
  "health_scores": {
    "hydration": <0-100>,
    "clarity": <0-100>,
    "evenness": <0-100>,
    "barrier": <0-100>
  },
  "scan_summary": "<2 sentences max>",
  "positive_observations": ["<thing skin is doing well>"],
  "not_diagnosis": true
}

RULES:
- health_scores: higher = healthier (100 = excellent). hydration/barrier inversely track dryness/redness; clarity tracks acne/pores/oiliness; evenness tracks hyperpigmentation/texture. Never return all 100 when findings exist.
- findings: minimum 1, maximum 5 when quality is ok; confidence >= 0.5 (>= 0.4 for Fitzpatrick V-VI / dark/deep skin tones)
- If no face: quality="wrong_subject", reject_reason="not_a_face", findings=[]
- If clearly not a face (arm, hand, torso): reject_reason="wrong_subject"
- severity: 1=mild, 2=moderate, 3=significant
- zones must be from: ${VALID_ZONES.join(', ')}
- Never use: lesion, pathology, disease, medical, diagnosis, condition
- Use: bumps, dryness, uneven tone, dark marks, oiliness, pores

DARK SKIN AND LOW LIGHT RULES:
- For Fitzpatrick V-VI (dark/deep skin tones), lower your confidence threshold to 0.4.
  Features are less visible in lower contrast — still report what you observe.
- Never return an empty findings array for a photo where a face is clearly visible.
- If lighting is poor but face is detected, always emit this finding:
  { "id": "poor_lighting", "label": "Low light conditions",
    "plain_language": "The photo lighting made it harder to read your skin details accurately. A retake in better light will give more precise results.",
    "severity": 1, "zones": [], "confidence": 0.95 }
- If you detect the scan is a dark skin tone (Fitzpatrick V-VI), mention this in scan_summary.`;

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

function normalizeVisionPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const scores =
    parsed.concern_scores && typeof parsed.concern_scores === 'object' ? parsed.concern_scores : {};
  const tone = String(parsed.fit_skin_tone || '').toLowerCase();
  let fit_skin_tone = 'light';
  if (tone === 'dark' || tone === 'deep') fit_skin_tone = 'dark';
  else if (tone === 'medium' || tone === 'tan') fit_skin_tone = 'medium';

  const confFloor = fit_skin_tone === 'dark' ? 0.4 : 0.5;
  const filteredFindings = (Array.isArray(parsed.findings) ? parsed.findings : [])
    .map((f) => ({
      ...f,
      confidence: f.confidence ?? 1.0,
      zones: (Array.isArray(f.zones) ? f.zones : []).filter((z) => VALID_ZONES.includes(z)),
    }))
    .filter((f) => f.confidence >= confFloor)
    .slice(0, 5);

  const apparent = Number(parsed.apparent_age_estimate);
  const hasAge = Number.isFinite(apparent);

  return {
    apparent_age_estimate: hasAge ? apparent : undefined,
    quality: String(parsed.quality || 'ok'),
    reject_reason: parsed.reject_reason || null,
    user_message:
      parsed.reject_reason === 'wrong_subject'
        ? 'This looks like a body part — we need your face for this scan.'
        : parsed.user_message || null,
    fit_skin_tone,
    fitzpatrick_estimate: parsed.fitzpatrick_estimate || null,
    concern_scores: scores,
    health_scores: normalizeHealthScores(parsed.health_scores),
    findings: filteredFindings,
    scan_summary: String(parsed.scan_summary || ''),
    positive_observations: Array.isArray(parsed.positive_observations)
      ? parsed.positive_observations
      : [],
    not_diagnosis: true,
    model_id: MODEL_ID,
    model_version: MODEL_VERSION,
  };
}

/**
 * GPT-4o Vision — findings + concern scores.
 * Set FACE_READ_VISION_ENABLED=1 and OPENAI_API_KEY.
 */
async function analyzeWithVision(imageBuffer, mime = 'image/jpeg', _faceBbox = null) {
  if (process.env.FACE_READ_VISION_ENABLED !== '1') return null;
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  const b64 = Buffer.from(imageBuffer).toString('base64');
  const dataUrl = `data:${mime || 'image/jpeg'};base64,${b64}`;

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
              text: 'Analyze this face for skincare wellness. Return only the JSON.',
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
  return normalizeVisionPayload(parsed);
}

module.exports = {
  analyzeWithVision,
  normalizeVisionPayload,
  normalizeHealthScores,
  clampHealthScore,
  HEALTH_SCORE_KEYS,
  MODEL_ID,
  MODEL_VERSION,
  VALID_ZONES,
};
