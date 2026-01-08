#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PylonClient } from './pylon-client.js';
import {
  parseCacheTtl,
  createPylonClient,
  ensurePylonClient as ensureClient,
  jsonResponse,
} from './server-helpers.js';

const PYLON_API_TOKEN = process.env.PYLON_API_TOKEN;

// Parse and validate PYLON_CACHE_TTL
const PYLON_CACHE_TTL = parseCacheTtl(process.env.PYLON_CACHE_TTL);

// Initialize client only when token is available
const pylonClient = createPylonClient(PYLON_API_TOKEN, PYLON_CACHE_TTL);

// Create the McpServer instance (high-level API, replaces deprecated Server class)
const mcpServer = new McpServer({
  name: 'pylon-mcp-server',
  version: '1.4.0',
});

// Helper function to ensure pylonClient is initialized
function ensurePylonClient(): PylonClient {
  return ensureClient(pylonClient);
}

// Register all tools using the McpServer.registerTool() pattern

// User Management Tools
mcpServer.registerTool(
  'pylon_get_me',
  {
    description:
      'Get current user information from Pylon. Returns your user profile including name, email, role, and permissions. Use this to verify your authentication and see what access level you have.',
  },
  async () => jsonResponse(await ensurePylonClient().getMe())
);

mcpServer.registerTool(
  'pylon_get_users',
  {
    description:
      'Get all team members and support agents in your Pylon workspace. Returns user profiles including names, roles, teams, and availability status.',
  },
  async () => jsonResponse(await ensurePylonClient().getUsers())
);

mcpServer.registerTool(
  'pylon_search_users',
  {
    description:
      'Search for team members and support agents in Pylon. Use this to find colleagues by name, email, or department when assigning issues or checking availability.',
    inputSchema: {
      query: z
        .string()
        .describe(
          'Search term to find users by name, email, or department. Examples: "john", "support@company.com", "technical team"'
        ),
    },
  },
  async ({ query }) => jsonResponse(await ensurePylonClient().searchUsers(query))
);

