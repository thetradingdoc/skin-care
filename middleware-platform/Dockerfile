# Cloud Run / GCP — Node middleware (better-sqlite3 + sharp need build tools)
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 make g++ \
    clamav clamav-freshclam \
    && update-ca-certificates \
    && freshclam \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV DB_PATH=/var/data/middleware-staging.db
ENV GCS_DB_BUCKET=somo-staging-db-somo-callsomo
# Medical upload AV (fail-closed without a working scanner)
ENV CLAMAV_BIN=clamscan
# Cloud Run sets PORT (default 8080)
EXPOSE 8080
RUN chmod +x docker-entrypoint.sh scripts/cloudrun-db-sync.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
