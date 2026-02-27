# Pylon MCP Server

An MCP (Model Context Protocol) server for integrating with the Pylon API.

## Features

This MCP server provides 38 tools for comprehensive Pylon API integration:

- **User Management**: Get current user, list and search team members
- **Contacts**: List, search, and create contacts
- **Issues**: Full CRUD, search, filter, snooze, and delete issues
- **Tags**: Get, create, add, and remove tags on issues
- **External Issue Linking**: Link/unlink Linear, Jira, GitHub, Asana issues
- **Issue Followers**: Get, add, and remove followers on issues
- **Similar Issues**: Find similar issues by requestor, account, or globally
- **Knowledge Base**: List knowledge bases and create articles
- **Teams**: List, get details, and create teams
- **Accounts**: List and get account details
- **Attachments**: Get metadata and create from URL
- **Ticket Forms**: List available submission forms
- **Smart Caching**: Automatic caching of GET requests with configurable TTL
- **Retry Logic**: Exponential backoff for transient failures (429, 5xx, timeouts)

## Setup

### Environment Variables

Set the following environment variables:

- `PYLON_API_TOKEN`: Your Pylon API token (required)
- `PYLON_CACHE_TTL`: Cache time-to-live in milliseconds (optional, default: 30000)
  - Set to `0` to disable caching
  - Example: `PYLON_CACHE_TTL=60000` for 60-second cache
- `PYLON_RETRY_MAX`: Maximum retry attempts for transient failures (optional, default: 3)
  - Set to `0` to disable retries
  - Retries on: 429 (rate limit), 5xx (server error), network timeouts
  - Only retries idempotent requests (GET, HEAD, OPTIONS, PUT, DELETE)
  - Uses exponential backoff with jitter
  - Respects `Retry-After` header (capped at 30 seconds)
- `PYLON_DEBUG`: Set to `true` to enable debug logging (optional)
  - Logs request/response details and retry attempts to stderr

### HTTP Request Timeout

All Pylon API requests have a **30-second timeout** to prevent indefinite hanging. If a request takes longer than 30 seconds, it will fail with a timeout error. This helps identify:

- Slow API responses
- Network connectivity issues
- API performance problems

If you encounter timeout errors, check:

1. Your network connection
2. Pylon API status
3. Whether the operation is legitimately slow (e.g., large data queries)

### Retry Behavior

The client automatically retries transient API failures with exponential backoff:

- **Retried errors**: HTTP 429 (rate limit), 5xx (server errors), network timeouts
- **Not retried**: 4xx client errors (400, 401, 403, 404, 422), POST/PATCH requests
- **Backoff**: `min(1000ms × 2^attempt + random jitter, 30s)`, respects `Retry-After` header
- **Default**: 3 retry attempts. Set `PYLON_RETRY_MAX=0` to disable.

### Caching Behavior

The server implements intelligent caching to reduce API calls:

- **Cached Operations**: All GET requests (users, contacts, issues, teams, etc.)
- **Not Cached**: POST, PATCH, DELETE operations (creates, updates, deletes)
- **Default TTL**: 30 seconds
- **Cache Key**: Based on endpoint URL and query parameters
- **Benefits**: Reduces API rate limit usage, improves response times for repeated queries

### Installation

#### Option 1: Install from npm (public)

This package is published publicly to npm:

```bash
# Run with npx (no auth required)
npx @customer-support-success/pylon-mcp-server

# Or install globally
npm install -g @customer-support-success/pylon-mcp-server
```

#### Option 2: Local Development

```bash
npm install
npm run build
```

#### Publishing Updates (for maintainers)

Preferred: tag and let GitHub Actions publish via npm Trusted Publishing (OIDC)

```bash
# Update version in package.json, then tag
git tag vX.Y.Z && git push origin vX.Y.Z
```

CI (`.github/workflows/release.yml`) will build/test and publish to npmjs with `--provenance` via trusted publisher.

Manual (maintainers only, if ever needed):

