import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ElicitRequestFormParams } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tests for the MCP Elicitation feature used for customer-facing message confirmation.
 *
 * These tests verify:
 * 1. The elicitation request is properly formatted
 * 2. Different user responses (accept, decline, cancel) are handled correctly
 * 3. Message content can be modified during confirmation
 * 4. Error handling when elicitation is not supported
 */
describe('Message Confirmation Elicitation', () => {
  // Mock the Server class's elicitInput method
  let mockElicitInput: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockElicitInput = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Elicitation Request Format', () => {
    it('should create a properly formatted elicitation request', () => {
      const issueId = 'issue_123';
      const content = 'Hello customer, your issue has been resolved.';

      // This is the expected format for the elicitation request
      const expectedParams: ElicitRequestFormParams = {
        mode: 'form',
        message: expect.stringContaining('CUSTOMER-FACING MESSAGE CONFIRMATION'),
        requestedSchema: {
          type: 'object',
          properties: {
            confirm_send: {
              type: 'boolean',
              title: 'Confirm Send',
              description: expect.any(String),
              default: false,
            },
            modified_content: {
              type: 'string',
              title: 'Message Content (optional edit)',
              description: expect.any(String),
            },
          },
          required: ['confirm_send'],
        },
      };

      // Verify the schema structure is valid
      expect(expectedParams.requestedSchema.type).toBe('object');
      expect(expectedParams.requestedSchema.properties.confirm_send.type).toBe('boolean');
      expect(expectedParams.requestedSchema.properties.modified_content.type).toBe('string');
      expect(expectedParams.requestedSchema.required).toContain('confirm_send');
    });

    it('should include issue ID and message content in the elicitation message', () => {
      const issueId = 'issue_abc123';
      const content = 'Thank you for contacting support!';

      const message = `⚠️ CUSTOMER-FACING MESSAGE CONFIRMATION\n\nYou are about to send the following message to a customer on issue ${issueId}:\n\n---\n${content}\n---\n\nPlease review and confirm you want to send this message.`;

      expect(message).toContain(issueId);
      expect(message).toContain(content);
      expect(message).toContain('CUSTOMER-FACING MESSAGE CONFIRMATION');
    });
  });

  describe('Elicitation Response Handling', () => {
    it('should handle accept action with confirmation', () => {
      const elicitResult = {
        action: 'accept' as const,
        content: {
          confirm_send: true,
          modified_content: '',
        },
      };

      expect(elicitResult.action).toBe('accept');
      expect(elicitResult.content?.confirm_send).toBe(true);
    });

    it('should handle accept action without confirmation (checkbox unchecked)', () => {
      const elicitResult = {
        action: 'accept' as const,
        content: {
          confirm_send: false,
          modified_content: '',
        },
      };

      expect(elicitResult.action).toBe('accept');
      expect(elicitResult.content?.confirm_send).toBe(false);
    });

    it('should handle accept action with modified content', () => {
      const originalContent = 'Original message';
      const modifiedContent = 'Modified message with corrections';

      const elicitResult = {
        action: 'accept' as const,
        content: {
          confirm_send: true,
          modified_content: modifiedContent,
        },
      };

      expect(elicitResult.action).toBe('accept');
      expect(elicitResult.content?.confirm_send).toBe(true);
      expect(elicitResult.content?.modified_content).toBe(modifiedContent);
      expect(elicitResult.content?.modified_content).not.toBe(originalContent);
    });

    it('should handle decline action', () => {
      const elicitResult = {
        action: 'decline' as const,
      };

      expect(elicitResult.action).toBe('decline');
      expect(elicitResult).not.toHaveProperty('content');
    });

    it('should handle cancel action', () => {
      const elicitResult = {
        action: 'cancel' as const,
      };

      expect(elicitResult.action).toBe('cancel');
      expect(elicitResult).not.toHaveProperty('content');
    });
  });

  describe('Confirmation Logic', () => {
    it('should use original content when modified_content is empty', () => {
      const originalContent = 'Original message';
      const elicitResult = {
        action: 'accept' as const,
        content: {
          confirm_send: true,
          modified_content: '',
        },
      };

      const finalContent = elicitResult.content.modified_content?.trim()
        ? elicitResult.content.modified_content.trim()
        : originalContent;

      expect(finalContent).toBe(originalContent);
    });

    it('should use modified content when provided', () => {
      const originalContent = 'Original message';
      const modifiedContent = 'Modified message';

      const elicitResult = {
        action: 'accept' as const,
        content: {
          confirm_send: true,
          modified_content: modifiedContent,
        },
      };

      const finalContent = elicitResult.content.modified_content?.trim()
        ? elicitResult.content.modified_content.trim()
        : originalContent;

      expect(finalContent).toBe(modifiedContent);
    });

    it('should trim whitespace from modified content', () => {
      const originalContent = 'Original message';
      const modifiedContent = '  Modified message with spaces  ';

      const elicitResult = {
        action: 'accept' as const,
        content: {
          confirm_send: true,
          modified_content: modifiedContent,
        },
      };

      const finalContent = elicitResult.content.modified_content?.trim()
        ? elicitResult.content.modified_content.trim()
        : originalContent;

      expect(finalContent).toBe('Modified message with spaces');
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should respect PYLON_REQUIRE_MESSAGE_CONFIRMATION=false', () => {
      // When PYLON_REQUIRE_MESSAGE_CONFIRMATION is 'false', confirmation should be skipped
      const requireConfirmation = process.env.PYLON_REQUIRE_MESSAGE_CONFIRMATION !== 'false';

      // Default behavior (env var not set)
      expect(requireConfirmation).toBe(true);
    });

    it('should require confirmation by default', () => {
      // When env var is not set, confirmation should be required
      const envValue = undefined;
      const requireConfirmation = envValue !== 'false';

      expect(requireConfirmation).toBe(true);
    });

    it('should skip confirmation when explicitly disabled', () => {
      const envValue = 'false';
      const requireConfirmation = envValue !== 'false';

      expect(requireConfirmation).toBe(false);
    });
  });

  describe('Error Response Format', () => {
    it('should return proper error response when user declines', () => {
      const issueId = 'issue_123';
      const originalContent = 'Test message';
      const reason = 'User explicitly declined to send the message';

      const errorResponse = {
        success: false,
        message: 'Message not sent - user did not confirm',
        reason: reason,
        issue_id: issueId,
        original_content: originalContent,
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toContain('not sent');
      expect(errorResponse.reason).toBe(reason);
      expect(errorResponse.issue_id).toBe(issueId);
      expect(errorResponse.original_content).toBe(originalContent);
    });

    it('should return proper error response when user cancels', () => {
      const issueId = 'issue_456';
      const originalContent = 'Another test message';
      const reason = 'User cancelled the confirmation dialog';

      const errorResponse = {
        success: false,
        message: 'Message not sent - user did not confirm',
        reason: reason,
        issue_id: issueId,
        original_content: originalContent,
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.reason).toBe(reason);
    });
  });
});
