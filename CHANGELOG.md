# Changelog

All notable changes to the Pylon MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.2.0] - 2026-01-31

### Added

- **External Issue Linking** (Issue #34)
  - New `pylon_link_external_issue` tool - Link Linear, Jira, GitHub, or Asana issues to Pylon tickets
  - New `pylon_unlink_external_issue` tool - Remove external issue links
  - New `PylonExternalIssue` interface for external issue representation
  - Updated `PylonIssue` interface with `external_issues` field
  - Supports sources: `linear`, `jira`, `github`, `asana`

- **Issue Followers Management** (Issue #35)
  - New `pylon_get_issue_followers` tool - Get all followers for an issue
  - New `pylon_add_issue_followers` tool - Add users and/or contacts as followers
  - New `pylon_remove_issue_followers` tool - Remove followers from an issue
  - New `PylonFollower` interface for follower representation
  - Validation to require at least one user_id or contact_id

- **Issue Deletion** (Issue #36)
  - New `pylon_delete_issue` tool - Permanently delete an issue
  - Safety warnings in tool description
  - Consistent response handling with `unwrapData()`

### Changed

- Total MCP tools: 37 (up from 30)
- Total tests: 161 (up from 143)

## [3.1.0] - 2026-01-30

### Breaking Changes

- **`pylon_search_issues` tool completely redesigned** (Issue #30)
  - Now uses Pylon's structured filter format with explicit operators
  - Old signature `searchIssues(query, filters)` replaced with `searchIssues(options: PylonIssueSearchOptions)`
  - Legacy method `searchIssuesLegacy()` available for backward compatibility (deprecated)

- **`pylon_get_issues` parameters changed**
  - Now accepts `start_time` and `end_time` (RFC3339 format) instead of `assignee`, `status`, `limit`
  - For filtering by status/state, use `pylon_search_issues` instead

### Added

- **New `pylon_search_issues_by_status` tool** (Issue #30)
  - Simplified interface for searching by custom status name
  - Automatically maps status names to underlying state + tag combinations
  - Supports built-in states: `new`, `waiting_on_you`, `waiting_on_customer`, `on_hold`, `closed`
  - Common custom status mappings included:
    - "Waiting on Eng Input" → state: `on_hold` + tag: `waiting on eng`
    - "Waiting on Product" → state: `on_hold` + tag: `waiting on product`
    - "Escalated" → state: `on_hold` + tag: `escalated`
    - "In Progress" → state: `waiting_on_you` + tag: `in progress`
    - "Blocked" → state: `on_hold` + tag: `blocked`
  - Unknown status names are treated as tags with `on_hold` state
  - Returns resolved status metadata with each response

- **Custom status filtering support** (Issue #30)
  - `pylon_search_issues` now supports filtering by `state` and `tag` parameters
  - Custom statuses like "Waiting on Eng Input" can be searched using:
    - `state: "on_hold"` + `tag: "waiting on eng"`
  - New filter parameters: `state`, `tag`, `tags`, `title_contains`, `assignee_id`, `account_id`, `requester_id`, `team_id`, `limit`

- **New TypeScript interfaces for structured search**
  - `PylonSearchFilterCondition` - defines filter operators (equals, in, contains, etc.)
  - `PylonIssueSearchFilter` - defines filterable fields
  - `PylonIssueSearchOptions` - search options including filter, limit, cursor

- **Issue state and tags fields**
  - `PylonIssue` interface now includes `state` and `tags` properties

### Fixed

- **Similar issues helper methods updated**
  - `findSimilarIssuesForRequestor`, `findSimilarIssuesForAccount`, `findSimilarIssuesGlobal` now use structured filter format

## [3.0.0] - 2026-01-08

### Breaking Changes

- **Removed `pylon_create_issue_message` tool** (Issue #13)
  - The Pylon API does not support creating messages via `POST /issues/{id}/messages`
  - This endpoint does not exist in the official Pylon API documentation
  - Messages can only be created through:
    1. The Pylon web UI
    2. Original channels (Slack, email, etc.) for externally-sourced issues
    3. The initial `body_html` when creating a new issue via `POST /issues`
  - Removed `createIssueMessage()` method from `PylonClient` class
  - Updated documentation to clarify this API limitation

- **Removed MCP tools that map to non-existent/undocumented Pylon API endpoints** (Issue #14, #19–#24)
  - Source of truth: https://static.usepylon.com/openapi.json
  - Removed tools:
    - `pylon_get_knowledge_base_articles` (#19)
    - `pylon_create_ticket_form` (#20)
    - `pylon_get_webhooks` / `pylon_create_webhook` / `pylon_delete_webhook` (#21–#23)
  - Removed corresponding `PylonClient` methods

- **Removed `PYLON_REQUIRE_MESSAGE_CONFIRMATION` + elicitation-based confirmation prompts** (Issue #25)
  - The message tool was removed (Pylon has no message-create endpoint), so the associated confirmation flow is no longer needed
  - KB article creation no longer prompts for confirmation via MCP elicitation
  - Removed confirmation helper functions and tests

### Added

- **HTTP Request Timeout** - All Pylon API requests now have a 30-second timeout
  - Prevents indefinite hanging when the Pylon API is slow or unresponsive
  - Configurable timeout helps identify API performance issues
  - Requests that exceed 30 seconds will fail with a timeout error

- **Best-effort `pylon_get_attachment` tool**
  - Returns attachment metadata (including a downloadable `url`) when you have an `attachment_id` from a message `attachments[]`
  - _Note_: Pylon's OpenAPI spec omits `GET /attachments/{id}`, but attachments are often referenced by ID in message payloads

### Fixed

- **Normalized wrapped Pylon API response envelopes**
  - Some endpoints can return responses like `{ data: { data: [...] } }` instead of a raw array/object
  - Prevents crashes like `results.filter is not a function` in similar-issue helpers

## [2.0.1] - 2025-12-28

### Fixed

- **`getMe()` now correctly unwraps API response** (Issue #10)
  - The Pylon `/me` endpoint returns a wrapped response: `{ data: { id, name }, request_id }`
  - The `getMe()` method was returning the entire wrapper instead of just the `data` portion
  - This caused `(await client.getMe()).id` to return `undefined` instead of the actual user ID
  - KB article creation now correctly defaults to the authenticated user's ID when `author_user_id` is omitted

### Tests

- Updated mock servers in tests to return the correct wrapped response format, matching actual Pylon API behavior

## [2.0.0] - 2025-12-28

### Breaking Changes

- **Updated `PylonArticle` interface** to match actual Pylon API response schema
  - Removed `body_html` (request-only field, not in response)
  - Removed `knowledge_base_id` (not in response)
  - Added `current_published_content_html` (the actual response field)
  - Added `identifier` field
  - Added `last_published_at` field
  - Added `visibility_config` object

### Fixed

- **KB Article Creation 400 Error** (Issue #8)
  - Changed `content` field to `body_html` per Pylon API spec
  - Added `author_user_id` parameter (optional, defaults to authenticated user)
  - Fixed response parsing to handle `{ data: PylonArticle }` wrapper

### Added

- **Elicitation confirmation for KB article creation**
  - KB articles now require user confirmation before creation (similar to messages)
  - _Note:_ this confirmation flow was later removed in Issue #25
- **New `CreateArticleInput` interface** for article creation requests
- Optional parameters for KB article creation: `collection_id`, `is_published`, `is_unlisted`, `slug`

## [1.7.1] - 2025-12-25

### Changed

- **Improved test coverage** for MCP server layer (Issue #3)
  - Statement coverage: 41.1% → 60.07% (+18.97%)
  - Function coverage: 35.3% → 59% (+23.7%)
  - Line coverage: 48.7% → 59.62% (+10.92%)

### Added

- Extracted testable helper functions to `server-helpers.ts` with 100% test coverage
- Comprehensive tests for all helper functions
- MCP server pattern tests for tool handlers
- Error handling tests for PylonClient (401, 500, timeout, POST/PATCH/DELETE errors)

### Fixed

- **`parseCacheTtl`**: Now validates pure integer strings to reject partial numeric prefixes like `"5000ms"`
- **`jsonResponse`**: Ensures text is always a string for MCP protocol compliance
- **`processElicitationResult`**: Added strict boolean check for `confirm_send`

## [1.7.0] - 2025-12-25

### Added

- **3 New MCP Tools** for searching similar issues (Issue #5)
  - `pylon_find_similar_issues_for_requestor` - Search similar issues from same requestor
  - `pylon_find_similar_issues_for_account` - Search similar issues from same account
  - `pylon_find_similar_issues_global` - Search similar issues across all users
- Extended `PylonIssue` interface with `requestor_id`, `account_id`, and `body_html` fields
- New client methods: `findSimilarIssuesForRequestor`, `findSimilarIssuesForAccount`, `findSimilarIssuesGlobal`

### Fixed

- Removed tests for unimplemented LRU eviction features
- Prettier formatting issues
- Added PYLON_CACHE_TTL validation for non-numeric values

## [1.6.3] - 2025-12-25

### Changed

- Minor release with internal improvements

## [1.4.0] - 2025-12-24

### Changed

- Clarified tool guidance for issue lookups: when given a ticket/issue number, use `pylon_get_issue` first; reserve message-history tools for when conversation bodies are needed.
- Improved tool input schema descriptions to accept user-provided ticket numbers directly without extra lookup steps.

### Added

- Tests asserting the updated tool descriptions and guidance.

## [1.2.0] - 2024-12-05

### Added

- **Attachment Support** - Full support for file attachments in Pylon
  - New `PylonAttachment` interface with id, name, url, and description fields
  - Updated `PylonMessage` interface to include optional `attachments` array
  - New tool: `pylon_get_attachment` - Get details of a specific attachment by ID
  - New tool: `pylon_create_attachment_from_url` - Create attachment from a URL
  - New method: `PylonClient.getAttachment(attachmentId)` - Fetch attachment metadata
  - New method: `PylonClient.createAttachment(file, description?)` - Upload file as attachment
  - New method: `PylonClient.createAttachmentFromUrl(fileUrl, description?)` - Create from URL
  - Messages now properly include attachment information when present

- **Comprehensive Test Coverage** - Professional testing infrastructure
  - Added Vitest testing framework with 17 passing unit tests
  - Test coverage for all attachment methods (6 tests)
  - Test coverage for core functionality: users, issues, contacts, messages (11 tests)
  - Test scripts: `npm test`, `npm run test:watch`, `npm run test:ui`, `npm run test:coverage`
  - Automated testing for error handling (404, network errors)
  - Mock-based testing for fast, reliable test execution
  - Full TypeScript support in tests

### Changed

- Tool count increased from 24+ to **26+ tools**
- Enhanced message handling to support attachments
- Improved documentation with testing section in README and CLAUDE.md

### Improved

- Better code quality with automated test validation
- Regression prevention through comprehensive test suite
- Developer experience with watch mode and interactive test UI
- Documentation now includes testing instructions and coverage details

## [1.1.0] - 2024-12-04

### Added

- **New Tool: `pylon_get_issue_with_messages`** - Get a complete issue with all messages in a single efficient call
  - Combines issue details and message history into one API call
  - Uses `Promise.all()` for parallel fetching to improve performance
  - Returns structured JSON with both `issue` and `messages` properties
  - More efficient than calling `pylon_get_issue` and `pylon_get_issue_messages` separately

### Changed

- **All MCP responses now return valid JSON** - Improved consistency across all tools
  - `pylon_snooze_issue` now returns JSON object with `success`, `message`, `issue_id`, and `snoozed_until`
  - `pylon_delete_webhook` now returns JSON object with `success`, `message`, and `webhook_id`
  - Previously these returned plain text strings
  - All 30 tool handlers now guarantee JSON output for better parseability

### Improved

- Enhanced documentation with new tool examples
- Updated tool count from 23+ to 24+ tools
- Better response structure for operation confirmations

## [1.0.0] - 2024-12-03

### Added

- Initial release of Pylon MCP Server
- 23 comprehensive tools covering Pylon API functionality:
  - User Management (`pylon_get_me`, `pylon_get_users`, `pylon_search_users`)
  - Contact Management (`pylon_get_contacts`, `pylon_create_contact`, `pylon_search_contacts`)
  - Issue Management (`pylon_get_issues`, `pylon_create_issue`, `pylon_get_issue`, `pylon_update_issue`, `pylon_snooze_issue`, `pylon_search_issues`)
  - Message Management (`pylon_get_issue_messages`)
  - Knowledge Base (`pylon_get_knowledge_bases`, `pylon_get_knowledge_base_articles`, `pylon_create_knowledge_base_article`)
  - Team Management (`pylon_get_teams`, `pylon_get_team`, `pylon_create_team`)
  - Account Management (`pylon_get_accounts`, `pylon_get_account`)
  - Tag Management (`pylon_get_tags`, `pylon_create_tag`)
  - Ticket Forms (`pylon_get_ticket_forms`, `pylon_create_ticket_form`)
  - Webhook Management (`pylon_get_webhooks`, `pylon_create_webhook`, `pylon_delete_webhook`)
- TypeScript implementation with full type safety
- Axios-based HTTP client for Pylon API
- MCP SDK integration for Augment Code and Claude Desktop
- Smithery deployment configuration
- Comprehensive documentation and examples
- GCP Artifact Registry publishing support
- Security audit and compliance documentation

### Security

- No hardcoded secrets or API tokens
- Environment variable-based authentication
- HTTPS-only API communication
- Zero dependency vulnerabilities
- SOC-2 and GDPR compliance considerations