```bash
npm run build
npm publish --access public
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

- ✅ Attachment API (create from URL, file upload)
- ✅ User Management (get user, search users)
- ✅ Issue Management (get, create, update, filter, delete)
- ✅ Contact Management (get, search, create)
- ✅ Message Management (get messages with attachments)
- ✅ External Issue Linking (link/unlink Linear, Jira, GitHub, Asana)
- ✅ Issue Followers (get, add, remove followers)
- ✅ Error Handling (404, network errors)

## Available Tools

### User Tools

- `pylon_get_me`: Get current user information
- `pylon_get_users`: Get all team members and support agents
- `pylon_search_users`: Search for team members by name, email, or department

### Contact Tools

- `pylon_get_contacts`: List contacts with optional search and limit
- `pylon_search_contacts`: Search for contacts by name, email, or company
- `pylon_create_contact`: Create a new contact

### Issue Tools

- `pylon_get_issues`: List issues within a time range (uses start_time/end_time parameters)
- `pylon_search_issues`: Search and filter issues by state, tags, assignee, account, and more
- `pylon_search_issues_by_status`: Search by status name (handles custom status mapping automatically)
- `pylon_create_issue`: Create a new issue
- `pylon_get_issue`: Get details of a specific issue
- `pylon_get_issue_with_messages`: Get a complete issue with all messages in one call
- `pylon_get_issue_messages`: Get conversation history for an issue
- `pylon_update_issue`: Update issue status, priority, assignee, or replace all tags
- `pylon_add_tags`: Incrementally add tags to an issue (preserves existing tags, deduplicates)
- `pylon_remove_tags`: Incrementally remove specific tags from an issue (leaves other tags intact)
- `pylon_snooze_issue`: Temporarily hide an issue until a future date
- `pylon_delete_issue`: Permanently delete an issue (⚠️ destructive operation)

### External Issue Linking Tools

- `pylon_link_external_issue`: Link an external issue (Linear, Jira, GitHub, Asana) to a Pylon issue
- `pylon_unlink_external_issue`: Unlink an external issue from a Pylon issue

### Issue Followers Tools

- `pylon_get_issue_followers`: Get the list of followers for an issue
- `pylon_add_issue_followers`: Add users and/or contacts as followers to an issue
- `pylon_remove_issue_followers`: Remove followers from an issue

#### Searching by Custom Status

Pylon represents custom statuses (like "Waiting on Eng Input") as a combination of **state** and **tag**. We provide two ways to search by status:

**Option 1: Use `pylon_search_issues_by_status` (Recommended)**

This tool automatically maps status names to the correct state + tag combination:

```
# Just use the status name directly:
pylon_search_issues_by_status with status: "Waiting on Eng Input"

# Built-in mappings include:
- "Waiting on Eng Input" → state: on_hold + tag: waiting on eng
- "Waiting on Product" → state: on_hold + tag: waiting on product
- "Escalated" → state: on_hold + tag: escalated
- "In Progress" → state: waiting_on_you + tag: in progress
- "Blocked" → state: on_hold + tag: blocked
```

**Option 2: Use `pylon_search_issues` with explicit state + tag**

```
# Manually specify the combination:
pylon_search_issues with:
  - state: "on_hold"
  - tag: "waiting on eng"
