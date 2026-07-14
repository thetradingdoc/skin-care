#!/usr/bin/env bash
# Patches expo-constants iOS script so paths with spaces still embed app.config.
# Safe to run repeatedly (idempotent). Invoked from npm postinstall.
set -euo pipefail
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/node_modules/expo-constants/scripts/get-app-config-ios.sh"
if [[ ! -f "$SCRIPT" ]]; then
  echo "[ensure-exconstants] skip — missing $SCRIPT"
  exit 0
fi
if grep -q 'basename "\$PROJECT_DIR"' "$SCRIPT"; then
  echo "[ensure-exconstants] already patched"
  exit 0
fi
python3 - "$SCRIPT" <<'INNER'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
old = 'PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)'
new = 'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")'
if old not in text:
    if 'basename "$PROJECT_DIR"' in text:
        print('[ensure-exconstants] already quoted')
        raise SystemExit(0)
    raise SystemExit(f'[ensure-exconstants] pattern not found in {path}')
path.write_text(text.replace(old, new, 1))
print('[ensure-exconstants] patched basename quoting')
INNER
