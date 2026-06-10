"""OpenCV DNN age + MediaPipe gate/geometry (CPU). Matches teamkelly contract."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

logger = logging.getLogger(__name__)

MODEL_ID = "opencv-dnn-age-gender-v1"
MODEL_VERSION = "2.0.0"

AGE_BUCKETS = (1, 5, 10, 17, 28, 40, 48, 60, 80)

MIN_FACE_RATIO = 0.04
MIN_FACE_CONF = 0.75

MODEL_DIR = Path(os.environ.get("FACE_READ_MODEL_DIR", Path(__file__).resolve().parent.parent / "models"))
FACE_PROTO = MODEL_DIR / "opencv_face_detector.pbtxt"
FACE_WEIGHTS = MODEL_DIR / "opencv_face_detector_uint8.pb"
AGE_PROTO = MODEL_DIR / "age_deploy.prototxt"
AGE_WEIGHTS = MODEL_DIR / "age_net.caffemodel"

# MediaPipe Face Mesh zone landmark subsets (468-point mesh).
ZONE_LANDMARKS: dict[str, list[int]] = {
    "forehead": [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377],
    "t_zone": [10, 338, 297, 332, 284, 1, 4, 5, 6, 168, 197, 195, 217, 126, 142, 36, 205, 425],
    "left_cheek": [234, 227, 137, 177, 215, 138, 135, 169, 170, 140, 171, 175, 116, 123, 147, 187, 207, 205],
    "right_cheek": [454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58],
    "nose": [1, 2, 98, 327, 168, 6, 197, 195, 5, 4, 19, 94, 370, 455, 440, 275],
    "chin": [152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 176, 149, 150, 136, 172, 58, 132],
    "perioral": [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
    "under_eye": [33, 133, 160, 159, 158, 157, 173, 246, 263, 362, 387, 386, 385, 384, 398, 466],
}

_face_net: cv2.dnn_Net | None = None
_age_net: cv2.dnn_Net | None = None
_load_error: str | None = None


def _base_payload(**extra: object) -> dict:
    return {"model_id": MODEL_ID, "model_version": MODEL_VERSION, **extra}


def _require_files() -> None:
    missing = [p.name for p in (FACE_PROTO, FACE_WEIGHTS, AGE_PROTO, AGE_WEIGHTS) if not p.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing model files in {MODEL_DIR}: {', '.join(missing)}")


def load_models() -> None:
    global _face_net, _age_net, _load_error
    try:
        _require_files()
        _face_net = cv2.dnn.readNet(str(FACE_WEIGHTS), str(FACE_PROTO))
        _age_net = cv2.dnn.readNet(str(AGE_WEIGHTS), str(AGE_PROTO))
        _face_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        _face_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        _age_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        _age_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        _load_error = None
        logger.info("face-read models loaded from %s (dnn_backend=cpu)", MODEL_DIR)
    except Exception as exc:  # noqa: BLE001
        _face_net = None
        _age_net = None
        _load_error = str(exc)
        logger.exception("face-read model load failed: %s", exc)


def status() -> dict:
    ready = _face_net is not None and _age_net is not None
    return {
        "ok": ready,
        "age_model_ready": ready,
        "dnn_backend": "cpu",
        "model_id": MODEL_ID,
        "model_version": MODEL_VERSION,
        "error": _load_error,
    }


def _decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("invalid_image")
    return img


def _bbox_norm_to_pixels(img: np.ndarray, bbox: dict) -> tuple[int, int, int, int]:
    h, w = img.shape[:2]
    x1 = int(max(0, bbox["x"] * w))
    y1 = int(max(0, bbox["y"] * h))
    x2 = int(min(w, (bbox["x"] + bbox["w"]) * w))
    y2 = int(min(h, (bbox["y"] + bbox["h"]) * h))
    return x1, y1, x2, y2


def _gate_check(img: np.ndarray) -> dict:
    h, w = img.shape[:2]
    img_area = h * w
    quality_flags: list[str] = []

    with mp.solutions.face_detection.FaceDetection(
        model_selection=1,
        min_detection_confidence=MIN_FACE_CONF,
    ) as detector:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        result = detector.process(rgb)

    if not result.detections:
        return {
            **_base_payload(),
            "quality": "no_face",
            "reject_reason": "not_a_face",
            "quality_flags": ["no_face_detected"],
            "user_message": "We couldn't find a face. Center your face in the oval and try again.",
            "face_bbox": None,
            "face_count": 0,
        }

    if len(result.detections) > 1:
        quality_flags.append("multiple_faces")

    det = max(
        result.detections,
        key=lambda d: max(0.0, d.location_data.relative_bounding_box.width * w)
        * max(0.0, d.location_data.relative_bounding_box.height * h),
    )
    bbox_rel = det.location_data.relative_bounding_box
    face_area = max(0.0, bbox_rel.width * w) * max(0.0, bbox_rel.height * h)
    face_ratio = face_area / img_area if img_area else 0.0

    face_bbox = {
        "x": round(float(bbox_rel.xmin), 4),
        "y": round(float(bbox_rel.ymin), 4),
        "w": round(float(bbox_rel.width), 4),
        "h": round(float(bbox_rel.height), 4),
    }

    if face_ratio < MIN_FACE_RATIO:
        return {
            **_base_payload(),
            "quality": "low",
            "reject_reason": "face_too_small",
            "quality_flags": quality_flags + ["face_too_small"],
            "user_message": "Move closer — we need a clearer view of your face.",
            "face_bbox": None,
            "face_count": len(result.detections),
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean_lum = float(np.mean(gray))
    if mean_lum < 40:
        quality_flags.append("too_dark")
    elif mean_lum > 220:
        quality_flags.append("overexposed")

    return {
        **_base_payload(),
        "quality": "low" if quality_flags else "ok",
        "reject_reason": None,
        "quality_flags": quality_flags,
        "user_message": None,
        "face_count": len(result.detections),
        "face_bbox": face_bbox,
        "face_score": round(float(det.score[0]), 3),
    }


def _zone_polygons_from_mesh(img: np.ndarray) -> dict[str, list[list[float]]]:
    h, w = img.shape[:2]
    zones: dict[str, list[list[float]]] = {}

    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    ) as mesh:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        result = mesh.process(rgb)

    if not result.multi_face_landmarks:
        return zones

    landmarks = result.multi_face_landmarks[0].landmark

    for zone, indices in ZONE_LANDMARKS.items():
        pts: list[list[float]] = []
        seen: set[tuple[float, float]] = set()
        for idx in indices:
            if idx >= len(landmarks):
                continue
            lm = landmarks[idx]
            key = (round(lm.x, 4), round(lm.y, 4))
            if key in seen:
                continue
            seen.add(key)
            pts.append([key[0], key[1]])
        if len(pts) < 3:
            continue
        pts_arr = np.array(pts, dtype=np.float32)
        pixel_pts = (pts_arr * np.array([w, h], dtype=np.float32)).astype(np.int32)
        hull = cv2.convexHull(pixel_pts)
        hull_norm = [[round(float(p[0][0]) / w, 4), round(float(p[0][1]) / h, 4)] for p in hull]
        if hull_norm:
            zones[zone] = hull_norm

    return zones


def _estimate_age_from_face(img: np.ndarray, box: tuple[int, int, int, int]) -> float:
    assert _age_net is not None
    x1, y1, x2, y2 = box
    pad = int(0.15 * max(x2 - x1, y2 - y1))
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(img.shape[1], x2 + pad)
    y2 = min(img.shape[0], y2 + pad)
    face = img[y1:y2, x1:x2]
    if face.size == 0:
        raise ValueError("face_crop_empty")
    blob = cv2.dnn.blobFromImage(
        face, 1.0, (227, 227), (78.4263377603, 87.7689143744, 114.895847746), swapRB=False
    )
    _age_net.setInput(blob)
    preds = _age_net.forward()[0]
    idx = int(np.argmax(preds))
    idx = min(idx, len(AGE_BUCKETS) - 1)
    return float(AGE_BUCKETS[idx])


def analyze_image(data: bytes) -> dict:
    if _face_net is None or _age_net is None:
        raise RuntimeError(_load_error or "models_not_loaded")
    if len(data) < 32:
        raise ValueError("image_too_small")
    if len(data) > 12 * 1024 * 1024:
        raise ValueError("image_too_large")

    img = _decode_image(data)
    h, w = img.shape[:2]
    if min(h, w) < 80:
        return {
            **_base_payload(),
            "apparent_age_estimate": None,
            "quality": "low",
            "quality_flags": ["too_small"],
            "reject_reason": "face_too_small",
            "user_message": "Move closer — we need a clearer view of your face.",
        }

    gate = _gate_check(img)
    if gate.get("reject_reason") in ("not_a_face", "face_too_small"):
        return {
            **gate,
            "apparent_age_estimate": None,
            "zone_polygons": {},
        }

    face_bbox = gate.get("face_bbox")
    if not face_bbox:
        return {
            **_base_payload(),
            "apparent_age_estimate": None,
            "quality": "no_face",
            "reject_reason": "not_a_face",
            "quality_flags": ["no_face_detected"],
            "user_message": "We couldn't find a face. Center your face in the oval and try again.",
            "zone_polygons": {},
        }

    box = _bbox_norm_to_pixels(img, face_bbox)
    age = _estimate_age_from_face(img, box)
    zone_polygons = _zone_polygons_from_mesh(img)

    return {
        **_base_payload(),
        "apparent_age_estimate": round(age, 1),
        "quality": gate.get("quality") or "ok",
        "quality_flags": gate.get("quality_flags") or [],
        "reject_reason": None,
        "user_message": None,
        "face_count": gate.get("face_count", 1),
        "face_bbox": face_bbox,
        "face_score": gate.get("face_score"),
        "zone_polygons": zone_polygons,
    }
