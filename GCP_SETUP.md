# npm Public Publish Guide

This document explains how the Pylon MCP Server is published to and used from the public npm registry using npm Trusted Publishing (OIDC).

## What Was Set Up

1. **npm Registry (public)**
   - Registry: `https://registry.npmjs.org/`
   - Package: `@customer-support-success/pylon-mcp-server`
   - Access: public

2. **Trusted Publisher**
   - Provider: GitHub
   - Repository: `mgmonteleone/pylon-mcp`
   - Workflow: `.github/workflows/publish.yml`
   - Branch: `main`

## For Users: Installing and Using the Package

### Using with npx (Recommended)

```bash
npx @customer-support-success/pylon-mcp-server
```

### Installing Globally

```bash
npm install -g @customer-support-success/pylon-mcp-server
```

### Using with Augment Code

Add this to your Augment Code MCP configuration (npm public):

```json
{
  "pylon": {
    "command": "npx",
    "args": ["@customer-support-success/pylon-mcp-server"],
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
      "args": ["@customer-support-success/pylon-mcp-server"],
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

2. **Publish (CI preferred via trusted publisher)**:
   - Push a tag `vX.Y.Z` and let `.github/workflows/publish.yml` build/test/publish to npmjs with `--provenance`.
   - Local/manual (maintainers only, if needed):

     ```bash
     npm run build
     npm publish --access public
     ```

### Verifying the Publication

```bash
npm view @customer-support-success/pylon-mcp-server version
```

## Troubleshooting

### Authentication Issues

If npm publish fails locally, ensure you use the trusted publisher workflow or a granular access token with publish rights and 2FA bypass. For installs, no auth is required (public package).

## Files Created/Modified

None (documentation only).

## Notes

- Package is public on npm; no auth required for consumers.
- Publishing is handled by GitHub Actions via npm Trusted Publishing (OIDC). Manual publishes should be rare.
