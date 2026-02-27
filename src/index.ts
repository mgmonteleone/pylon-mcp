#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PylonClient, PylonIssueSearchFilter, PylonSearchFilterCondition } from './pylon-client.js';
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
    description: 'Get the current authenticated user profile including name, email, role, and permissions.',
  },
  async () => jsonResponse(await ensurePylonClient().getMe())
);

mcpServer.registerTool(
  'pylon_get_users',
  {
    description: 'Get all team members and support agents in your Pylon workspace.',
  },
  async () => jsonResponse(await ensurePylonClient().getUsers())
);

mcpServer.registerTool(
  'pylon_search_users',
  {
    description: 'Search for team members and support agents by name, email, or department.',
    inputSchema: {
      query: z.string().describe('Search query'),
    },
  },
  async ({ query }) => jsonResponse(await ensurePylonClient().searchUsers(query))
);

// Contact Management Tools
mcpServer.registerTool(
  'pylon_get_contacts',
  {
    description: 'Get customer contacts from Pylon. Returns contact details like name, email, and company.',
    inputSchema: {
      search: z.string().optional().describe('Search contacts by name, email, or company'),
      limit: z.number().optional().describe('Max results to return'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().getContacts(args))
);

mcpServer.registerTool(
  'pylon_create_contact',
  {
    description: 'Create a new customer contact in Pylon. Use carefully.',
    inputSchema: {
      email: z.string(),
      name: z.string(),
      portal_role: z.string().optional().describe('Role in customer portal: "admin", "member", or "viewer"'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createContact(args))
);

mcpServer.registerTool(
  'pylon_search_contacts',
  {
    description: 'Search for customer contacts by name, email, company, or phone.',
    inputSchema: {
      query: z.string().describe('Search query'),
    },
  },
  async ({ query }) => jsonResponse(await ensurePylonClient().searchContacts(query))
);

// Issue Management Tools

// Maximum time range allowed by Pylon API (30 days in milliseconds)
const MAX_TIME_RANGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIME_RANGE_DAYS = 30;

mcpServer.registerTool(
  'pylon_get_issues',
  {
    description:
      'Get support issues within a time range (max 30 days); defaults to last 30 days. Use this for unfiltered listing. For filtering by state, tags, or custom statuses, use pylon_search_issues instead.',
    inputSchema: {
      start_time: z
        .string()
        .optional()
        .describe('Start of time range (RFC3339, e.g. "2024-01-01T00:00:00Z"). Defaults to 30 days ago.'),
      end_time: z
        .string()
        .optional()
        .describe('End of time range (RFC3339, e.g. "2024-01-31T00:00:00Z"). Defaults to now.'),
    },
  },
  async (args) => {
    let { start_time, end_time } = args;

    // Normalize empty strings to undefined to treat them as "not provided"
    // This prevents empty strings from bypassing validation
    const startTimeProvided = start_time !== undefined && start_time !== null && start_time !== '';
    const endTimeProvided = end_time !== undefined && end_time !== null && end_time !== '';

    // Validate that both start_time and end_time are provided together, or neither
    if (startTimeProvided !== endTimeProvided) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Both start_time and end_time must be provided together, or neither.',
            }),
          },
        ],
      };
    }

    // If neither is provided, default to the last 30 days
    if (!startTimeProvided && !endTimeProvided) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - MAX_TIME_RANGE_MS);
      start_time = thirtyDaysAgo.toISOString();
      end_time = now.toISOString();
    }

    // At this point, both start_time and end_time are guaranteed to be strings
    // (either provided together or set to defaults above)
    const startTimeStr = start_time as string;
    const endTimeStr = end_time as string;

    // RFC3339 regex pattern - validates proper format with timezone
    // Matches: YYYY-MM-DDTHH:MM:SSZ or YYYY-MM-DDTHH:MM:SS+HH:MM or YYYY-MM-DDTHH:MM:SS-HH:MM
    // Also allows optional fractional seconds: YYYY-MM-DDTHH:MM:SS.sssZ
    const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    // Validate RFC3339 format for start_time
    if (!rfc3339Regex.test(startTimeStr)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Invalid start_time format: "${args.start_time}". Must be RFC3339 format with timezone (e.g., "2024-01-01T00:00:00Z" or "2024-01-01T00:00:00+00:00").`,
            }),
          },
        ],
      };
    }

    // Validate RFC3339 format for end_time
    if (!rfc3339Regex.test(endTimeStr)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Invalid end_time format: "${args.end_time}". Must be RFC3339 format with timezone (e.g., "2024-01-31T00:00:00Z" or "2024-01-31T00:00:00+00:00").`,
            }),
          },
        ],
      };
    }

    // Parse dates after format validation
    const startDate = new Date(startTimeStr);
    const endDate = new Date(endTimeStr);

    // Check for invalid dates (e.g., 2024-02-30 would pass regex but be invalid)
    if (isNaN(startDate.getTime())) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Invalid start_time date: "${args.start_time}". The date is not valid.`,
            }),
          },
        ],
      };
    }
    if (isNaN(endDate.getTime())) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Invalid end_time date: "${args.end_time}". The date is not valid.`,
            }),
          },
        ],
      };
    }

    // Check that start_time is before end_time
    if (startDate >= endDate) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'start_time must be before end_time.',
            }),
          },
        ],
      };
    }

    // Check that time range doesn't exceed 30 days
    const rangeMs = endDate.getTime() - startDate.getTime();
    if (rangeMs > MAX_TIME_RANGE_MS) {
      // Show precise day count with 2 decimal places to avoid confusion
      // when the range is just barely over 30 days (e.g., 30.01 days)
      const rangeDays = (rangeMs / (24 * 60 * 60 * 1000)).toFixed(2);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Time range exceeds the maximum allowed. The Pylon API allows a maximum of ${MAX_TIME_RANGE_DAYS} days, but the specified range is ${rangeDays} days. Please reduce your time range or use pylon_search_issues for broader queries.`,
            }),
          },
        ],
      };
    }

    return jsonResponse(await ensurePylonClient().getIssues({ start_time, end_time }));
  }
);

mcpServer.registerTool(
  'pylon_create_issue',
  {
    description: 'Create a new support issue/ticket in Pylon.',
    inputSchema: {
      title: z.string(),
      description: z.string(),
      status: z.string().describe('"open", "in_progress", "pending", "resolved", or "closed"'),
      priority: z.string().describe('"low", "medium", "high", or "urgent"'),
      assignee: z.string().optional().describe('Team member email or user ID to assign (optional)'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createIssue(args))
);

mcpServer.registerTool(
  'pylon_get_issue',
  {
    description: 'Get complete details of a specific issue. Prefer this over message tools when you only need issue metadata.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
    },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssue(issue_id))
);

mcpServer.registerTool(
  'pylon_update_issue',
  {
    description:
      'Update an existing issue\'s title, description, status, priority, assignee, or tags. To add/remove tags without replacing all, use pylon_add_tags or pylon_remove_tags.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional().describe('"open", "in_progress", "pending", "resolved", or "closed"'),
      priority: z.string().optional().describe('"low", "medium", "high", or "urgent"'),
      assignee: z.string().optional(),
      tags: z
        .array(z.string())
        .optional()
        .describe('Complete replacement tag list. Use pylon_add_tags or pylon_remove_tags to modify without replacing all.'),
    },
  },
  async ({ issue_id, ...updates }) => {
    if (updates.tags !== undefined) {
      const invalidTag = updates.tags.find((t) => t.trim() === '');
      if (invalidTag !== undefined) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: Tags must not be empty or whitespace-only strings.',
            },
          ],
          isError: true,
        };
      }
    }
    return jsonResponse(await ensurePylonClient().updateIssue(issue_id, updates));
  }
);

mcpServer.registerTool(
  'pylon_add_tags',
  {
    description:
      'Add tags to a Pylon issue without removing existing tags. To replace all tags, use pylon_update_issue; to remove tags, use pylon_remove_tags.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      tags: z.array(z.string()).describe('Tags to add (duplicates ignored)'),
    },
  },
  async ({ issue_id, tags }) => {
    const invalidTag = tags.find((t) => t.trim() === '');
    if (invalidTag !== undefined) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: Tags must not be empty or whitespace-only strings.',
          },
        ],
        isError: true,
      };
    }
    const client = ensurePylonClient();
    const issue = await client.getIssue(issue_id);
    const currentTags = issue.tags || [];
    const mergedTags = [...new Set([...currentTags, ...tags])];
    if (
      mergedTags.length === currentTags.length &&
      mergedTags.every((t) => currentTags.includes(t))
    ) {
      return jsonResponse(issue);
    }
    return jsonResponse(await client.updateIssue(issue_id, { tags: mergedTags }));
  }
);

mcpServer.registerTool(
  'pylon_remove_tags',
  {
    description:
      'Remove specific tags from a Pylon issue without affecting other tags. To add tags, use pylon_add_tags; to replace all, use pylon_update_issue.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      tags: z.array(z.string()).describe('Tags to remove (missing tags ignored)'),
    },
  },
  async ({ issue_id, tags }) => {
    const invalidTag = tags.find((t) => t.trim() === '');
    if (invalidTag !== undefined) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: Tags must not be empty or whitespace-only strings.',
          },
        ],
        isError: true,
      };
    }
    const client = ensurePylonClient();
    const issue = await client.getIssue(issue_id);
    const currentTags = issue.tags || [];
    const filteredTags = currentTags.filter((t) => !tags.includes(t));
    if (
      filteredTags.length === currentTags.length &&
      filteredTags.every((t) => currentTags.includes(t))
    ) {
      return jsonResponse(issue);
    }
    return jsonResponse(await client.updateIssue(issue_id, { tags: filteredTags }));
  }
);

mcpServer.registerTool(
  'pylon_search_issues',
  {
    description:
      'Search issues using structured filters; requires at least one filter. For unfiltered listing, use pylon_get_issues instead.',
    inputSchema: {
      state: z
        .string()
        .optional()
        .describe('Filter by state: "new", "waiting_on_you", "waiting_on_customer", "on_hold", or "closed"'),
      tag: z
        .string()
        .optional()
        .describe('Filter by single tag; combine with state for custom statuses (e.g., state="on_hold" + tag="waiting on eng")'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Filter by multiple tags (issue must have ALL specified tags)'),
      title_contains: z.string().optional().describe('Search text within issue titles'),
      assignee_id: z.string().optional().describe('Filter by assignee user ID'),
      account_id: z.string().optional().describe('Filter by account/company ID'),
      requester_id: z.string().optional().describe('Filter by requester/contact ID'),
      team_id: z.string().optional().describe('Filter by team ID'),
      limit: z.number().optional().describe('Max results to return'),
    },
  },
  async (args) => {
    const {
      state: stateRaw,
      tag: tagRaw,
      tags: tagsRaw,
      title_contains: titleContainsRaw,
      assignee_id: assigneeIdRaw,
      account_id: accountIdRaw,
      requester_id: requesterIdRaw,
      team_id: teamIdRaw,
      limit,
    } = args;

    // Sanitize string inputs: trim and treat whitespace-only as undefined
    const state = stateRaw?.trim() || undefined;
    const tag = tagRaw?.trim() || undefined;
    const tags = tagsRaw?.map((t) => t.trim()).filter((t) => t.length > 0);
    const title_contains = titleContainsRaw?.trim() || undefined;
    const assignee_id = assigneeIdRaw?.trim() || undefined;
    const account_id = accountIdRaw?.trim() || undefined;
    const requester_id = requesterIdRaw?.trim() || undefined;
    const team_id = teamIdRaw?.trim() || undefined;

    // Build the structured filter object with proper types
    const filter: PylonIssueSearchFilter = {};

    if (state) {
      filter.state = { operator: 'equals', value: state } as PylonSearchFilterCondition;
    }
    if (tag) {
      filter.tags = { operator: 'contains', value: tag } as PylonSearchFilterCondition;
    } else if (tags && tags.length > 0) {
      filter.tags = { operator: 'in', value: tags } as PylonSearchFilterCondition;
    }
    if (title_contains) {
      filter.title = {
        operator: 'string_contains',
        value: title_contains,
      } as PylonSearchFilterCondition;
    }
    if (assignee_id) {
      filter.assignee_id = { operator: 'equals', value: assignee_id } as PylonSearchFilterCondition;
    }
    if (account_id) {
      filter.account_id = { operator: 'equals', value: account_id } as PylonSearchFilterCondition;
    }
    if (requester_id) {
      filter.requester_id = {
        operator: 'equals',
        value: requester_id,
      } as PylonSearchFilterCondition;
    }
    if (team_id) {
      filter.team_id = { operator: 'equals', value: team_id } as PylonSearchFilterCondition;
    }

    if (Object.keys(filter).length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error:
                'pylon_search_issues requires at least one filter parameter (e.g., state, tag, tags, title_contains, assignee_id, account_id, requester_id, or team_id). To list recent issues without filters, use pylon_get_issues instead.',
            }),
          },
        ],
      };
    }

    return jsonResponse(
      await ensurePylonClient().searchIssues({
        filter,
        limit,
      })
    );
  }
);

mcpServer.registerTool(
  'pylon_search_issues_by_status',
  {
    description:
      'Search issues by status name, including custom statuses like "Waiting on Eng Input" or "Escalated". Automatically maps status names to state+tag combinations. For multi-filter searches, use pylon_search_issues instead.',
    inputSchema: {
      status: z
        .string()
        .describe('Status name (built-in state or custom, e.g., "Waiting on Eng Input"). Case-insensitive.'),
      limit: z.number().optional().describe('Max results to return'),
    },
  },
  async ({ status, limit }) => {
    const result = await ensurePylonClient().searchIssuesByStatus(status, { limit });
    return jsonResponse({
      status_resolved: result.resolvedStatus,
      issue_count: result.issues.length,
      issues: result.issues,
    });
  }
);

// Similar Issues Helper Tools
mcpServer.registerTool(
  'pylon_find_similar_issues_for_requestor',
  {
    description: 'Find issues from the same requestor as the source issue to identify recurring patterns.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      query: z.string().optional().describe('Optional search terms; defaults to source issue title'),
      limit: z.number().optional().describe('Max results to return'),
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
    description: 'Find issues from the same company/account to identify company-wide problems.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      query: z.string().optional().describe('Optional search terms; defaults to source issue title'),
      limit: z.number().optional().describe('Max results to return'),
    },
  },
  async ({ issue_id, query, limit }) =>
    jsonResponse(await ensurePylonClient().findSimilarIssuesForAccount(issue_id, { query, limit }))
);

mcpServer.registerTool(
  'pylon_find_similar_issues_global',
  {
    description: 'Find similar issues across all accounts to identify widespread issues or find past solutions.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      query: z.string().optional().describe('Optional search terms; defaults to source issue title'),
      limit: z.number().optional().describe('Max results to return'),
    },
  },
  async ({ issue_id, query, limit }) =>
    jsonResponse(await ensurePylonClient().findSimilarIssuesGlobal(issue_id, { query, limit }))
);

mcpServer.registerTool(
  'pylon_snooze_issue',
  {
    description: 'Temporarily hide an issue until a future date/time for deferred follow-up.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      until: z.string().describe('Date/time to reactivate (ISO 8601, e.g., "2024-01-15T09:00:00Z")'),
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
    description: 'Get an issue with its full conversation history. Prefer pylon_get_issue when you only need issue details.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
    },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssueWithMessages(issue_id))
);

mcpServer.registerTool(
  'pylon_get_issue_messages',
  {
    description: 'Get the message history for an issue. Use when you need message content, not just issue metadata.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
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
    description: 'Get all knowledge bases in Pylon.',
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
    description: 'Create a new help article in a knowledge base.',
    inputSchema: {
      knowledge_base_id: z.string().describe('ID of the knowledge base'),
      title: z.string(),
      body_html: z.string().describe('Article content in HTML format'),
      author_user_id: z.string().optional().describe('User ID to attribute as author; defaults to authenticated user'),
      collection_id: z.string().optional().describe('ID of the collection to place the article in'),
      is_published: z.boolean().optional(),
      is_unlisted: z.boolean().optional(),
      slug: z.string().optional().describe('Custom URL slug; defaults to slug based on title'),
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
    description: 'Get all support teams in Pylon.',
  },
  async () => jsonResponse(await ensurePylonClient().getTeams())
);

mcpServer.registerTool(
  'pylon_get_team',
  {
    description: 'Get details of a specific support team including members and workload.',
    inputSchema: {
      team_id: z.string().describe('Pylon team ID'),
    },
  },
  async ({ team_id }) => jsonResponse(await ensurePylonClient().getTeam(team_id))
);

mcpServer.registerTool(
  'pylon_create_team',
  {
    description: 'Create a new support team in Pylon.',
    inputSchema: {
      name: z.string(),
      description: z.string().optional(),
      members: z.array(z.string()).optional().describe('Array of user IDs or emails of team members'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createTeam(args))
);

// Account Management Tools
mcpServer.registerTool(
  'pylon_get_accounts',
  {
    description: 'Get all customer accounts from Pylon.',
  },
  async () => jsonResponse(await ensurePylonClient().getAccounts())
);

mcpServer.registerTool(
  'pylon_get_account',
  {
    description: 'Get details of a specific customer account.',
    inputSchema: {
      account_id: z.string().describe('Pylon account ID'),
    },
  },
  async ({ account_id }) => jsonResponse(await ensurePylonClient().getAccount(account_id))
);

// Tag Management Tools
mcpServer.registerTool(
  'pylon_get_tags',
  {
    description: 'Get all available tags for categorizing issues and contacts.',
  },
  async () => jsonResponse(await ensurePylonClient().getTags())
);

mcpServer.registerTool(
  'pylon_create_tag',
  {
    description: 'Create a new tag for categorizing issues and contacts.',
    inputSchema: {
      name: z.string(),
      color: z.string().optional().describe('Tag color in hex or color name (e.g., "#FF0000" or "red")'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createTag(args))
);

// Ticket Form Tools
mcpServer.registerTool(
  'pylon_get_ticket_forms',
  {
    description: 'Get all ticket submission forms available to customers.',
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

// Note: the authoritative OpenAPI spec previously did not include GET /attachments/{id}.
// We implement pylon_get_attachment as a best-effort tool because attachments are
// often referenced by ID in message payloads.
// See: https://github.com/mgmonteleone/pylon-mcp/issues/24

mcpServer.registerTool(
  'pylon_get_attachment',
  {
    description: 'Get attachment metadata by ID. Use when you have an attachment_id from an issue message. Download the file using the returned URL.',
    inputSchema: {
      attachment_id: z.string().describe('Pylon attachment ID'),
    },
  },
  async ({ attachment_id }) => jsonResponse(await ensurePylonClient().getAttachment(attachment_id))
);

mcpServer.registerTool(
  'pylon_create_attachment_from_url',
  {
    description: 'Create a Pylon attachment by downloading a file from a public URL.',
    inputSchema: {
      file_url: z.string().describe('Publicly accessible URL of the file to attach'),
      description: z.string().optional(),
    },
  },
  async ({ file_url, description }) =>
    jsonResponse(await ensurePylonClient().createAttachmentFromUrl(file_url, description))
);

// External Issue Linking Tools

mcpServer.registerTool(
  'pylon_link_external_issue',
  {
    description: 'Link a Linear, Jira, GitHub, or Asana issue to a Pylon support issue for cross-system tracking.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      external_issue_id: z
        .string()
        .describe('ID of the external issue (e.g., "ABC-123" for Linear, "123" for GitHub)'),
      source: z
        .enum(['linear', 'jira', 'github', 'asana'])
        .describe('External system: "linear", "jira", "github", or "asana"'),
    },
  },
  async ({ issue_id, external_issue_id, source }) =>
    jsonResponse(await ensurePylonClient().linkExternalIssue(issue_id, external_issue_id, source))
);

mcpServer.registerTool(
  'pylon_unlink_external_issue',
  {
    description: 'Remove the link between a Pylon issue and an external ticketing system issue.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      external_issue_id: z.string().describe('ID of the external issue to unlink'),
      source: z
        .enum(['linear', 'jira', 'github', 'asana'])
        .describe('External system: "linear", "jira", "github", or "asana"'),
    },
  },
  async ({ issue_id, external_issue_id, source }) =>
    jsonResponse(await ensurePylonClient().unlinkExternalIssue(issue_id, external_issue_id, source))
);

// Issue Followers Management Tools

mcpServer.registerTool(
  'pylon_get_issue_followers',
  {
    description: 'Get all users and contacts following a Pylon issue.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
    },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssueFollowers(issue_id))
);

mcpServer.registerTool(
  'pylon_add_issue_followers',
  {
    description: 'Add team members (user_ids) or customers (contact_ids) as followers to a Pylon issue.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      user_ids: z.array(z.string()).optional().describe('Array of team member user IDs to add as followers'),
      contact_ids: z.array(z.string()).optional().describe('Array of customer contact IDs to add as followers'),
    },
  },
  async ({ issue_id, user_ids, contact_ids }) => {
    if ((!user_ids || user_ids.length === 0) && (!contact_ids || contact_ids.length === 0)) {
      throw new Error('At least one user_id or contact_id must be provided');
    }
    return jsonResponse(
      await ensurePylonClient().addIssueFollowers(issue_id, user_ids, contact_ids)
    );
  }
);

mcpServer.registerTool(
  'pylon_remove_issue_followers',
  {
    description: 'Remove team members or customers from following a Pylon issue.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID'),
      user_ids: z.array(z.string()).optional().describe('Array of team member user IDs to remove as followers'),
      contact_ids: z.array(z.string()).optional().describe('Array of customer contact IDs to remove as followers'),
    },
  },
  async ({ issue_id, user_ids, contact_ids }) => {
    if ((!user_ids || user_ids.length === 0) && (!contact_ids || contact_ids.length === 0)) {
      throw new Error('At least one user_id or contact_id must be provided');
    }
    return jsonResponse(
      await ensurePylonClient().removeIssueFollowers(issue_id, user_ids, contact_ids)
    );
  }
);

// Issue Deletion Tool

mcpServer.registerTool(
  'pylon_delete_issue',
  {
    description: '⚠️ Permanently delete a Pylon issue. This cannot be undone. Verify the correct issue ID before proceeding.',
    inputSchema: {
      issue_id: z.string().describe('Pylon issue ID to permanently delete'),
    },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().deleteIssue(issue_id))
);

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('Pylon MCP Server running on stdio');

  let isShuttingDown = false;
  async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.error('Pylon MCP Server shutting down...');
    try {
      await mcpServer.close();
    } catch (err) {
      console.error('Error during shutdown:', err);
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('close', shutdown);
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
