#!/usr/bin/env bash
set -euo pipefail

# Audit Cloud Run email config for patient OTP (no deploy, no secrets printed).
#
# Usage: bash scripts/audit-cloudrun-email-config.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/cloudrun-deploy-env.sh
source "$ROOT/scripts/lib/cloudrun-deploy-env.sh"

PROJECT="${GCP_PROJECT:-$CLOUDRUN_GCP_PROJECT}"
REGION="${GCP_REGION:-$CLOUDRUN_REGION}"
SERVICE="${CLOUDRUN_SERVICE:-somo-middleware}"

echo "==> Cloud Run email audit: $SERVICE ($PROJECT / $REGION)"
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
        return f"secret:{ref.get('name','?')}"
    return "(missing)"

names = {e.get("name"): val(e) for e in env}
checks = [
    "EMAIL_PROVIDER",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_FROM",
    "SMTP_PASSWORD",
    "AZURE_COMMUNICATION_CONNECTION_STRING",
    "AZURE_EMAIL_SENDER",
]
for k in checks:
    if k in names:
        print(f"  {k} = {names[k]}")

print("")
smtp_ok = names.get("SMTP_HOST") and names.get("SMTP_HOST") != "(empty)"
smtp_ok = smtp_ok and names.get("SMTP_USER") and names.get("SMTP_USER") != "(empty)"
smtp_ok = smtp_ok and "SMTP_PASSWORD" in names
azure = "AZURE_COMMUNICATION_CONNECTION_STRING" in names

if smtp_ok:
    print("✅ SMTP looks configured — patient OTP should send after middleware code deploy.")
elif azure:
    print("⚠️  Legacy Azure env present; SMTP missing. GCP stack should use SMTP (Gmail/SendGrid).")
    print("   Run: bash scripts/configure-cloudrun-patient-email.sh")
else:
    print("❌ No outbound email configured. Patient OTP will return 503.")
    print("   Add SMTP_* to middleware-platform/.env, then:")
    print("   bash scripts/configure-cloudrun-patient-email.sh")
PY

echo ""
echo "Local .env (middleware-platform/.env):"
ENV_FILE="$ROOT/middleware-platform/.env"
if [[ -f "$ENV_FILE" ]]; then
  grep -E '^(EMAIL_PROVIDER|SMTP_|AZURE_)' "$ENV_FILE" 2>/dev/null | sed -E 's/(PASSWORD|CONNECTION_STRING)=.*/\1=***/' || echo "  (no SMTP/AZURE keys)"
else
  echo "  missing — copy from middleware-platform/.env.example"
fi
