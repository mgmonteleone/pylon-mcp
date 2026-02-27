import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import nock from 'nock';
import { PylonClient } from '../src/pylon-client.js';

describe('PylonClient - Enhanced Error Handling', () => {
  const BASE_URL = 'https://api.usepylon.com';
  let client: PylonClient;

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(() => {
    // Disable retries so error-handling tests fail fast without retry delays
    client = new PylonClient({ apiToken: 'test-token', baseUrl: BASE_URL, maxRetries: 0 });
  });

  afterEach(() => {
    client.destroy();
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  describe('Error Message Enhancement', () => {
    it('should extract error message from Pylon API response with "error" field', async () => {
      nock(BASE_URL)
        .get('/issues/issue_123')
        .reply(400, { error: "Invalid filter operator 'xyz' for field 'state'" });

      try {
        await client.getIssue('issue_123');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe(
          "Pylon API error (400): Invalid filter operator 'xyz' for field 'state'"
        );
        expect(error.status).toBe(400);
        expect(error.apiError).toEqual({
          error: "Invalid filter operator 'xyz' for field 'state'",
        });
      }
    });

    it('should extract error message from Pylon API response with "message" field', async () => {
      nock(BASE_URL).get('/me').reply(401, { message: 'Invalid or expired API token' });

      try {
        await client.getMe();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Pylon API error (401): Invalid or expired API token');
        expect(error.status).toBe(401);
        expect(error.apiError.message).toBe('Invalid or expired API token');
      }
    });

    it('should JSON.stringify error data when no error or message field present', async () => {
      nock(BASE_URL)
        .get('/issues/issue_123')
        .reply(422, { code: 'VALIDATION_ERROR', fields: ['title', 'description'] });

      try {
        await client.getIssue('issue_123');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Pylon API error (422):');
        expect(error.message).toContain('VALIDATION_ERROR');
        expect(error.status).toBe(422);
      }
    });

    it('should preserve original error on enhanced error', async () => {
      nock(BASE_URL).get('/issues/nonexistent').reply(404, { error: 'Issue not found' });

      try {
        await client.getIssue('nonexistent');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Pylon API error (404): Issue not found');
        expect(error.originalError).toBeDefined();
        expect(error.originalError.response.status).toBe(404);
      }
    });

    it('should pass through errors without response data', async () => {
      nock(BASE_URL).get('/issues').replyWithError('Network error');

      await expect(client.getIssues()).rejects.toThrow('Network error');
    });

    it('should handle 500 errors with API error details', async () => {
      // Single mock: retries disabled in beforeEach (maxRetries: 0)
      nock(BASE_URL).post('/issues').reply(500, { error: 'Database connection failed' });

      try {
        await client.createIssue({
          title: 'Test',
          description: 'Test',
          status: 'open',
          priority: 'low',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Pylon API error (500): Database connection failed');
        expect(error.status).toBe(500);
      }
    });

    it('should prefer "error" field over "message" field', async () => {
      nock(BASE_URL)
        .get('/issues/issue_123')
        .reply(400, { error: 'Primary error message', message: 'Secondary message' });

      try {
        await client.getIssue('issue_123');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Pylon API error (400): Primary error message');
      }
    });
  });

  describe('Debug Logging', () => {
    afterEach(() => {
      delete process.env.PYLON_DEBUG;
    });

    it('should enable debug logging when PYLON_DEBUG=true', () => {
      process.env.PYLON_DEBUG = 'true';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const debugClient = new PylonClient({ apiToken: 'test-token' });
      const axiosInstance = (debugClient as any).client;

      // Check that interceptors were added (debug adds 2 interceptors, error adds 1)
      // Request interceptors: 1 for debug
      // Response interceptors: 1 for debug + 1 for error enhancement
      expect(axiosInstance.interceptors.request.handlers.length).toBeGreaterThanOrEqual(1);
      expect(axiosInstance.interceptors.response.handlers.length).toBeGreaterThanOrEqual(2);

      debugClient.destroy();
      consoleSpy.mockRestore();
    });

    it('should not enable debug logging when PYLON_DEBUG is not set', () => {
      delete process.env.PYLON_DEBUG;

      const nonDebugClient = new PylonClient({ apiToken: 'test-token' });
      const axiosInstance = (nonDebugClient as any).client;

      // Retry interceptor + error enhancement interceptor (no debug interceptors)
      expect(axiosInstance.interceptors.request.handlers.length).toBe(0);
      expect(axiosInstance.interceptors.response.handlers.length).toBe(2);

      nonDebugClient.destroy();
    });

    it('should not enable debug logging when PYLON_DEBUG is false', () => {
      process.env.PYLON_DEBUG = 'false';

      const nonDebugClient = new PylonClient({ apiToken: 'test-token' });
      const axiosInstance = (nonDebugClient as any).client;

      // Retry interceptor + error enhancement interceptor (no debug interceptors)
      expect(axiosInstance.interceptors.request.handlers.length).toBe(0);
      expect(axiosInstance.interceptors.response.handlers.length).toBe(2);

      nonDebugClient.destroy();
    });
  });
});
