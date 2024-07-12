#!/bin/bash

# set tag variable
REGION="africa-south1"
PROJECT_ID="hono-poc"
BASE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/default/api"

docker buildx build \
  -f Dockerfile\
  --platform linux/amd64\
  -t $BASE_TAG:latest\
  .

gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin africa-south1-docker.pkg.dev

docker push $BASE_TAG

gcloud run deploy api\
  --image $BASE_TAG:latest\
  --region=$REGION\
  --project=$PROJECT_ID\
  --min-instances=0\
  --max-instances=5\
  --concurrency=1000\
  --cpu=1\
  --memory=512Mi\
  --timeout=5m\
  --cpu-boost\
  --cpu-throttling\
  --session-affinity\
  --allow-unauthenticated\
  --use-http2\
  --execution-environment=gen2