```

**Available Built-in States:**

- `new` - New/unread issues
- `waiting_on_you` - Waiting for your response
- `waiting_on_customer` - Waiting for customer response
- `on_hold` - On hold (often used with custom status tags)
- `closed` - Closed/resolved issues

> **Note:** The Pylon API does not support creating messages programmatically. Messages can only be created through the Pylon web UI or original channels (Slack, email, etc.).

### Similar Issues Tools

- `pylon_find_similar_issues_for_requestor`: Find similar issues from the same contact
- `pylon_find_similar_issues_for_account`: Find similar issues from the same account/company
- `pylon_find_similar_issues_global`: Find similar issues across all users and companies

### Knowledge Base Tools

- `pylon_get_knowledge_bases`: List all knowledge bases
- `pylon_create_knowledge_base_article`: Create a new article in a knowledge base

### Team Tools

- `pylon_get_teams`: List all support teams
- `pylon_get_team`: Get details of a specific team
- `pylon_create_team`: Create a new support team

### Account Tools

- `pylon_get_accounts`: List all customer accounts
- `pylon_get_account`: Get details of a specific account

### Tag Tools

- `pylon_get_tags`: Get all available tags
- `pylon_create_tag`: Create a new tag

### Ticket Form Tools

- `pylon_get_ticket_forms`: Get all ticket submission forms

### Attachment Tools

- `pylon_get_attachment`: Get attachment metadata (includes a downloadable URL)
- `pylon_create_attachment_from_url`: Create an attachment from a URL

> Tip: You usually get `attachment_id` from a message’s `attachments[]` returned by `pylon_get_issue_messages` or `pylon_get_issue_with_messages`. To download the actual file, fetch the returned `url` (signed URLs may expire).

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

   **Using npx from npmjs (Recommended)**

   Add this configuration:

   ```json
   {
     "pylon": {
       "command": "npx",
       "args": ["@customer-support-success/pylon-mcp-server"],
       "env": {
         "PYLON_API_TOKEN": "your_pylon_api_token_here",
         "PYLON_CACHE_TTL": "30000",
         "PYLON_RETRY_MAX": "3"
       }
     }
   }
   ```

   > **Note**: `PYLON_RETRY_MAX` is optional and defaults to 3. Set to `0` to disable retries. `PYLON_CACHE_TTL` is optional and defaults to 30000ms (30 seconds). Set to `0` to disable caching.

   **Option B: Using local installation**

   If you've cloned this repository locally:

   ```json
   {
     "pylon": {
       "command": "node",
       "args": ["/absolute/path/to/pylon-mcp-server/dist/index.js"],
       "env": {
         "PYLON_API_TOKEN": "your_pylon_api_token_here",
         "PYLON_CACHE_TTL": "30000",
         "PYLON_RETRY_MAX": "3"
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

**Using npx from npmjs (Recommended)**

```json
{
  "mcpServers": {
    "pylon": {
      "command": "npx",
      "args": ["@customer-support-success/pylon-mcp-server"],
      "env": {
        "PYLON_API_TOKEN": "your_pylon_api_token_here",
        "PYLON_CACHE_TTL": "30000",
        "PYLON_RETRY_MAX": "3"
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
        "PYLON_API_TOKEN": "your_pylon_api_token_here",
        "PYLON_CACHE_TTL": "30000",
        "PYLON_RETRY_MAX": "3"
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

### Example Tool Usage

Once connected, you can use the available tools:

```text
# User Management
"Get my user info" → uses pylon_get_me
"Search for users named John" → uses pylon_search_users

# Issue Management
"Show all open issues" → uses pylon_get_issues
"Create a new bug report" → uses pylon_create_issue
"Get issue #123 with all messages" → uses pylon_get_issue_with_messages
"Update issue status to resolved" → uses pylon_update_issue

# Similar Issues
"Find similar issues from this customer" → uses pylon_find_similar_issues_for_requestor
"Check if this account has had similar problems" → uses pylon_find_similar_issues_for_account

# Tags
"Show all available tags" → uses pylon_get_tags
"Add a tag to this issue" → uses pylon_add_tags

# External Linking
"Link this Linear ticket to the Pylon issue" → uses pylon_link_external_issue

# Issue Followers
"Add me as a follower on this issue" → uses pylon_add_issue_followers

# Attachments
"Create attachment from URL" → uses pylon_create_attachment_from_url

# Knowledge Base
"List all knowledge bases" → uses pylon_get_knowledge_bases
"Create a new help article" → uses pylon_create_knowledge_base_article

# Ticket Forms
"Show available ticket forms" → uses pylon_get_ticket_forms

# Team & Account Management
"Show all teams" → uses pylon_get_teams
"Get account details" → uses pylon_get_accounts
```

## API Reference

For more information about the Pylon API, visit the [API reference](https://docs.usepylon.com/pylon-docs/developer/api/api-reference).
