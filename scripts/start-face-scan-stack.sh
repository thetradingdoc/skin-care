#!/usr/bin/env bash
# Start face-read inference locally (replaces legacy teamkelly :8765).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/inference/face-read/scripts/setup-and-run.sh"
