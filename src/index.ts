#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ElicitRequestFormParams } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PylonClient } from './pylon-client.js';

// Environment variable to control whether elicitation is required for customer-facing messages
const REQUIRE_MESSAGE_CONFIRMATION = process.env.PYLON_REQUIRE_MESSAGE_CONFIRMATION !== 'false';

const PYLON_API_TOKEN = process.env.PYLON_API_TOKEN;

// Initialize client only when token is available
let pylonClient: PylonClient | null = null;

if (PYLON_API_TOKEN) {
  pylonClient = new PylonClient({
    apiToken: PYLON_API_TOKEN,
  });
}

// Create the McpServer instance (high-level API, replaces deprecated Server class)
const mcpServer = new McpServer({
  name: 'pylon-mcp-server',
  version: '1.4.0',
});

/**
 * Helper function to request user confirmation before sending customer-facing messages.
 * Uses MCP elicitation to prompt the user to review and confirm the message content.
 *
 * @param issueId - The ID of the issue the message will be sent to
 * @param content - The message content to be confirmed
 * @returns Object with confirmed: boolean and optionally the confirmed/modified content
 */
async function requestMessageConfirmation(
  issueId: string,
  content: string
): Promise<{ confirmed: boolean; content?: string; reason?: string }> {
  try {
    const elicitParams: ElicitRequestFormParams = {
      mode: 'form',
      message: `⚠️ CUSTOMER-FACING MESSAGE CONFIRMATION\n\nYou are about to send the following message to a customer on issue ${issueId}:\n\n---\n${content}\n---\n\nPlease review and confirm you want to send this message.`,
      requestedSchema: {
        type: 'object',
        properties: {
          confirm_send: {
            type: 'boolean',
            title: 'Confirm Send',
            description: 'Check this box to confirm you want to send this message to the customer',
            default: false,
          },
          modified_content: {
            type: 'string',
            title: 'Message Content (optional edit)',
            description: 'You can modify the message content here before sending. Leave empty to use the original message.',
          },
        },
        required: ['confirm_send'],
      },
    };

    // Access elicitInput via the underlying Server instance
    const result = await mcpServer.server.elicitInput(elicitParams);

    if (result.action === 'accept' && result.content) {
      const confirmSend = result.content.confirm_send as boolean;
      const modifiedContent = result.content.modified_content as string | undefined;

      if (confirmSend) {
        return {
          confirmed: true,
          content: modifiedContent && modifiedContent.trim() ? modifiedContent.trim() : content,
        };
      } else {
        return {
          confirmed: false,
          reason: 'User did not confirm the message send',
        };
      }
    } else if (result.action === 'decline') {
      return {
        confirmed: false,
        reason: 'User explicitly declined to send the message',
      };
    } else {
      return {
        confirmed: false,
        reason: 'User cancelled the confirmation dialog',
      };
    }
  } catch (error) {
    // If elicitation is not supported by the client, log a warning and proceed
    // This maintains backwards compatibility with clients that don't support elicitation
    console.error('Elicitation not available or failed:', error);
    throw new Error(
      'Message confirmation is required but the MCP client does not support elicitation. ' +
      'Please use a client that supports MCP elicitation, or set PYLON_REQUIRE_MESSAGE_CONFIRMATION=false to disable this safety feature.'

    );
  }
}

// Helper function to ensure pylonClient is initialized
function ensurePylonClient(): PylonClient {
  if (!pylonClient) {
    throw new Error('PYLON_API_TOKEN environment variable is required');
  }
  return pylonClient;
}

// Helper to create a JSON text response
function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// Register all tools using the McpServer.registerTool() pattern

// User Management Tools
mcpServer.registerTool(
  'pylon_get_me',
  { description: 'Get current user information from Pylon. Returns your user profile including name, email, role, and permissions. Use this to verify your authentication and see what access level you have.' },
  async () => jsonResponse(await ensurePylonClient().getMe())
);

mcpServer.registerTool(
  'pylon_get_users',
  { description: 'Get all team members and support agents in your Pylon workspace. Returns user profiles including names, roles, teams, and availability status.' },
  async () => jsonResponse(await ensurePylonClient().getUsers())
);

mcpServer.registerTool(
  'pylon_search_users',
  {
    description: 'Search for team members and support agents in Pylon. Use this to find colleagues by name, email, or department when assigning issues or checking availability.',
    inputSchema: { query: z.string().describe('Search term to find users by name, email, or department. Examples: "john", "support@company.com", "technical team"') },
  },
  async ({ query }) => jsonResponse(await ensurePylonClient().searchUsers(query))
);

