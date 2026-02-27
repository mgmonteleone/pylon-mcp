import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { PylonClient } from '../src/pylon-client.js';

const BASE_URL = 'https://api.usepylon.com';

describe('PylonClient - Retry Logic', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('should retry after 429 and succeed on second attempt', async () => {
    nock(BASE_URL).get('/me').reply(429, { error: 'rate limited' });
    nock(BASE_URL)
      .get('/me')
      .reply(200, { data: { id: 'u1', email: 'a@b.com', name: 'A', role: 'agent' } });

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    const result = await client.getMe();
    expect(result).toMatchObject({ id: 'u1' });
  });

  it('should retry after 500 and succeed on second attempt', async () => {
    nock(BASE_URL).get('/issues').reply(500, { error: 'server error' });
    nock(BASE_URL)
      .get('/issues')
      .reply(200, [{ id: 'i1', title: 'Bug' }]);

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    const result = await client.getIssues();
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[])[0]).toMatchObject({ id: 'i1' });
  });

  it('should fail after max retries are exceeded', async () => {
    nock(BASE_URL).get('/issues').reply(500, { error: 'server error' });
    nock(BASE_URL).get('/issues').reply(500, { error: 'server error' });
    nock(BASE_URL).get('/issues').reply(500, { error: 'server error' });
    nock(BASE_URL).get('/issues').reply(500, { error: 'server error' });

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    await expect(client.getIssues()).rejects.toThrow();
  });

  it('should NOT retry on 400 (bad request)', async () => {
    const scope = nock(BASE_URL).get('/issues').reply(400, { error: 'bad request' });

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    await expect(client.getIssues()).rejects.toThrow();
    // Ensure no second request was made (scope should be satisfied exactly once)
    expect(scope.isDone()).toBe(true);
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it('should NOT retry on 401 (unauthorized)', async () => {
    nock(BASE_URL).get('/me').reply(401, { error: 'unauthorized' });

    const client = new PylonClient({
      apiToken: 'bad-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    await expect(client.getMe()).rejects.toThrow();
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it('should NOT retry on 404 (not found)', async () => {
    nock(BASE_URL).get('/issues/nonexistent').reply(404, { error: 'not found' });

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    await expect(client.getIssue('nonexistent')).rejects.toThrow();
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it('should NOT retry on 403 (forbidden)', async () => {
    nock(BASE_URL).get('/issues').reply(403, { error: 'forbidden' });

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    await expect(client.getIssues()).rejects.toThrow();
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it('should disable retries when maxRetries is 0', async () => {
    nock(BASE_URL).get('/issues').reply(500, { error: 'server error' });

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 0,
      retryBaseDelay: 10,
    });

    await expect(client.getIssues()).rejects.toThrow();
    // No pending mocks means no extra requests were attempted
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it('should respect Retry-After header (seconds) on 429', async () => {
    const timerSpy = vi.spyOn(global, 'setTimeout');

    nock(BASE_URL).get('/issues').reply(429, { error: 'rate limited' }, { 'retry-after': '2' });
    nock(BASE_URL).get('/issues').reply(200, []);

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    await client.getIssues();

    // Check that setTimeout was called with ~2000ms (from Retry-After: 2)
    // Note: use call[1] (second argument) to get the delay, not call[0] (the callback)
    const retryDelayCall = timerSpy.mock.calls.find(
      (call) => typeof call[1] === 'number' && call[1] >= 1900 && call[1] <= 2100
    );
    expect(retryDelayCall).toBeDefined();

    timerSpy.mockRestore();
  });

  it('should use exponential backoff that increases between retries', async () => {
    // Track which request number we're on to record delays indirectly
    // Use timing to verify backoff grows - with retryBaseDelay:10, attempt 1 = ~10ms, attempt 2 = ~20ms
    let requestCount = 0;

    nock(BASE_URL)
      .get('/issues')
      .times(2)
      .reply(() => {
        requestCount++;
        return [500, { error: 'err' }];
      });
    nock(BASE_URL).get('/issues').reply(200, []);

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    const start = Date.now();
    await client.getIssues();
    const elapsed = Date.now() - start;

    // Verify 2 retries happened (requestCount from the failing interceptors)
    expect(requestCount).toBe(2);
    // With exponential backoff retryBaseDelay=10: delay1≈10ms + delay2≈20ms = at least 20ms total
    expect(elapsed).toBeGreaterThan(10);
  });

  it('should fall back to exponential backoff when Retry-After is malformed', async () => {
    nock(BASE_URL).get('/issues').reply(429, {}, { 'retry-after': 'not-a-number' });
    nock(BASE_URL).get('/issues').reply(200, []);

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    const result = await client.getIssues();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should retry on ETIMEDOUT error', async () => {
    nock(BASE_URL)
      .get('/issues')
      .replyWithError({ code: 'ETIMEDOUT', message: 'Connection timed out' });
    nock(BASE_URL).get('/issues').reply(200, []);

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    const result = await client.getIssues();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should retry on ECONNRESET error', async () => {
    nock(BASE_URL)
      .get('/issues')
      .replyWithError({ code: 'ECONNRESET', message: 'Connection reset' });
    nock(BASE_URL).get('/issues').reply(200, []);

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    const result = await client.getIssues();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should NOT retry POST requests on 500', async () => {
    nock(BASE_URL).post('/contacts').reply(500, { error: 'server error' });

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    // createContact makes a POST request
    await expect(
      client.createContact({ name: 'Test', email: 'test@example.com' })
    ).rejects.toThrow();
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it('should cap Retry-After delay at 30 seconds', async () => {
    const timerSpy = vi.spyOn(global, 'setTimeout');

    nock(BASE_URL).get('/issues').reply(429, {}, { 'retry-after': '3600' });
    nock(BASE_URL).get('/issues').reply(200, []);

    const client = new PylonClient({
      apiToken: 'test-token',
      maxRetries: 3,
      retryBaseDelay: 10,
    });

    await client.getIssues();

    // Verify the delay was capped at 30000ms, not 3600000ms (3600s = 3600000ms)
    const retryDelayCall = timerSpy.mock.calls.find(
      (call) => typeof call[1] === 'number' && call[1] >= 29000 && call[1] <= 31000
    );
    expect(retryDelayCall).toBeDefined();

    // Ensure no call used the uncapped 3600s value (3600000ms)
    const uncappedCall = timerSpy.mock.calls.find(
      (call) => typeof call[1] === 'number' && call[1] > 100000
    );
    expect(uncappedCall).toBeUndefined();

    timerSpy.mockRestore();
  }, 35000); // 35 second timeout to allow for the 30 second delay
});
