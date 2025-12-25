# Changelog

All notable changes to the Pylon MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - Message Management (`pylon_get_issue_messages`, `pylon_create_issue_message`)
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

---

## Release Notes Format

### Added

New features and capabilities

### Changed

Changes to existing functionality

### Deprecated

Features that will be removed in future versions

### Removed

Features that have been removed

### Fixed

Bug fixes

### Security

Security improvements and vulnerability fixes
