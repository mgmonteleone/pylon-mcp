import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseCacheTtl,
  createPylonClient,
  ensurePylonClient,
  jsonResponse,
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
});
