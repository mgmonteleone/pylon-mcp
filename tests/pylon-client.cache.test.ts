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
    vi.restoreAllMocks();
  });

  describe('Cache Configuration', () => {
    it('should enable cache by default with 30s TTL', () => {
      client = new PylonClient({ apiToken: 'test-token' });
      const stats = client.getCacheStats();
      expect(stats).not.toBeNull();
      expect(stats?.ttl).toBe(30000);
    });

    it('should allow custom TTL configuration', () => {
      client = new PylonClient({ apiToken: 'test-token', cacheTtl: 60000 });
      const stats = client.getCacheStats();
      expect(stats?.ttl).toBe(60000);
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
});
