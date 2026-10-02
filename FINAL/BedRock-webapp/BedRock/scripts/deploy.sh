#!/usr/bin/env bash
# ============================================================
# BedRock — Google Cloud Run deployment script
# Project: bedrock-491015
#
# Sensitive values live in Google Secret Manager:
#   REDIS_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
#   API_KEY, PRIVATE_KEY
# The Cloud Run runtime SA must have roles/secretmanager.secretAccessor.
# ============================================================
set -euo pipefail

PROJECT_ID="bedrock-491015"
SERVICE_NAME="bedrock-app"
REGION="asia-south1"

# ---- Build-time env vars (baked into frontend JS bundle) ----
VITE_AWS_REGION="ap-south-1"
VITE_COGNITO_IDENTITY_POOL_ID="ap-south-1:0655c67f-0d86-4f96-83b3-5229a9adea06"
VITE_SEG_SIZE_BYTES="1310720"

# ---- Non-sensitive runtime env vars ----
AWS_REGION="ap-south-1"
LIVENESS_THRESHOLD="90"
RPC_URL="https://rpc.stabilityprotocol.com"
GRANDFATHER_ADDRESS="0x76317dD8b5A390c6876F3a94A07230654b476E19"
SEG_SIZE_BYTES="1310720"
HASH_JOB_TIMEOUT_MS="30000"
HASH_JOB_RETRIES="5"
HASH_CONCURRENCY="1"

echo "▶ Deploying ${SERVICE_NAME} to Cloud Run"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo ""

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 10 \
  --allow-unauthenticated \
  --build-env-vars "\
VITE_AWS_REGION=${VITE_AWS_REGION},\
VITE_COGNITO_IDENTITY_POOL_ID=${VITE_COGNITO_IDENTITY_POOL_ID},\
VITE_SEG_SIZE_BYTES=${VITE_SEG_SIZE_BYTES}" \
  --set-env-vars "\
AWS_REGION=${AWS_REGION},\
LIVENESS_THRESHOLD=${LIVENESS_THRESHOLD},\
RPC_URL=${RPC_URL},\
GRANDFATHER_ADDRESS=${GRANDFATHER_ADDRESS},\
SEG_SIZE_BYTES=${SEG_SIZE_BYTES},\
HASH_JOB_TIMEOUT_MS=${HASH_JOB_TIMEOUT_MS},\
HASH_JOB_RETRIES=${HASH_JOB_RETRIES},\
HASH_CONCURRENCY=${HASH_CONCURRENCY}" \
  --set-secrets "\
REDIS_URL=REDIS_URL:latest,\
AWS_ACCESS_KEY_ID=AWS_ACCESS_KEY_ID:latest,\
AWS_SECRET_ACCESS_KEY=AWS_SECRET_ACCESS_KEY:latest,\
API_KEY=API_KEY:latest,\
PRIVATE_KEY=PRIVATE_KEY:latest"

echo ""
echo "✅ Deployment complete. Service URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format "value(status.url)"