// Contact Management Tools
mcpServer.registerTool(
  'pylon_get_contacts',
  {
    description:
      'Get customer contacts from Pylon. Use this to find customers who have submitted support tickets or inquiries. Returns contact details like name, email, company, and contact history.',
    inputSchema: {
      search: z
        .string()
        .optional()
        .describe(
          'Search contacts by name, email, or company. Examples: "john@example.com", "Acme Corp", "John Smith"'
        ),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of contacts to return (1-100). Default is 20. Example: 50'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().getContacts(args))
);

mcpServer.registerTool(
  'pylon_create_contact',
  {
    description:
      'Create a new customer contact in Pylon. Use this when adding a new customer who will submit support requests or access your customer portal. Use this carefully.',
    inputSchema: {
      email: z
        .string()
        .describe(
          'Contact email address. Must be valid email format. Example: "sarah@company.com"'
        ),
      name: z.string().describe('Full name of the contact. Example: "Sarah Johnson"'),
      portal_role: z
        .string()
        .optional()
        .describe(
          'Role in customer portal: "admin", "member", "viewer". Determines access level. Example: "member"'
        ),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createContact(args))
);

mcpServer.registerTool(
  'pylon_search_contacts',
  {
    description:
      'Search for customer contacts in Pylon by name, email, company, or other details. Use this to quickly find a specific customer when you need to view their information or create an issue for them.',
    inputSchema: {
      query: z
        .string()
        .describe(
          'Search term to find contacts. Can search by name, email, company, or phone. Examples: "alice@example.com", "Acme Corporation", "John Smith", "+1-555-0123"'
        ),
    },
  },
  async ({ query }) => jsonResponse(await ensurePylonClient().searchContacts(query))
);

// Issue Management Tools
mcpServer.registerTool(
  'pylon_get_issues',
  {
    description:
      'Get support issues/tickets from Pylon. Returns a list of customer support requests with details like title, status, priority, and assigned team member. Use this to see your workload or find specific issues.',
    inputSchema: {
      assignee: z
        .string()
        .optional()
        .describe(
          'Filter by assigned team member. Use email or user ID. Examples: "john@support.com", "user_123"'
        ),
      status: z
        .string()
        .optional()
        .describe(
          'Filter by issue status. Options: "open", "in_progress", "pending", "resolved", "closed". Example: "open"'
        ),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of issues to return (1-100). Default is 50. Example: 25'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().getIssues(args))
);

mcpServer.registerTool(
  'pylon_create_issue',
  {
    description:
      'Create a new support issue/ticket in Pylon. Use this to log customer problems, bug reports, or feature requests that need to be tracked and resolved.',
    inputSchema: {
      title: z
        .string()
        .describe(
          'Brief title describing the issue. Examples: "Login page not loading", "Cannot upload files", "Billing question"'
        ),
      description: z
        .string()
        .describe(
          'Detailed description of the issue, including steps to reproduce and impact. Example: "User reports that clicking login button shows error message. Affects all Chrome users on Windows."'
        ),
      status: z
        .string()
        .describe(
          'Initial status: "open", "in_progress", "pending", "resolved", "closed". Usually "open" for new issues. Example: "open"'
        ),
      priority: z
        .string()
        .describe('Priority level: "low", "medium", "high", "urgent". Example: "high"'),
      assignee: z
        .string()
        .optional()
        .describe(
          'Team member to assign (optional). Use email or user ID. Example: "support@company.com"'
        ),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createIssue(args))
);

mcpServer.registerTool(
  'pylon_get_issue',
  {
    description:
      'Get complete details of a specific support issue/ticket. If you are given a ticket/issue number, call this tool first (no need to use the more complex message/history tools). Returns title, description, status, priority, assignee, customer info, and basic conversation metadata.',
    inputSchema: {
      issue_id: z
        .string()
        .describe(
          'ID (ticket/issue number) to retrieve. You can pass the user-provided ticket number directly; you do not need to call other tools first. Example: "36800"'
        ),
    },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssue(issue_id))
);

mcpServer.registerTool(
  'pylon_update_issue',
  {
    description:
      'Update an existing support issue/ticket. Use this to change status (e.g., mark as resolved), reassign to different team members, update priority, or modify details as you work on the issue.',
    inputSchema: {
      issue_id: z.string().describe('ID of the issue to update. Example: "issue_abc123"'),
      title: z
        .string()
        .optional()
        .describe('New title for the issue. Example: "RESOLVED: Login page not loading"'),
      description: z
        .string()
        .optional()
        .describe(
          'Updated description with new information or resolution details. Example: "Fixed CSS conflict causing login button to not render properly."'
        ),
      status: z
        .string()
        .optional()
        .describe(
          'New status: "open", "in_progress", "pending", "resolved", "closed". Example: "resolved"'
        ),
      priority: z
        .string()
        .optional()
        .describe('New priority level: "low", "medium", "high", "urgent". Example: "medium"'),
      assignee: z
        .string()
        .optional()
        .describe('New assignee email or user ID. Example: "tech-lead@company.com"'),
    },
  },
  async ({ issue_id, ...updates }) =>
    jsonResponse(await ensurePylonClient().updateIssue(issue_id, updates))
);

mcpServer.registerTool(
  'pylon_search_issues',
  {
    description:
      'Search for support issues/tickets in Pylon by keywords, customer name, or issue content. Use this to find related issues, check for duplicates, or research similar problems.',
    inputSchema: {
      query: z
        .string()
        .describe(
          'Search term to find issues. Can search in titles, descriptions, and customer names. Examples: "login error", "billing question", "API timeout", "John Smith"'
        ),
      filters: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Additional filters as key-value pairs. Examples: {"status": "open", "priority": "high"}, {"assignee": "john@company.com", "created_after": "2024-01-01"}'
        ),
    },
  },
  async ({ query, filters }) =>
    jsonResponse(
      await ensurePylonClient().searchIssues(query, filters as Record<string, unknown> | undefined)
    )
);

// Similar Issues Helper Tools
mcpServer.registerTool(
  'pylon_find_similar_issues_for_requestor',
  {
    description:
      'Find similar issues from the same requestor (contact). Helps identify patterns or recurring issues from a specific customer. Fetches the source issue, then searches for issues from the same requestor with similar content.',
    inputSchema: {
      issue_id: z
        .string()
        .describe(
          'The source issue ID to find similar issues for. Example: "issue_abc123" or "36800"'
        ),
      query: z
        .string()
        .optional()
        .describe(
          'Optional search terms to narrow results. If not provided, uses the source issue title. Example: "login error"'
        ),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of similar issues to return. Example: 10'),
    },
  },
  async ({ issue_id, query, limit }) =>
    jsonResponse(
      await ensurePylonClient().findSimilarIssuesForRequestor(issue_id, { query, limit })
    )
);

mcpServer.registerTool(
  'pylon_find_similar_issues_for_account',
  {
    description:
      'Find similar issues from the same account/company. Helps identify company-wide issues or patterns. Fetches the source issue to get the account ID, then searches for issues from the same account with similar content.',
    inputSchema: {
      issue_id: z
        .string()
        .describe(
          'The source issue ID to find similar issues for. Example: "issue_abc123" or "36800"'
        ),
      query: z
        .string()
        .optional()
        .describe(
          'Optional search terms to narrow results. If not provided, uses the source issue title. Example: "billing problem"'
        ),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of similar issues to return. Example: 10'),
    },
  },
  async ({ issue_id, query, limit }) =>
    jsonResponse(await ensurePylonClient().findSimilarIssuesForAccount(issue_id, { query, limit }))
);

mcpServer.registerTool(
  'pylon_find_similar_issues_global',
  {
    description:
      'Find similar issues across all users and companies. Helps identify widespread issues or find solutions from past tickets. Searches for issues with similar content to the source issue, excluding the source issue from results.',
    inputSchema: {
      issue_id: z
        .string()
        .describe(
          'The source issue ID to find similar issues for. Example: "issue_abc123" or "36800"'
        ),
      query: z
        .string()
        .optional()
        .describe(
          'Optional search terms to narrow results. If not provided, uses the source issue title. Example: "API timeout"'
        ),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of similar issues to return. Example: 20'),
    },
  },
  async ({ issue_id, query, limit }) =>
    jsonResponse(await ensurePylonClient().findSimilarIssuesGlobal(issue_id, { query, limit }))
);

mcpServer.registerTool(
  'pylon_snooze_issue',
  {
    description:
      'Temporarily hide an issue until a future date/time. Use this for issues that cannot be worked on now but need follow-up later (e.g., waiting for customer response, scheduled maintenance, feature release).',
    inputSchema: {
      issue_id: z.string().describe('ID of the issue to snooze. Example: "issue_abc123"'),
      until: z
        .string()
        .describe(
          'Date and time when issue should reappear (ISO 8601 format). Examples: "2024-01-15T09:00:00Z" (specific date/time), "2024-01-20T00:00:00Z" (beginning of day)'
        ),
    },
  },
  async ({ issue_id, until }) => {
    await ensurePylonClient().snoozeIssue(issue_id, until);
    return jsonResponse({
      success: true,
      message: 'Issue snoozed successfully',
      issue_id,
      snoozed_until: until,
    });
  }
);

mcpServer.registerTool(
  'pylon_get_issue_with_messages',
  {
    description:
      'Get a complete support issue with all its messages in a single call. Use this when you explicitly need the full conversation history. If you only need issue details and have a ticket number, prefer pylon_get_issue first; reach for this when message bodies are required.',
    inputSchema: {
      issue_id: z
        .string()
        .describe(
          'ID (ticket/issue number) to retrieve with messages. You can pass the user-provided ticket number directly. Example: "issue_abc123"'
        ),
    },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssueWithMessages(issue_id))
);

mcpServer.registerTool(
  'pylon_get_issue_messages',
  {
    description:
      'Get the conversation history for a specific support issue. Use when you need message bodies only. If you have a ticket number and just need issue details, call pylon_get_issue first; use this when you specifically need the messages.',
    inputSchema: {
      issue_id: z
        .string()
        .describe(
          'ID (ticket/issue number) of the issue to get messages for. You can pass the user-provided ticket number directly. Example: "issue_abc123"'
        ),
    },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssueMessages(issue_id))
);

// Note: pylon_create_issue_message has been removed because the Pylon API
// does not support creating messages via API (POST /issues/{id}/messages does not exist).
// Messages can only be created through:
// 1. The Pylon web UI
// 2. Original channels (Slack, email, etc.) for externally-sourced issues
// 3. The initial body_html when creating a new issue via POST /issues
// See: https://github.com/mgmonteleone/pylon-mcp/issues/13

// Knowledge Base Tools
mcpServer.registerTool(
  'pylon_get_knowledge_bases',
  {
    description:
      'Get all knowledge bases from Pylon. Knowledge bases contain help articles, FAQs, and documentation that customers can access. Returns list of available knowledge bases with their names and article counts.',
  },
  async () => jsonResponse(await ensurePylonClient().getKnowledgeBases())
);

// Note: pylon_get_knowledge_base_articles has been removed because the authoritative
// OpenAPI spec does not include GET /knowledge-bases/{id}/articles.
// See: https://github.com/mgmonteleone/pylon-mcp/issues/19

// KB article creation
mcpServer.registerTool(
  'pylon_create_knowledge_base_article',
  {
    description:
			'Create a new help article in a knowledge base. Use this to add new documentation, FAQs, or troubleshooting guides that customers can access for self-service support.',
    inputSchema: {
      knowledge_base_id: z
        .string()
        .describe('ID of the knowledge base to add article to. Example: "kb_123abc"'),
      title: z
        .string()
        .describe(
          'Article title that clearly describes the topic. Examples: "How to Reset Your Password", "Troubleshooting Login Issues", "Billing FAQ"'
        ),
      body_html: z
        .string()
        .describe(
          'Full article content in HTML format. Include step-by-step instructions, screenshots, and links. Example: "<h2>Steps to Reset Password</h2><ol><li>Go to login page</li><li>Click Forgot Password...</li></ol>"'
        ),
      author_user_id: z
        .string()
        .optional()
        .describe(
          'Optional ID of the user attributed as the author of the article. If not provided, defaults to the authenticated user. Example: "user_123abc"'
        ),
      collection_id: z
        .string()
        .optional()
        .describe('Optional ID of the collection to add the article to. Example: "col_123abc"'),
      is_published: z
        .boolean()
        .optional()
        .describe('Whether the article should be published immediately. Defaults to false.'),
      is_unlisted: z
        .boolean()
        .optional()
        .describe('Whether the article can only be accessed via direct link. Defaults to false.'),
      slug: z
        .string()
        .optional()
        .describe(
          'Custom slug for the article URL. Defaults to a slug based on the title. Example: "reset-password-guide"'
        ),
    },
  },
  async ({
    knowledge_base_id,
    title,
    body_html,
    author_user_id,
    collection_id,
    is_published,
    is_unlisted,
    slug,
  }) => {
    const client = ensurePylonClient();

    // Default author_user_id to the authenticated user if not provided
    const resolvedAuthorId = author_user_id ?? (await client.getMe()).id;
    return jsonResponse(
      await client.createKnowledgeBaseArticle(knowledge_base_id, {
				title,
				body_html,
        author_user_id: resolvedAuthorId,
        collection_id,
        is_published,
        is_unlisted,
        slug,
      })
    );
  }
);

// Team Management Tools
mcpServer.registerTool(
  'pylon_get_teams',
  {
    description:
      'Get all support teams from Pylon. Teams are groups of support agents that handle different types of issues (e.g., Technical, Billing, Sales). Returns team names, member counts, and specializations.',
  },
  async () => jsonResponse(await ensurePylonClient().getTeams())
);

mcpServer.registerTool(
  'pylon_get_team',
  {
    description:
      'Get detailed information about a specific support team. Returns team members, their roles, current workload, and team performance metrics.',
    inputSchema: {
      team_id: z
        .string()
        .describe(
          'ID of the team to get details for. Get this from pylon_get_teams first. Example: "team_456def"'
        ),
    },
  },
  async ({ team_id }) => jsonResponse(await ensurePylonClient().getTeam(team_id))
);

mcpServer.registerTool(
  'pylon_create_team',
  {
    description:
      'Create a new support team in Pylon. Use this to organize support agents into specialized groups for handling different types of customer issues (e.g., Technical Support, Billing, Enterprise accounts).',
    inputSchema: {
      name: z
        .string()
        .describe(
          'Team name that describes their specialization. Examples: "Technical Support", "Billing Team", "Enterprise Support", "Level 2 Support"'
        ),
      description: z
        .string()
        .optional()
        .describe(
          'Description of team responsibilities and expertise. Example: "Handles complex technical issues, API questions, and integration support"'
        ),
      members: z
        .array(z.string())
        .optional()
        .describe(
          'Array of user IDs or emails of team members. Example: ["john@company.com", "user_123", "sarah@company.com"]'
        ),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createTeam(args))
);

// Account Management Tools
mcpServer.registerTool(
  'pylon_get_accounts',
  {
    description:
      'Get all customer accounts from Pylon. Accounts represent companies or organizations that use your service. Returns account details like company name, subscription level, and contact information.',
  },
  async () => jsonResponse(await ensurePylonClient().getAccounts())
);

mcpServer.registerTool(
  'pylon_get_account',
  {
    description:
      'Get detailed information about a specific customer account. Returns company details, subscription info, billing status, and associated contacts and issues.',
    inputSchema: {
      account_id: z
        .string()
        .describe(
          'ID of the account to get details for. Get this from pylon_get_accounts or customer records. Example: "acc_789xyz"'
        ),
    },
  },
  async ({ account_id }) => jsonResponse(await ensurePylonClient().getAccount(account_id))
);

// Tag Management Tools
mcpServer.registerTool(
  'pylon_get_tags',
  {
    description:
      'Get all available tags for categorizing issues and contacts. Tags help organize and filter support tickets by topic, urgency, or type (e.g., "bug", "feature-request", "billing", "urgent").',
  },
  async () => jsonResponse(await ensurePylonClient().getTags())
);

mcpServer.registerTool(
  'pylon_create_tag',
  {
    description:
      'Create a new tag for categorizing issues and contacts. Use this to add new categories that help organize and filter your support tickets effectively.',
    inputSchema: {
      name: z
        .string()
        .describe(
          'Tag name that describes the category. Examples: "billing-question", "feature-request", "bug-report", "urgent", "enterprise-customer"'
        ),
      color: z
        .string()
        .optional()
        .describe(
          'Color for the tag in hex format or color name. Examples: "#FF0000", "red", "#00AA00", "blue"'
        ),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createTag(args))
);

// Ticket Form Tools
mcpServer.registerTool(
  'pylon_get_ticket_forms',
  {
    description:
      'Get all ticket submission forms available to customers. Forms define what information customers provide when creating new support requests (e.g., bug report form, billing inquiry form).',
  },
  async () => jsonResponse(await ensurePylonClient().getTicketForms())
);

// Note: pylon_create_ticket_form has been removed because the authoritative OpenAPI spec
// does not include POST /ticket-forms.
// See: https://github.com/mgmonteleone/pylon-mcp/issues/20

// Note: Webhook tools have been removed because the authoritative OpenAPI spec does not
// include any /webhooks endpoints.
// See: https://github.com/mgmonteleone/pylon-mcp/issues/21
// See: https://github.com/mgmonteleone/pylon-mcp/issues/22
// See: https://github.com/mgmonteleone/pylon-mcp/issues/23

// Attachment Management Tools

// Note: pylon_get_attachment has been removed because the authoritative OpenAPI spec does
// not include GET /attachments/{id}.
// See: https://github.com/mgmonteleone/pylon-mcp/issues/24

mcpServer.registerTool(
  'pylon_create_attachment_from_url',
  {
    description:
      'Create an attachment in Pylon from a URL. Downloads the file from the provided URL and creates an attachment that can be used in messages or knowledge base articles. Returns the attachment details including the Pylon-hosted URL.',
    inputSchema: {
      file_url: z
        .string()
        .describe(
          'URL of the file to download and attach. Must be publicly accessible. Example: "https://example.com/document.pdf"'
        ),
      description: z
        .string()
        .optional()
        .describe(
          'Optional description of the attachment. Example: "Product specification document"'
        ),
    },
  },
  async ({ file_url, description }) =>
    jsonResponse(await ensurePylonClient().createAttachmentFromUrl(file_url, description))
);
// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('Pylon MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
