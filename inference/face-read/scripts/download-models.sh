#!/usr/bin/env bash
# Download OpenCV DNN age/gender model weights (learnopencv AgeGender).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_DIR="${FACE_READ_MODEL_DIR:-$ROOT/models}"
BASE="https://raw.githubusercontent.com/spmallick/learnopencv/master/AgeGender"
AGE_MODEL_URL="https://github.com/GilLevi/AgeGenderDeepLearning/raw/master/models/age_net.caffemodel"

mkdir -p "$MODEL_DIR"

fetch() {
  local name="$1"
  local url="${2:-$BASE/$name}"
  if [[ -f "$MODEL_DIR/$name" && -s "$MODEL_DIR/$name" ]]; then
    echo "  ok $name"
    return
  fi
  echo "  get $name"
  curl -fsSL "$url" -o "$MODEL_DIR/$name"
}

echo "==> Models -> $MODEL_DIR"
fetch opencv_face_detector.pbtxt
fetch opencv_face_detector_uint8.pb
fetch age_deploy.prototxt
fetch age_net.caffemodel "$AGE_MODEL_URL"
echo "Done."
