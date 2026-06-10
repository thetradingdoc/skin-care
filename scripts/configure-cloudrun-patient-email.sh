#!/usr/bin/env bash
set -euo pipefail

# Configure GCP Cloud Run patient OTP email via SMTP (Gmail / SendGrid).
# Removes legacy Azure Communication Services env vars from the service.
#
# Prereq: middleware-platform/.env with:
#   EMAIL_PROVIDER=smtp
#   SMTP_HOST=smtp.gmail.com
#   SMTP_PORT=587
#   SMTP_USER=richard@callsomo.com
#   SMTP_PASSWORD=<gmail-app-password>
#   SMTP_FROM=richard@callsomo.com
#   (bare address OK — middleware wraps as "Skin & Care <richard@callsomo.com>")
#
# Usage:
#   bash scripts/configure-cloudrun-patient-email.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/middleware-platform/.env"
# shellcheck source=scripts/lib/cloudrun-deploy-env.sh
source "$ROOT/scripts/lib/cloudrun-deploy-env.sh"

PROJECT="${GCP_PROJECT:-$CLOUDRUN_GCP_PROJECT}"
REGION="${GCP_REGION:-$CLOUDRUN_REGION}"
SERVICE="${CLOUDRUN_SERVICE:-somo-middleware}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE"
  echo "See middleware-platform/.env.example (Transactional email — GCP SMTP)"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source <(grep -E '^(EMAIL_PROVIDER|SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_PASSWORD|SMTP_FROM)=' "$ENV_FILE" | sed 's/\r$//')
set +a

EMAIL_PROVIDER="${EMAIL_PROVIDER:-smtp}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USER="${SMTP_USER:-}"
SMTP_FROM="${SMTP_FROM:-$SMTP_USER}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"

if [[ -z "$SMTP_HOST" || -z "$SMTP_USER" || -z "$SMTP_PASSWORD" ]]; then
  echo "ERROR: Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in $ENV_FILE"
  echo "Gmail: https://myaccount.google.com/apppasswords"
  exit 1
fi

echo "==> Configuring SMTP on Cloud Run: $SERVICE ($PROJECT / $REGION)"
echo "    SMTP_FROM=$SMTP_FROM"

gcloud run services update "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --update-env-vars "EMAIL_PROVIDER=${EMAIL_PROVIDER},SMTP_HOST=${SMTP_HOST},SMTP_PORT=${SMTP_PORT},SMTP_USER=${SMTP_USER},SMTP_FROM=${SMTP_FROM}" \
  --remove-env-vars "AZURE_COMMUNICATION_CONNECTION_STRING,AZURE_EMAIL_SENDER" \
  --quiet

SECRET_NAME="${SMTP_PASSWORD_SECRET_NAME:-somo-smtp-password}"
if ! gcloud secrets describe "$SECRET_NAME" --project "$PROJECT" >/dev/null 2>&1; then
  echo "==> Creating secret $SECRET_NAME"
  printf '%s' "$SMTP_PASSWORD" | gcloud secrets create "$SECRET_NAME" \
    --project "$PROJECT" --data-file=-
else
  printf '%s' "$SMTP_PASSWORD" | gcloud secrets versions add "$SECRET_NAME" \
    --project "$PROJECT" --data-file=-
fi

gcloud run services update "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --update-secrets "SMTP_PASSWORD=${SECRET_NAME}:latest" \
  --quiet

echo "==> Removed legacy Azure email env vars from Cloud Run."
echo "==> Verify:"
echo "    bash scripts/audit-cloudrun-email-config.sh"
echo "    EMAIL=drlittlekids@gmail.com npm run verify:patient-otp-email"
