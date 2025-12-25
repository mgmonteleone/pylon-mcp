import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseCacheTtl,
  isMessageConfirmationRequired,
  createPylonClient,
  ensurePylonClient,
  jsonResponse,
  processElicitationResult,
  buildElicitationMessage,
  buildElicitationSchema,
} from '../src/server-helpers.js';
import { PylonClient } from '../src/pylon-client.js';

describe('Server Helpers', () => {
  describe('parseCacheTtl', () => {
    it('should return undefined when env value is undefined', () => {
      expect(parseCacheTtl(undefined)).toBeUndefined();
    });

    it('should parse valid numeric string', () => {
      expect(parseCacheTtl('5000')).toBe(5000);
    });

    it('should parse zero', () => {
      expect(parseCacheTtl('0')).toBe(0);
    });

    it('should parse negative numbers', () => {
      expect(parseCacheTtl('-1000')).toBe(-1000);
    });

    it('should throw error for non-numeric string', () => {
      expect(() => parseCacheTtl('invalid')).toThrow('Invalid PYLON_CACHE_TTL value');
      expect(() => parseCacheTtl('invalid')).toThrow('Must be a valid integer');
    });

    it('should throw error for empty string', () => {
      expect(() => parseCacheTtl('')).toThrow('Invalid PYLON_CACHE_TTL value');
    });

    it('should throw error for string with spaces', () => {
      expect(() => parseCacheTtl('  ')).toThrow('Invalid PYLON_CACHE_TTL value');
    });

    it('should throw error for partial numeric prefix like "5000ms"', () => {
      expect(() => parseCacheTtl('5000ms')).toThrow('Invalid PYLON_CACHE_TTL value');
      expect(() => parseCacheTtl('5000ms')).toThrow('Must be a valid integer');
    });

    it('should throw error for floating point numbers', () => {
      expect(() => parseCacheTtl('5000.5')).toThrow('Invalid PYLON_CACHE_TTL value');
    });

    it('should handle values with leading/trailing whitespace', () => {
      expect(parseCacheTtl('  5000  ')).toBe(5000);
    });
  });

  describe('isMessageConfirmationRequired', () => {
    it('should return true when env value is undefined', () => {
      expect(isMessageConfirmationRequired(undefined)).toBe(true);
    });

    it('should return false when env value is "false"', () => {
      expect(isMessageConfirmationRequired('false')).toBe(false);
    });

    it('should return true for any other value', () => {
      expect(isMessageConfirmationRequired('true')).toBe(true);
      expect(isMessageConfirmationRequired('yes')).toBe(true);
      expect(isMessageConfirmationRequired('1')).toBe(true);
      expect(isMessageConfirmationRequired('')).toBe(true);
    });
  });

  describe('createPylonClient', () => {
    it('should return null when apiToken is undefined', () => {
      expect(createPylonClient(undefined)).toBeNull();
    });

    it('should return null when apiToken is empty string', () => {
      expect(createPylonClient('')).toBeNull();
    });

    it('should create PylonClient when apiToken is provided', () => {
      const client = createPylonClient('test-token');
      expect(client).toBeInstanceOf(PylonClient);
    });

    it('should pass cacheTtl to PylonClient', () => {
      const client = createPylonClient('test-token', 5000);
      expect(client).toBeInstanceOf(PylonClient);
      // Verify cache stats reflect the TTL
      const stats = client?.getCacheStats();
      expect(stats?.ttl).toBe(5000);
    });

    it('should disable cache when cacheTtl is 0', () => {
      const client = createPylonClient('test-token', 0);
      expect(client).toBeInstanceOf(PylonClient);
      // Cache should be disabled (null stats)
      const stats = client?.getCacheStats();
      expect(stats).toBeNull();
    });
  });

  describe('ensurePylonClient', () => {
    it('should throw error when client is null', () => {
      expect(() => ensurePylonClient(null)).toThrow(
        'PYLON_API_TOKEN environment variable is required'
      );
    });

    it('should return client when initialized', () => {
      const client = new PylonClient({ apiToken: 'test-token' });
      expect(ensurePylonClient(client)).toBe(client);
    });
  });

  describe('jsonResponse', () => {
    it('should format object as JSON text content', () => {
      const result = jsonResponse({ id: '123', name: 'Test' });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify({ id: '123', name: 'Test' }, null, 2));
    });

    it('should format array as JSON text content', () => {
      const result = jsonResponse([{ id: '1' }, { id: '2' }]);
      expect(result.content[0].text).toContain('"id": "1"');
      expect(result.content[0].text).toContain('"id": "2"');
    });

    it('should handle null', () => {
      expect(jsonResponse(null).content[0].text).toBe('null');
    });

    it('should handle undefined by returning "null" string', () => {
      // JSON.stringify(undefined) returns undefined, but we ensure it's always a string
      expect(jsonResponse(undefined).content[0].text).toBe('null');
    });

    it('should handle nested objects', () => {
      const data = { user: { name: 'John', email: 'john@example.com' } };
      const result = jsonResponse(data);
      expect(result.content[0].text).toContain('"name": "John"');
    });
  });

  describe('processElicitationResult', () => {
    const originalContent = 'Hello customer';

    it('should confirm when user accepts and checks confirm_send', () => {
      const result = processElicitationResult(
        { action: 'accept', content: { confirm_send: true, modified_content: '' } },
        originalContent
      );
      expect(result.confirmed).toBe(true);
      expect(result.content).toBe(originalContent);
    });

    it('should use modified content when provided', () => {
      const modifiedContent = 'Hello valued customer';
      const result = processElicitationResult(
        { action: 'accept', content: { confirm_send: true, modified_content: modifiedContent } },
        originalContent
      );
      expect(result.confirmed).toBe(true);
      expect(result.content).toBe(modifiedContent);
    });

    it('should trim whitespace from modified content', () => {
      const result = processElicitationResult(
        { action: 'accept', content: { confirm_send: true, modified_content: '  trimmed  ' } },
        originalContent
      );
      expect(result.content).toBe('trimmed');
    });

    it('should not confirm when user unchecks confirm_send', () => {
      const result = processElicitationResult(
        { action: 'accept', content: { confirm_send: false, modified_content: '' } },
        originalContent
      );
      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe('User did not confirm the message send');
    });

    it('should handle decline action', () => {
      const result = processElicitationResult({ action: 'decline' }, originalContent);
      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe('User explicitly declined to send the message');
    });

    it('should handle cancel action', () => {
      const result = processElicitationResult({ action: 'cancel' }, originalContent);
      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe('User cancelled the confirmation dialog');
    });

    it('should handle unknown action', () => {
      const result = processElicitationResult({ action: 'unknown' }, originalContent);
      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe('User cancelled the confirmation dialog');
    });

    it('should handle accept without content', () => {
      const result = processElicitationResult({ action: 'accept' }, originalContent);
      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe('User cancelled the confirmation dialog');
    });

    it('should handle non-string modified_content gracefully', () => {
      // modified_content could be a non-string at runtime since content is Record<string, unknown>
      const result = processElicitationResult(
        { action: 'accept', content: { confirm_send: true, modified_content: 12345 } },
        originalContent
      );
      expect(result.confirmed).toBe(true);
      // Should fall back to originalContent when modified_content is not a string
      expect(result.content).toBe(originalContent);
    });

    it('should handle null modified_content gracefully', () => {
      const result = processElicitationResult(
        { action: 'accept', content: { confirm_send: true, modified_content: null } },
        originalContent
      );
      expect(result.confirmed).toBe(true);
      expect(result.content).toBe(originalContent);
    });
  });

  describe('buildElicitationMessage', () => {
    it('should include issue ID in message', () => {
      const message = buildElicitationMessage('issue_123', 'Test content');
      expect(message).toContain('issue_123');
    });

    it('should include content in message', () => {
      const message = buildElicitationMessage('issue_123', 'Test content');
      expect(message).toContain('Test content');
    });

    it('should include warning header', () => {
      const message = buildElicitationMessage('issue_123', 'Test content');
      expect(message).toContain('CUSTOMER-FACING MESSAGE CONFIRMATION');
    });
  });

  describe('buildElicitationSchema', () => {
    it('should return valid schema structure', () => {
      const schema = buildElicitationSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('confirm_send');
    });

    it('should have confirm_send property', () => {
      const schema = buildElicitationSchema();
      expect(schema.properties.confirm_send).toBeDefined();
      expect(schema.properties.confirm_send.type).toBe('boolean');
      expect(schema.properties.confirm_send.default).toBe(false);
    });

    it('should have modified_content property', () => {
      const schema = buildElicitationSchema();
      expect(schema.properties.modified_content).toBeDefined();
      expect(schema.properties.modified_content.type).toBe('string');
    });
  });
});
