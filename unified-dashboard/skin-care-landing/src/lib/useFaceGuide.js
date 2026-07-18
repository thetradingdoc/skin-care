import { useEffect, useRef, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const OVAL_W = 220;
const OVAL_H = 280;
const LOCK_FRAMES = 8;
const TARGET_Y_RATIO = 0.42;

let detectorPromise = null;

async function loadDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'VIDEO',
      });
      return detector;
    })();
  }
  return detectorPromise;
}

function videoRect(video) {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const cw = video.clientWidth || 1;
  const ch = video.clientHeight || 1;
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const ox = (cw - dw) / 2;
  const oy = (ch - dh) / 2;
  return { vw, vh, cw, ch, scale, ox, oy };
}

/** Map face bbox to screen coords (mirrored to match scaleX(-1) preview). */
function faceCenterOnScreen(video, detection) {
  const box = detection.boundingBox;
  if (!box) return null;
  const { vw, scale, ox, oy } = videoRect(video);
  const mirrorCenterX = vw - box.originX - box.width / 2;
  const cx = ox + mirrorCenterX * scale;
  const cy = oy + (box.originY + box.height / 2) * scale;
  const w = box.width * scale;
  const h = box.height * scale;
  return { cx, cy, w, h };
}

function alignmentScore(video, detection) {
  const face = faceCenterOnScreen(video, detection);
  if (!face) return 0;
  const { cw, ch } = videoRect(video);
  const targetCx = cw / 2;
  const targetCy = ch * TARGET_Y_RATIO;
  const dx = Math.abs(face.cx - targetCx) / cw;
  const dy = Math.abs(face.cy - targetCy) / ch;
  const sizeOk =
    face.w >= OVAL_W * 0.55 && face.w <= OVAL_W * 1.55 && face.h >= OVAL_H * 0.45 && face.h <= OVAL_H * 1.6;
  const centerOk = dx < 0.18 && dy < 0.14;
  if (centerOk && sizeOk) return 1;
  if (dx < 0.28 && dy < 0.22) return 0.5;
  return 0.2;
}

/**
 * Live face guide for scan UI — fixed center oval, color states only.
 * @returns {{ status: 'loading'|'searching'|'aligning'|'locked', hint: string, canScan: boolean }}
 */
export function useFaceGuide(videoRef, ready) {
  const [state, setState] = useState({
    status: 'loading',
    hint: 'Starting camera…',
    canScan: false,
  });
  const lockCountRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!ready || !videoRef.current) return undefined;

    let cancelled = false;
    let detector = null;
    let lastTs = -1;

    const tick = () => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !detector) return;

      const now = performance.now();
      if (now - lastTs < 80) return;
      lastTs = now;

      try {
        const result = detector.detectForVideo(video, now);
        const faces = result?.detections || [];
        if (!faces.length) {
          lockCountRef.current = 0;
          setState({
            status: 'searching',
            hint: 'Position your face in the oval',
            canScan: false,
          });
          return;
        }

        const best = faces.reduce((a, b) =>
          (b.categories?.[0]?.score || 0) > (a.categories?.[0]?.score || 0) ? b : a
        );
        const score = alignmentScore(video, best);

        if (score >= 1) {
          lockCountRef.current += 1;
        }

        const locked = lockCountRef.current >= LOCK_FRAMES;
        const hasFace = score >= 0.5;

        setState({
          status: locked ? 'locked' : hasFace ? 'aligning' : 'searching',
          hint: locked
            ? 'Hold still — ready to scan'
            : hasFace
              ? 'Center your face in the oval'
              : 'Move closer and center your face',
          canScan: locked,
        });
      } catch {
        /* detection frame skip */
      }
    };

    void (async () => {
      try {
        detector = await loadDetector();
        if (cancelled) return;
        setState({ status: 'searching', hint: 'Position your face in the oval', canScan: false });
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setState({
            status: 'searching',
            hint: 'Center your face in the oval',
            canScan: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      lockCountRef.current = 0;
    };
  }, [ready, videoRef]);

  return state;
}
