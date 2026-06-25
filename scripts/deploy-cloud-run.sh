#!/usr/bin/env bash
set -euo pipefail

on_error() {
  echo "ERROR: Failed to update Cloud Run service kindy with Inngest secrets. Verify gcloud auth, project, region, and that Secret Manager secrets exist." >&2
}

trap on_error ERR

gcloud run services update kindy \
  --region=asia-northeast3 \
  --update-secrets=INNGEST_SIGNING_KEY=kindy-inngest-signing-key:latest,INNGEST_EVENT_KEY=kindy-inngest-event-key:latest \
  --remove-env-vars=INNGEST_DEV
