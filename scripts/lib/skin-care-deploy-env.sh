# Skin & Care consumer stack — doctorjay254@gmail.com GCP (source before use).
# Override via env when project ID differs from default.

export SKIN_CARE_GCP_PROJECT="${SKIN_CARE_GCP_PROJECT:-skin-and-care-prod}"
export SKIN_CARE_FIREBASE_PROJECT="${SKIN_CARE_FIREBASE_PROJECT:-${SKIN_CARE_GCP_PROJECT}}"
export SKIN_CARE_GCLOUD_ACCOUNT="${SKIN_CARE_GCLOUD_ACCOUNT:-doctorjay254@gmail.com}"
export SKIN_CARE_UI_HOST="${SKIN_CARE_UI_HOST:-https://myskinandcare.com}"
export SKIN_CARE_API_HOST="${SKIN_CARE_API_HOST:-https://api.myskinandcare.com}"
export SKIN_CARE_GCP_REGION="${SKIN_CARE_GCP_REGION:-us-central1}"
export SKIN_CARE_GCS_DB_BUCKET="${SKIN_CARE_GCS_DB_BUCKET:-skin-care-db-${SKIN_CARE_GCP_PROJECT}}"

# Cloud Run deploy (middleware)
export CLOUDRUN_GCP_PROJECT="${CLOUDRUN_GCP_PROJECT:-$SKIN_CARE_GCP_PROJECT}"
export CLOUDRUN_REGION="${CLOUDRUN_REGION:-$SKIN_CARE_GCP_REGION}"
export CLOUDRUN_SERVICE="${CLOUDRUN_SERVICE:-somo-middleware}"
export CLOUDRUN_API_HOST="${CLOUDRUN_API_HOST:-$SKIN_CARE_API_HOST}"