// Contact Management Tools
mcpServer.registerTool(
  'pylon_get_contacts',
  {
    description: 'Get customer contacts from Pylon. Use this to find customers who have submitted support tickets or inquiries. Returns contact details like name, email, company, and contact history.',
    inputSchema: {
      search: z.string().optional().describe('Search contacts by name, email, or company. Examples: "john@example.com", "Acme Corp", "John Smith"'),
      limit: z.number().optional().describe('Maximum number of contacts to return (1-100). Default is 20. Example: 50'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().getContacts(args))
);

mcpServer.registerTool(
  'pylon_create_contact',
  {
    description: 'Create a new customer contact in Pylon. Use this when adding a new customer who will submit support requests or access your customer portal. Use this carefully.',
    inputSchema: {
      email: z.string().describe('Contact email address. Must be valid email format. Example: "sarah@company.com"'),
      name: z.string().describe('Full name of the contact. Example: "Sarah Johnson"'),
      portal_role: z.string().optional().describe('Role in customer portal: "admin", "member", "viewer". Determines access level. Example: "member"'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createContact(args))
);

mcpServer.registerTool(
  'pylon_search_contacts',
  {
    description: 'Search for customer contacts in Pylon by name, email, company, or other details. Use this to quickly find a specific customer when you need to view their information or create an issue for them.',
    inputSchema: { query: z.string().describe('Search term to find contacts. Can search by name, email, company, or phone. Examples: "alice@example.com", "Acme Corporation", "John Smith", "+1-555-0123"') },
  },
  async ({ query }) => jsonResponse(await ensurePylonClient().searchContacts(query))
);

// Issue Management Tools
mcpServer.registerTool(
  'pylon_get_issues',
  {
    description: 'Get support issues/tickets from Pylon. Returns a list of customer support requests with details like title, status, priority, and assigned team member. Use this to see your workload or find specific issues.',
    inputSchema: {
      assignee: z.string().optional().describe('Filter by assigned team member. Use email or user ID. Examples: "john@support.com", "user_123"'),
      status: z.string().optional().describe('Filter by issue status. Options: "open", "in_progress", "pending", "resolved", "closed". Example: "open"'),
      limit: z.number().optional().describe('Maximum number of issues to return (1-100). Default is 50. Example: 25'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().getIssues(args))
);

mcpServer.registerTool(
  'pylon_create_issue',
  {
    description: 'Create a new support issue/ticket in Pylon. Use this to log customer problems, bug reports, or feature requests that need to be tracked and resolved.',
    inputSchema: {
      title: z.string().describe('Brief title describing the issue. Examples: "Login page not loading", "Cannot upload files", "Billing question"'),
      description: z.string().describe('Detailed description of the issue, including steps to reproduce and impact. Example: "User reports that clicking login button shows error message. Affects all Chrome users on Windows."'),
      status: z.string().describe('Initial status: "open", "in_progress", "pending", "resolved", "closed". Usually "open" for new issues. Example: "open"'),
      priority: z.string().describe('Priority level: "low", "medium", "high", "urgent". Example: "high"'),
      assignee: z.string().optional().describe('Team member to assign (optional). Use email or user ID. Example: "support@company.com"'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createIssue(args))
);

mcpServer.registerTool(
  'pylon_get_issue',
  {
    description: 'Get complete details of a specific support issue/ticket. If you are given a ticket/issue number, call this tool first (no need to use the more complex message/history tools). Returns title, description, status, priority, assignee, customer info, and basic conversation metadata.',
    inputSchema: { issue_id: z.string().describe('ID (ticket/issue number) to retrieve. You can pass the user-provided ticket number directly; you do not need to call other tools first. Example: "36800"') },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssue(issue_id))
);

mcpServer.registerTool(
  'pylon_update_issue',
  {
    description: 'Update an existing support issue/ticket. Use this to change status (e.g., mark as resolved), reassign to different team members, update priority, or modify details as you work on the issue.',
    inputSchema: {
      issue_id: z.string().describe('ID of the issue to update. Example: "issue_abc123"'),
      title: z.string().optional().describe('New title for the issue. Example: "RESOLVED: Login page not loading"'),
      description: z.string().optional().describe('Updated description with new information or resolution details. Example: "Fixed CSS conflict causing login button to not render properly."'),
      status: z.string().optional().describe('New status: "open", "in_progress", "pending", "resolved", "closed". Example: "resolved"'),
      priority: z.string().optional().describe('New priority level: "low", "medium", "high", "urgent". Example: "medium"'),
      assignee: z.string().optional().describe('New assignee email or user ID. Example: "tech-lead@company.com"'),
    },
  },
  async ({ issue_id, ...updates }) => jsonResponse(await ensurePylonClient().updateIssue(issue_id, updates))
);

mcpServer.registerTool(
  'pylon_search_issues',
  {
    description: 'Search for support issues/tickets in Pylon by keywords, customer name, or issue content. Use this to find related issues, check for duplicates, or research similar problems.',
    inputSchema: {
      query: z.string().describe('Search term to find issues. Can search in titles, descriptions, and customer names. Examples: "login error", "billing question", "API timeout", "John Smith"'),
      filters: z.record(z.string(), z.unknown()).optional().describe('Additional filters as key-value pairs. Examples: {"status": "open", "priority": "high"}, {"assignee": "john@company.com", "created_after": "2024-01-01"}'),
    },
  },
  async ({ query, filters }) => jsonResponse(await ensurePylonClient().searchIssues(query, filters as Record<string, unknown> | undefined))
);

mcpServer.registerTool(
  'pylon_snooze_issue',
  {
    description: 'Temporarily hide an issue until a future date/time. Use this for issues that cannot be worked on now but need follow-up later (e.g., waiting for customer response, scheduled maintenance, feature release).',
    inputSchema: {
      issue_id: z.string().describe('ID of the issue to snooze. Example: "issue_abc123"'),
      until: z.string().describe('Date and time when issue should reappear (ISO 8601 format). Examples: "2024-01-15T09:00:00Z" (specific date/time), "2024-01-20T00:00:00Z" (beginning of day)'),
    },
  },
  async ({ issue_id, until }) => {
    await ensurePylonClient().snoozeIssue(issue_id, until);
    return jsonResponse({ success: true, message: 'Issue snoozed successfully', issue_id, snoozed_until: until });
  }
);

mcpServer.registerTool(
  'pylon_get_issue_with_messages',
  {
    description: 'Get a complete support issue with all its messages in a single call. Use this when you explicitly need the full conversation history. If you only need issue details and have a ticket number, prefer pylon_get_issue first; reach for this when message bodies are required.',
    inputSchema: { issue_id: z.string().describe('ID (ticket/issue number) to retrieve with messages. You can pass the user-provided ticket number directly. Example: "issue_abc123"') },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssueWithMessages(issue_id))
);

mcpServer.registerTool(
  'pylon_get_issue_messages',
  {
    description: 'Get the conversation history for a specific support issue. Use when you need message bodies only. If you have a ticket number and just need issue details, call pylon_get_issue first; use this when you specifically need the messages.',
    inputSchema: { issue_id: z.string().describe('ID (ticket/issue number) of the issue to get messages for. You can pass the user-provided ticket number directly. Example: "issue_abc123"') },
  },
  async ({ issue_id }) => jsonResponse(await ensurePylonClient().getIssueMessages(issue_id))
);

// Message creation with elicitation confirmation
mcpServer.registerTool(
  'pylon_create_issue_message',
  {
    description: 'Add a new message/reply to a support issue conversation. Use this to respond to customers, add internal notes, or provide updates on issue progress. ⚠️ IMPORTANT: This tool sends customer-facing messages and requires user confirmation before sending. The user will be prompted to review and approve the message content.',
    inputSchema: {
      issue_id: z.string().describe('ID of the issue to add message to. Example: "issue_abc123"'),
      content: z.string().describe('Message text to send. Can include formatting and links. Examples: "Hi John, I\'ve escalated this to our dev team. You should see a fix by tomorrow.", "**Internal note:** This appears to be related to the server migration last week."'),
    },
  },
  async ({ issue_id, content }) => {
    let messageContent = content;

    // Request user confirmation before sending customer-facing messages
    if (REQUIRE_MESSAGE_CONFIRMATION) {
      const confirmation = await requestMessageConfirmation(issue_id, messageContent);

      if (!confirmation.confirmed) {
        return jsonResponse({
          success: false,
          message: 'Message not sent - user did not confirm',
          reason: confirmation.reason,
          issue_id,
          original_content: messageContent,
        });
      }

      // Use the potentially modified content from the confirmation
      if (confirmation.content) {
        messageContent = confirmation.content;
      }
    }

    return jsonResponse(await ensurePylonClient().createIssueMessage(issue_id, messageContent));
  }
);

// Knowledge Base Tools
mcpServer.registerTool(
  'pylon_get_knowledge_bases',
  { description: 'Get all knowledge bases from Pylon. Knowledge bases contain help articles, FAQs, and documentation that customers can access. Returns list of available knowledge bases with their names and article counts.' },
  async () => jsonResponse(await ensurePylonClient().getKnowledgeBases())
);

mcpServer.registerTool(
  'pylon_get_knowledge_base_articles',
  {
    description: 'Get help articles from a specific knowledge base. Use this to find existing documentation that might help resolve customer issues or to see what self-service content is available.',
    inputSchema: { knowledge_base_id: z.string().describe('ID of the knowledge base to get articles from. Get this from pylon_get_knowledge_bases first. Example: "kb_123abc"') },
  },
  async ({ knowledge_base_id }) => jsonResponse(await ensurePylonClient().getKnowledgeBaseArticles(knowledge_base_id))
);

mcpServer.registerTool(
  'pylon_create_knowledge_base_article',
  {
    description: 'Create a new help article in a knowledge base. Use this to add new documentation, FAQs, or troubleshooting guides that customers can access for self-service support.',
    inputSchema: {
      knowledge_base_id: z.string().describe('ID of the knowledge base to add article to. Example: "kb_123abc"'),
      title: z.string().describe('Article title that clearly describes the topic. Examples: "How to Reset Your Password", "Troubleshooting Login Issues", "Billing FAQ"'),
      content: z.string().describe('Full article content in markdown or HTML format. Include step-by-step instructions, screenshots, and links. Example: "## Steps to Reset Password\\n1. Go to login page\\n2. Click Forgot Password..."'),
    },
  },
  async ({ knowledge_base_id, title, content }) => jsonResponse(await ensurePylonClient().createKnowledgeBaseArticle(knowledge_base_id, { title, content }))
);

// Team Management Tools
mcpServer.registerTool(
  'pylon_get_teams',
  { description: 'Get all support teams from Pylon. Teams are groups of support agents that handle different types of issues (e.g., Technical, Billing, Sales). Returns team names, member counts, and specializations.' },
  async () => jsonResponse(await ensurePylonClient().getTeams())
);

mcpServer.registerTool(
  'pylon_get_team',
  {
    description: 'Get detailed information about a specific support team. Returns team members, their roles, current workload, and team performance metrics.',
    inputSchema: { team_id: z.string().describe('ID of the team to get details for. Get this from pylon_get_teams first. Example: "team_456def"') },
  },
  async ({ team_id }) => jsonResponse(await ensurePylonClient().getTeam(team_id))
);

mcpServer.registerTool(
  'pylon_create_team',
  {
    description: 'Create a new support team in Pylon. Use this to organize support agents into specialized groups for handling different types of customer issues (e.g., Technical Support, Billing, Enterprise accounts).',
    inputSchema: {
      name: z.string().describe('Team name that describes their specialization. Examples: "Technical Support", "Billing Team", "Enterprise Support", "Level 2 Support"'),
      description: z.string().optional().describe('Description of team responsibilities and expertise. Example: "Handles complex technical issues, API questions, and integration support"'),
      members: z.array(z.string()).optional().describe('Array of user IDs or emails of team members. Example: ["john@company.com", "user_123", "sarah@company.com"]'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createTeam(args))
);

// Account Management Tools
mcpServer.registerTool(
  'pylon_get_accounts',
  { description: 'Get all customer accounts from Pylon. Accounts represent companies or organizations that use your service. Returns account details like company name, subscription level, and contact information.' },
  async () => jsonResponse(await ensurePylonClient().getAccounts())
);

mcpServer.registerTool(
  'pylon_get_account',
  {
    description: 'Get detailed information about a specific customer account. Returns company details, subscription info, billing status, and associated contacts and issues.',
    inputSchema: { account_id: z.string().describe('ID of the account to get details for. Get this from pylon_get_accounts or customer records. Example: "acc_789xyz"') },
  },
  async ({ account_id }) => jsonResponse(await ensurePylonClient().getAccount(account_id))
);

// Tag Management Tools
mcpServer.registerTool(
  'pylon_get_tags',
  { description: 'Get all available tags for categorizing issues and contacts. Tags help organize and filter support tickets by topic, urgency, or type (e.g., "bug", "feature-request", "billing", "urgent").' },
  async () => jsonResponse(await ensurePylonClient().getTags())
);

mcpServer.registerTool(
  'pylon_create_tag',
  {
    description: 'Create a new tag for categorizing issues and contacts. Use this to add new categories that help organize and filter your support tickets effectively.',
    inputSchema: {
      name: z.string().describe('Tag name that describes the category. Examples: "billing-question", "feature-request", "bug-report", "urgent", "enterprise-customer"'),
      color: z.string().optional().describe('Color for the tag in hex format or color name. Examples: "#FF0000", "red", "#00AA00", "blue"'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createTag(args))
);

// Ticket Form Tools
mcpServer.registerTool(
  'pylon_get_ticket_forms',
  { description: 'Get all ticket submission forms available to customers. Forms define what information customers provide when creating new support requests (e.g., bug report form, billing inquiry form).' },
  async () => jsonResponse(await ensurePylonClient().getTicketForms())
);

mcpServer.registerTool(
  'pylon_create_ticket_form',
  {
    description: 'Create a new ticket submission form for customers. Use this to customize what information customers provide when creating different types of support requests (bug reports, feature requests, billing questions).',
    inputSchema: {
      name: z.string().describe('Form name that describes its purpose. Examples: "Bug Report Form", "Billing Inquiry", "Feature Request", "Technical Support"'),
      description: z.string().optional().describe('Description shown to customers explaining when to use this form. Example: "Use this form to report bugs or technical issues with our software."'),
      fields: z.array(z.record(z.string(), z.unknown())).describe('Array of form field objects defining what information to collect. Example: [{"type": "text", "name": "summary", "required": true}, {"type": "textarea", "name": "steps_to_reproduce"}, {"type": "select", "name": "browser", "options": ["Chrome", "Firefox", "Safari"]}]'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createTicketForm(args as { name: string; description?: string; fields: Record<string, unknown>[] }))
);

// Webhook Management Tools
mcpServer.registerTool(
  'pylon_get_webhooks',
  { description: 'Get all configured webhooks in Pylon. Webhooks automatically send notifications to external systems when events occur (e.g., new issues created, status changes, messages added).' },
  async () => jsonResponse(await ensurePylonClient().getWebhooks())
);

mcpServer.registerTool(
  'pylon_create_webhook',
  {
    description: 'Create a new webhook to automatically notify external systems when events occur in Pylon. Use this to integrate with Slack, Discord, email systems, or custom applications.',
    inputSchema: {
      url: z.string().describe('HTTPS URL where webhook payloads will be sent. Must be publicly accessible. Examples: "https://hooks.slack.com/services/...", "https://api.myapp.com/webhooks/pylon"'),
      events: z.array(z.string()).describe('Array of events to trigger webhook. Examples: ["issue.created", "issue.updated", "issue.resolved"], ["message.created"], ["contact.created", "team.assigned"]'),
      active: z.boolean().optional().describe('Whether webhook should start active immediately. Default is true. Example: true'),
    },
  },
  async (args) => jsonResponse(await ensurePylonClient().createWebhook({ ...args, active: args.active ?? true }))
);

mcpServer.registerTool(
  'pylon_delete_webhook',
  {
    description: 'Delete an existing webhook to stop sending notifications to an external system. Use this when removing integrations or cleaning up unused webhooks.',
    inputSchema: { webhook_id: z.string().describe('ID of the webhook to delete. Get this from pylon_get_webhooks. Example: "webhook_xyz789"') },
  },
  async ({ webhook_id }) => {
    await ensurePylonClient().deleteWebhook(webhook_id);
    return jsonResponse({ success: true, message: 'Webhook deleted successfully', webhook_id });
  }
);

// Attachment Management Tools
mcpServer.registerTool(
  'pylon_get_attachment',
  {
    description: 'Get details of a specific attachment from Pylon. Returns attachment metadata including ID, name, URL, and description. Use this to retrieve information about files attached to messages.',
    inputSchema: { attachment_id: z.string().describe('ID of the attachment to retrieve. Get this from message attachments array. Example: "att_abc123"') },
  },
  async ({ attachment_id }) => jsonResponse(await ensurePylonClient().getAttachment(attachment_id))
);

mcpServer.registerTool(
  'pylon_create_attachment_from_url',
  {
    description: 'Create an attachment in Pylon from a URL. Downloads the file from the provided URL and creates an attachment that can be used in messages or knowledge base articles. Returns the attachment details including the Pylon-hosted URL.',
    inputSchema: {
      file_url: z.string().describe('URL of the file to download and attach. Must be publicly accessible. Example: "https://example.com/document.pdf"'),
      description: z.string().optional().describe('Optional description of the attachment. Example: "Product specification document"'),
    },
  },
  async ({ file_url, description }) => jsonResponse(await ensurePylonClient().createAttachmentFromUrl(file_url, description))
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