# Pylon MCP Server

An MCP (Model Context Protocol) server for integrating with the Pylon API.

## Features

This MCP server provides tools to interact with Pylon's API:

- **User Management**: Get current user information
- **Contacts**: List, search, and create contacts
- **Issues**: List, filter, and create issues
- **Knowledge Base**: Access and create knowledge base articles

## Setup

### Environment Variables

Set the following environment variable:

- `PYLON_API_TOKEN`: Your Pylon API token (required)

### Installation

#### Option 1: Using npx from GCP Artifact Registry (Recommended)

This package is published to GCP Artifact Registry. You can run it directly with npx:

```bash
# Set up authentication (one-time setup)
gcloud auth application-default login

# Run with npx
npx --registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/ @customer-support-success/pylon-mcp-server
```

Or install globally:

```bash
npm install -g --registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/ @customer-support-success/pylon-mcp-server
```

#### Option 2: Local Development

```bash
npm install
npm run build
```

#### Publishing Updates (for maintainers)

Preferred: tag and let CI publish

```bash
# Update version in package.json, then tag
git tag vX.Y.Z && git push origin vX.Y.Z
```

CI (`release.yml`) will build/test and publish to Artifact Registry using the GCP service account (`GCP_CREDENTIALS`) and a short-lived access token.

Manual (maintainers only):

```bash
npm run build
export ARTIFACT_REGISTRY_TOKEN=$(gcloud auth application-default print-access-token)
npm publish --registry=https://us-central1-npm.pkg.dev/customer-support-success/npm-packages/
```

### Development

```bash
npm run dev
```

### Testing

This project includes comprehensive unit tests for all functionality:

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

**Test Coverage:**

- ✅ Attachment API (get, create from URL, file upload)
- ✅ User Management (get user, search users)
- ✅ Issue Management (get, create, update, filter)
- ✅ Contact Management (get, search, create)
- ✅ Message Management (get messages with attachments)
- ✅ Error Handling (404, network errors)

## Available Tools

### User Tools

- `pylon_get_me`: Get current user information

### Contact Tools

- `pylon_get_contacts`: List contacts with optional search and limit
- `pylon_create_contact`: Create a new contact

### Issue Tools

- `pylon_get_issues`: List issues with optional filtering by assignee, status, and limit
- `pylon_create_issue`: Create a new issue
- `pylon_get_issue`: Get details of a specific issue
- `pylon_get_issue_with_messages`: **NEW** - Get a complete issue with all messages in one call
- `pylon_get_issue_messages`: Get conversation history for an issue
- `pylon_create_issue_message`: Add a message/reply to an issue
- `pylon_update_issue`: Update issue status, priority, assignee, etc.
- `pylon_snooze_issue`: Temporarily hide an issue until a future date

### Knowledge Base Tools

- `pylon_get_knowledge_bases`: List all knowledge bases
- `pylon_get_knowledge_base_articles`: Get articles from a specific knowledge base
- `pylon_create_knowledge_base_article`: Create a new article in a knowledge base

### Attachment Tools

- `pylon_get_attachment`: Get details of a specific attachment
- `pylon_create_attachment_from_url`: Create an attachment from a URL

## Usage Examples

### Running with Augment Code

Augment Code supports MCP servers through its Easy MCP feature in VS Code and JetBrains IDEs.

#### Setup in Augment Code (VS Code or JetBrains)

1. **Open Augment Settings**:
   - In VS Code: Open the Augment Code extension settings
   - In JetBrains: Navigate to Augment settings

2. **Navigate to Easy MCP**:
   - Find the "Easy MCP" pane in the settings
   - Click the "+" button to add a new MCP server

3. **Configure the Server**:

   **Option A: Using npx from GCP Artifact Registry (Recommended)**

   Add this configuration:

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

   **Option B: Using local installation**

   If you've cloned this repository locally:

   ```json
   {
     "pylon": {
       "command": "node",
       "args": ["/absolute/path/to/pylon-mcp-server/dist/index.js"],
       "env": {
         "PYLON_API_TOKEN": "your_pylon_api_token_here"
       }
     }
   }
   ```

4. **Get Your Pylon API Token**:
   - Log into your Pylon dashboard
   - Navigate to Settings → API
   - Generate or copy your API token
   - Replace `your_pylon_api_token_here` with your actual token

5. **Test the Integration**:

   Once configured, you can ask Augment to use Pylon tools:

   ```text
   "Check my Pylon user info"
   "Show me recent support issues"
   "Search for a contact by email"
   "Create a new support ticket"
   ```

### Running Locally with Claude Desktop

1. **Setup Environment**:

   ```bash
   # Clone and install
   git clone <your-repo-url>
   cd pylon-mcp-server
   npm install
   npm run build

   # Set up environment variables
   cp .env.example .env
   # Edit .env and add your PYLON_API_TOKEN
   ```

2. **Configure Claude Desktop**:

Add this to your Claude Desktop MCP settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

**Option A: Using npx from GCP Artifact Registry (Recommended)**

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

**Option B: Using local installation**

```json
{
  "mcpServers": {
    "pylon": {
      "command": "node",
      "args": ["/path/to/pylon-mcp-server/dist/index.js"],
      "env": {
        "PYLON_API_TOKEN": "your_pylon_api_token_here"
      }
    }
  }
}
```

3. **Test the Connection**:

Restart Claude Desktop and try these commands in a conversation:

```text
Use the pylon_get_me tool to check my Pylon user info

Use pylon_get_issues to show recent support tickets

Search for contacts with pylon_search_contacts using "customer@example.com"
```

### Running via Smithery

1. **Deploy to Smithery**:
   - Upload your project to Smithery
   - Smithery will automatically use the `smithery.yaml` configuration
   - Set the `PYLON_API_TOKEN` environment variable in Smithery's deployment settings

2. **Configure in Claude Desktop**:

```json
{
  "mcpServers": {
    "pylon": {
      "command": "npx",
      "args": ["-y", "@smithery/pylon-mcp-server"]
    }
  }
}
```

### Example Tool Usage

Once connected, you can use any of the 26+ available tools:

```text
# User Management
"Get my user info" → uses pylon_get_me
"Search for users named John" → uses pylon_search_users

# Issue Management
"Show all open issues" → uses pylon_get_issues
"Create a new bug report" → uses pylon_create_issue
"Get issue #123 with all messages" → uses pylon_get_issue_with_messages
"Add a comment to issue #123" → uses pylon_create_issue_message
"Update issue status to resolved" → uses pylon_update_issue

# Attachments
"Get attachment details for att_123" → uses pylon_get_attachment (NEW!)
"Create attachment from URL" → uses pylon_create_attachment_from_url (NEW!)

# Knowledge Base
"List all knowledge bases" → uses pylon_get_knowledge_bases
"Create a new help article" → uses pylon_create_knowledge_base_article

# Team & Account Management
"Show all teams" → uses pylon_get_teams
"Get account details" → uses pylon_get_accounts
```

## Deployment to Smithery

This server is designed to be deployed to Smithery using the included `smithery.yaml` configuration. The deployment will automatically:

- Install dependencies with `npm install && npm run build`
- Configure the Node.js runtime with proper entrypoint
- Expose all 23 Pylon API tools
- Require the `PYLON_API_TOKEN` environment variable

## API Reference

For more information about the Pylon API, visit the [API reference](https://docs.usepylon.com/pylon-docs/developer/api/api-reference).
