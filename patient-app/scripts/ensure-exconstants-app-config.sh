#!/usr/bin/env bash
# Patches expo-constants iOS so paths with spaces still embed app.config.
# Safe to run repeatedly (idempotent). Invoked from npm postinstall.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/node_modules/expo-constants/scripts/get-app-config-ios.sh"
PODSPEC="$ROOT/node_modules/expo-constants/ios/EXConstants.podspec"

if [[ -f "$SCRIPT" ]]; then
  if grep -q 'basename "\$PROJECT_DIR"' "$SCRIPT"; then
    echo "[ensure-exconstants] get-app-config-ios.sh already quoted"
  else
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
  fi
else
  echo "[ensure-exconstants] skip — missing $SCRIPT"
fi

# bash -l -c "$PATH/with spaces/script.sh" treats the path as a command string and
# breaks on the first space (bash: …/Voice: is a directory). Quote inside -c.
if [[ -f "$PODSPEC" ]]; then
  python3 - "$PODSPEC" <<'INNER'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
broken = ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",'
fixed = ':script => "bash -l -c \\"#{env_vars}\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"\\"",'
if '\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"' in text:
    print('[ensure-exconstants] EXConstants.podspec script already quoted')
elif broken in text:
    path.write_text(text.replace(broken, fixed, 1))
    print('[ensure-exconstants] patched EXConstants.podspec script quoting')
else:
    # Already has comment + quoting from a prior manual edit, or upstream changed.
    if 'get-app-config-ios.sh' in text and '\\"$PODS_TARGET_SRCROOT' in text:
        print('[ensure-exconstants] EXConstants.podspec looks quoted')
    else:
        raise SystemExit(f'[ensure-exconstants] podspec pattern not found in {path}')
INNER
else
  echo "[ensure-exconstants] skip — missing $PODSPEC"
fi
