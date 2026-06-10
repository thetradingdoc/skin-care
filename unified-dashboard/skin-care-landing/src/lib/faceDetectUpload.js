import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let detectorPromise = null;

async function loadDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
      });
    })();
  }
  return detectorPromise;
}

/**
 * Client-side face gate for file uploads (P2-U3).
 * Returns { ok: true } or { ok: false, message }.
 */
export async function validateUploadHasFace(file) {
  try {
    const detector = await loadDetector();
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: true };
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const result = detector.detect(canvas);
    const faces = result?.detections || [];
    if (!faces.length) {
      return {
        ok: false,
        message: 'We could not find a face in this photo. Center your face and try again.',
      };
    }
    const best = faces.reduce((a, b) =>
      (b.categories?.[0]?.score || 0) > (a.categories?.[0]?.score || 0) ? b : a
    );
    const score = best.categories?.[0]?.score || 0;
    if (score < 0.5) {
      return {
        ok: false,
        message: 'Face not clear enough. Try a well-lit photo with your face centered.',
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
