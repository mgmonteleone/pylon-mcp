import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { PylonClient } from '../src/pylon-client';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('PylonClient - Caching', () => {
  let client: PylonClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockedAxios as any);
  });

  afterEach(() => {
    // Clean up cache intervals to prevent memory leaks
    if (client) {
      client.destroy();
    }
    vi.restoreAllMocks();
  });

  describe('Cache Configuration', () => {
    it('should enable cache by default with 30s TTL and 1000 max size', () => {
      client = new PylonClient({ apiToken: 'test-token' });
      const stats = client.getCacheStats();
      expect(stats).not.toBeNull();
      expect(stats?.ttl).toBe(30000);
      expect(stats?.maxSize).toBe(1000);
    });

    it('should allow custom TTL configuration', () => {
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 60000 });
      const stats = client.getCacheStats();
      expect(stats?.ttl).toBe(60000);
      expect(stats?.maxSize).toBe(1000);
    });

    it('should allow custom max cache size configuration', () => {
      client = new PylonClient({ apiToken: 'test-token', maxCacheSize: 500 });
      const stats = client.getCacheStats();
      expect(stats?.maxSize).toBe(500);
    });

    it('should disable cache when TTL is 0', () => {
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 0 });
      const stats = client.getCacheStats();
      expect(stats).toBeNull();
    });
  });

  describe('Cache Hits and Misses', () => {
    beforeEach(() => {
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 30000 });
    });

    it('should cache GET requests and return cached data on subsequent calls', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' };
      mockedAxios.get.mockResolvedValueOnce({ data: mockUser });

      // First call - should hit API
      const result1 = await client.getMe();
      expect(result1).toEqual(mockUser);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await client.getMe();
      expect(result2).toEqual(mockUser);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should cache requests with different parameters separately', async () => {
      const mockIssues1 = [
        { id: '1', title: 'Issue 1', description: 'Desc 1', status: 'open', priority: 'high' },
      ];
      const mockIssues2 = [
        { id: '2', title: 'Issue 2', description: 'Desc 2', status: 'closed', priority: 'low' },
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: mockIssues1 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssues2 });

      // First call with status=open
      const result1 = await client.getIssues({ status: 'open' });
      expect(result1).toEqual(mockIssues1);

      // Second call with status=closed (different params)
      const result2 = await client.getIssues({ status: 'closed' });
      expect(result2).toEqual(mockIssues2);

      // Both should have hit the API
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      // Third call with status=open (should use cache)
      const result3 = await client.getIssues({ status: 'open' });
      expect(result3).toEqual(mockIssues1);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Still only 2 calls
    });

    it('should not cache POST requests', async () => {
      const mockContact = { id: '1', email: 'new@example.com', name: 'New Contact' };
      mockedAxios.post.mockResolvedValue({ data: mockContact });

      // Make the same POST request twice
      await client.createContact({ email: 'new@example.com', name: 'New Contact' });
      await client.createContact({ email: 'new@example.com', name: 'New Contact' });

      // Both should hit the API (no caching for POST)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Expiration', () => {
    it('should expire cache entries after TTL', async () => {
      // Use a very short TTL for testing
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 100 });

      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' };
      mockedAxios.get.mockResolvedValue({ data: mockUser });

      // First call
      await client.getMe();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Second call immediately (should use cache)
      await client.getMe();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Third call after expiration (should hit API again)
      await client.getMe();
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 30000 });
    });

    it('should clear cache when clearCache is called', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' };
      mockedAxios.get.mockResolvedValue({ data: mockUser });

      // First call
      await client.getMe();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Clear cache
      client.clearCache();

      // Second call after clearing (should hit API again)
      await client.getMe();
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should track cache size', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' };
      mockedAxios.get.mockResolvedValue({ data: mockUser });

      const stats1 = client.getCacheStats();
      expect(stats1?.size).toBe(0);

      await client.getMe();

      const stats2 = client.getCacheStats();
      expect(stats2?.size).toBe(1);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when max size is reached', async () => {
      // Create client with small cache size for testing
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 30000, maxCacheSize: 3 });

      const mockIssue1 = {
        id: '1',
        title: 'Issue 1',
        description: 'Desc 1',
        status: 'open',
        priority: 'high',
      };
      const mockIssue2 = {
        id: '2',
        title: 'Issue 2',
        description: 'Desc 2',
        status: 'open',
        priority: 'high',
      };
      const mockIssue3 = {
        id: '3',
        title: 'Issue 3',
        description: 'Desc 3',
        status: 'open',
        priority: 'high',
      };
      const mockIssue4 = {
        id: '4',
        title: 'Issue 4',
        description: 'Desc 4',
        status: 'open',
        priority: 'high',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue1 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue2 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue3 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue4 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue1 }); // For re-fetch after eviction

      // Fill cache to max size (3 entries)
      // Order: 1 (oldest), 2, 3 (newest)
      await client.getIssue('1');
      await client.getIssue('2');
      await client.getIssue('3');

      expect(client.getCacheStats()?.size).toBe(3);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      // Add 4th entry - should evict the LRU (issue 1, which is oldest)
      await client.getIssue('4');

      expect(client.getCacheStats()?.size).toBe(3); // Still 3 entries
      expect(mockedAxios.get).toHaveBeenCalledTimes(4);

      // Try to get issue 1 again - should hit API (was evicted)
      await client.getIssue('1');
      expect(mockedAxios.get).toHaveBeenCalledTimes(5);

      // Get issue 3 again - should use cache (not evicted)
      await client.getIssue('3');
      expect(mockedAxios.get).toHaveBeenCalledTimes(5); // No new API call
    });

    it('should update LRU order when accessing cached entries', async () => {
      // Use fake timers to control time progression
      vi.useFakeTimers();

      // Create client with small cache size for testing
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 30000, maxCacheSize: 2 });

      const mockIssue1 = {
        id: '1',
        title: 'Issue 1',
        description: 'Desc 1',
        status: 'open',
        priority: 'high',
      };
      const mockIssue2 = {
        id: '2',
        title: 'Issue 2',
        description: 'Desc 2',
        status: 'open',
        priority: 'high',
      };
      const mockIssue3 = {
        id: '3',
        title: 'Issue 3',
        description: 'Desc 3',
        status: 'open',
        priority: 'high',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue1 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue2 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue3 });
      mockedAxios.get.mockResolvedValueOnce({ data: mockIssue2 }); // For re-fetch after eviction

      // Add issue 1 and 2 (cache: [1, 2])
      await client.getIssue('1');
      vi.advanceTimersByTime(10); // Advance time by 10ms
      await client.getIssue('2');
      vi.advanceTimersByTime(10); // Advance time by 10ms
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      // Access issue 1 again to make it more recently used (cache: [2, 1])
      await client.getIssue('1');
      vi.advanceTimersByTime(10); // Advance time by 10ms
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // No new API call (cached)

      // Add issue 3 - should evict issue 2 (least recently used) (cache: [1, 3])
      await client.getIssue('3');
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      // Get issue 1 - should use cache (not evicted)
      await client.getIssue('1');
      expect(mockedAxios.get).toHaveBeenCalledTimes(3); // No new API call

      // Try to get issue 2 - should hit API (was evicted)
      await client.getIssue('2');
      expect(mockedAxios.get).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    it('should stop cleanup interval when destroy is called', () => {
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 30000 });

      // Destroy should not throw
      expect(() => client.destroy()).not.toThrow();

      // Cache should be cleared
      const stats = client.getCacheStats();
      expect(stats?.size).toBe(0);
    });
  });
});
