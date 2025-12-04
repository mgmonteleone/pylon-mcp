# Changelog

All notable changes to the Pylon MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

