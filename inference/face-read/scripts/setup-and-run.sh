#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/download-models.sh"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

export FACE_READ_MODEL_DIR="$ROOT/models"
export FACE_READ_PORT="${FACE_READ_PORT:-8765}"
export TEAMKELLY_UVICORN_HOST="${TEAMKELLY_UVICORN_HOST:-::}"

echo "Starting face-read API on port $FACE_READ_PORT (bind $TEAMKELLY_UVICORN_HOST; Ctrl+C to stop)"
echo "  Health: curl -s http://127.0.0.1:$FACE_READ_PORT/health"
exec python -m app.main
