# GCP Artifact Registry Setup Guide

This document explains how the Pylon MCP Server is published to and used from Google Cloud Platform's Artifact Registry.

## What Was Set Up

1. **GCP Artifact Registry Repository**
   - Repository name: `npm-packages`
   - Location: `us-central1`
   - Format: npm
   - Project: `customer-support-success`

2. **Package Configuration**
   - Package name: `@customer-support-success/pylon-mcp-server`
   - Published to: `https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/`
   - Version: 1.0.0

## For Users: Installing and Using the Package

### Prerequisites

You need to have `gcloud` CLI installed and authenticated:

```bash
# Install gcloud CLI (if not already installed)
# Visit: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth application-default login
```

### Using with npx (Recommended)

```bash
# Run directly with npx
npx --registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/ @customer-support-success/pylon-mcp-server
```

### Installing Globally

```bash
npm install -g --registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/ @customer-support-success/pylon-mcp-server
```

### Using with Augment Code

Add this to your Augment Code MCP configuration:

```json
{
  "pylon": {
    "command": "npx",
    "args": [
      "--registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/",
      "@customer-support-success/pylon-mcp-server"
    ],
    "env": {
      "PYLON_API_TOKEN": "your_pylon_api_token_here"
    }
  }
}
```

### Using with Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pylon": {
      "command": "npx",
      "args": [
        "--registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/",
        "@customer-support-success/pylon-mcp-server"
      ],
      "env": {
        "PYLON_API_TOKEN": "your_pylon_api_token_here"
      }
    }
  }
}
```

## For Maintainers: Publishing Updates

### Prerequisites

1. GCP authentication with publish permissions
2. Local repository cloned and up to date

### Publishing a New Version

1. **Update the version** in `package.json`:

   ```bash
   npm version patch  # or minor, or major
   ```

2. **Publish (CI is preferred)**:
   - CI/CD: push a tag `vX.Y.Z` and let `release.yml` build/test/publish using `GCP_CREDENTIALS` (service account key) and a short-lived access token via `gcloud auth print-access-token`.
   - Local/manual (maintainers only):

     ```bash
     npm run build
     export ARTIFACT_REGISTRY_TOKEN=$(gcloud auth application-default print-access-token)
     npm publish --registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/
     ```

### Verifying the Publication

```bash
# List packages in the registry
gcloud artifacts packages list \
  --repository=npm-packages \
  --location=us-central1 \
  --project=customer-support-success

# View package details
gcloud artifacts versions list \
  --package=@customer-support-success/pylon-mcp-server \
  --repository=npm-packages \
  --location=us-central1 \
  --project=customer-support-success
```

## Troubleshooting

### Authentication Issues

If you get authentication errors:

```bash
# Re-authenticate
gcloud auth application-default login

# Verify authentication
gcloud auth application-default print-access-token
```

### Registry Not Found

Make sure you're using the correct registry URL:

```
https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/
```

### Permission Denied

Ensure your GCP account has the `Artifact Registry Writer` role:

```bash
gcloud artifacts repositories add-iam-policy-binding npm-packages \
  --location=us-central1 \
  --member=user:your-email@example.com \
  --role=roles/artifactregistry.writer
```

## Files Created/Modified

- `.npmrc` - npm configuration for GCP Artifact Registry
- `package.json` - Updated with scoped name and publishConfig
- `.npmignore` - Controls which files are published
- `publish.sh` - Helper script for publishing
- `GCP_SETUP.md` - This documentation file

## Benefits of Using GCP Artifact Registry

1. **Private Package Hosting** - Keep your package private within your organization
2. **Access Control** - Use GCP IAM for fine-grained permissions
3. **Integration** - Works seamlessly with other GCP services
4. **Reliability** - Enterprise-grade infrastructure
5. **Cost-Effective** - Free tier available, pay only for storage and egress
