#!/usr/bin/env bash
set -euo pipefail

# Audit Cloud Run face-read + vision config (no deploy, secrets redacted).
#
# Usage: bash scripts/audit-cloudrun-face-read-config.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/cloudrun-deploy-env.sh
source "$ROOT/scripts/lib/cloudrun-deploy-env.sh"

PROJECT="${GCP_PROJECT:-$CLOUDRUN_GCP_PROJECT}"
REGION="${GCP_REGION:-$CLOUDRUN_REGION}"
SERVICE="${CLOUDRUN_SERVICE:-somo-middleware}"

echo "==> Cloud Run face-read audit: $SERVICE ($PROJECT / $REGION)"
echo ""

JSON=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format=json)

python3 - <<'PY' "$JSON"
import json, sys

d = json.loads(sys.argv[1])
env = d.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [{}])[0].get("env", [])

def val(e):
    if "value" in e:
        v = e["value"]
        n = e.get("name", "")
        if any(x in n for x in ("PASSWORD", "CONNECTION", "SECRET", "KEY", "TOKEN")):
            return "(set, redacted)" if v else "(empty)"
        return v or "(empty)"
    if "valueFrom" in e:
        ref = e["valueFrom"].get("secretKeyRef", {})
        return f"secret:{ref.get('name', '?')}"
    return "(missing)"

names = {e.get("name"): val(e) for e in env}
checks = [
    "FACE_READ_INFERENCE_BASE_URL",
    "FACE_READ_VISION_ENABLED",
    "OPENAI_API_KEY",
    "FACE_READ_VISION_MODEL",
]
for k in checks:
    if k in names:
        print(f"  {k} = {names[k]}")

print("")
infer = names.get("FACE_READ_INFERENCE_BASE_URL", "(missing)")
vision = names.get("FACE_READ_VISION_ENABLED", "(missing)")
openai = names.get("OPENAI_API_KEY", "(missing)")

if infer and infer not in ("(missing)", "(empty)"):
    print("OK Inference URL configured — OpenCV gate + zone geometry available.")
else:
    print("FAIL FACE_READ_INFERENCE_BASE_URL missing — face-read will 503.")
    print("   Run: bash scripts/configure-face-read-inference.sh")

if vision == "1" and openai not in ("(missing)", "(empty)"):
    print("OK Vision enabled with OpenAI key — GPT findings stage active.")
elif vision == "1":
    print("WARN FACE_READ_VISION_ENABLED=1 but OPENAI_API_KEY missing — findings will be empty.")
else:
    print("WARN Vision disabled — Reveal will show age only (no findings).")
    print("   Set FACE_READ_VISION_ENABLED=1 and OPENAI_API_KEY on Cloud Run.")
PY

echo ""
echo "Live API smoke (optional):"
echo "  API_BASE_URL=https://api.callsomo.com node patient-app/scripts/smoke-face-read.cjs"
echo "  npm run smoke:face-read-reveal"
