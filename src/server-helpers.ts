/**
 * Server helper functions and utilities for the Pylon MCP Server.
 * Extracted for testability.
 */

import { PylonClient } from './pylon-client.js';

/**
 * Parse and validate the PYLON_CACHE_TTL environment variable.
 * @param envValue - The raw environment variable value
 * @returns The parsed TTL value, or undefined if not set
 * @throws Error if the value is set but not a valid number
 */
export function parseCacheTtl(envValue: string | undefined): number | undefined {
  if (envValue === undefined) {
    return undefined;
  }
  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid PYLON_CACHE_TTL value: "${envValue}". Must be a valid number.`);
  }
  return parsed;
}

/**
 * Determine if message confirmation is required based on environment variable.
 * @param envValue - The PYLON_REQUIRE_MESSAGE_CONFIRMATION env var value
 * @returns true if confirmation is required, false otherwise
 */
export function isMessageConfirmationRequired(envValue: string | undefined): boolean {
  return envValue !== 'false';
}

/**
 * Create a PylonClient instance if the API token is available.
 * @param apiToken - The Pylon API token
 * @param cacheTtl - Optional cache TTL in milliseconds
 * @returns PylonClient instance or null if no token
 */
export function createPylonClient(
  apiToken: string | undefined,
  cacheTtl?: number
): PylonClient | null {
  if (!apiToken) {
    return null;
  }
  return new PylonClient({
    apiToken,
    cacheTtl,
  });
}

/**
 * Helper function to ensure pylonClient is initialized.
 * @param client - The PylonClient instance (may be null)
 * @returns The PylonClient instance
 * @throws Error if client is null
 */
export function ensurePylonClient(client: PylonClient | null): PylonClient {
  if (!client) {
    throw new Error('PYLON_API_TOKEN environment variable is required');
  }
  return client;
}

/**
 * Helper to create a JSON text response for MCP tools.
 * @param data - The data to serialize
 * @returns MCP tool response with JSON content
 */
export function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * Process elicitation result for message confirmation.
 * @param result - The elicitation result from MCP
 * @param originalContent - The original message content
 * @returns Confirmation result with confirmed status and content
 */
export function processElicitationResult(
  result: { action: string; content?: Record<string, unknown> },
  originalContent: string
): { confirmed: boolean; content?: string; reason?: string } {
  if (result.action === 'accept' && result.content) {
    const confirmSend = result.content.confirm_send as boolean;
    const modifiedContent = result.content.modified_content as string | undefined;

    if (confirmSend) {
      return {
        confirmed: true,
        content: modifiedContent && modifiedContent.trim() ? modifiedContent.trim() : originalContent,
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
}

/**
 * Build the elicitation message for message confirmation.
 * @param issueId - The issue ID
 * @param content - The message content
 * @returns The formatted elicitation message
 */
export function buildElicitationMessage(issueId: string, content: string): string {
  return `⚠️ CUSTOMER-FACING MESSAGE CONFIRMATION\n\nYou are about to send the following message to a customer on issue ${issueId}:\n\n---\n${content}\n---\n\nPlease review and confirm you want to send this message.`;
}

/**
 * Build the elicitation schema for message confirmation.
 * @returns The JSON schema for the elicitation form
 */
export function buildElicitationSchema() {
  return {
    type: 'object' as const,
    properties: {
      confirm_send: {
        type: 'boolean' as const,
        title: 'Confirm Send',
        description: 'Check this box to confirm you want to send this message to the customer',
        default: false,
      },
      modified_content: {
        type: 'string' as const,
        title: 'Message Content (optional edit)',
        description:
          'You can modify the message content here before sending. Leave empty to use the original message.',
      },
    },
    required: ['confirm_send'] as string[],
  };
}

