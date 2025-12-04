#!/bin/bash
# Script to publish the package to GCP Artifact Registry

set -e

echo "Building package..."
npm run build

echo "Getting GCP auth token..."
export ARTIFACT_REGISTRY_TOKEN=$(gcloud auth application-default print-access-token)

echo "Publishing to GCP Artifact Registry..."
npm publish

echo "✅ Package published successfully!"
echo ""
echo "To install, use:"
echo "  npx --registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/ @customer-support-success/pylon-mcp-server"

