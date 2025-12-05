import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PylonClient } from '../src/pylon-client.js';
import type { AxiosInstance } from 'axios';

describe('PylonClient - Core Functionality', () => {
  let client: PylonClient;
  let mockAxios: AxiosInstance;

  beforeEach(() => {
    client = new PylonClient('test-token');
    mockAxios = (client as any).client;
  });

  describe('User Management', () => {
    it('should get current user info', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      };

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockUser,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getMe();

      expect(mockAxios.get).toHaveBeenCalledWith('/me');
      expect(result).toEqual(mockUser);
    });

    it('should search users', async () => {
      const mockUsers = [
        { id: 'user_1', name: 'John Doe', email: 'john@example.com', role: 'agent' },
        { id: 'user_2', name: 'John Smith', email: 'smith@example.com', role: 'admin' },
      ];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockUsers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.searchUsers('John');

      expect(mockAxios.post).toHaveBeenCalledWith('/users/search', { query: 'John' });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('Issue Management', () => {
    it('should get issues', async () => {
      const mockIssues = [
        {
          id: 'issue_1',
          title: 'Bug report',
          description: 'Test bug',
          status: 'open',
          priority: 'high',
        },
      ];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockIssues,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssues();

      expect(mockAxios.get).toHaveBeenCalledWith('/issues', { params: undefined });
      expect(result).toEqual(mockIssues);
    });

    it('should get issues with filters', async () => {
      const mockIssues = [
        {
          id: 'issue_1',
          title: 'Open bug',
          status: 'open',
          assignee: 'user_123',
        },
      ];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockIssues,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssues({
        status: 'open',
        assignee: 'user_123',
        limit: 10,
      });

      expect(mockAxios.get).toHaveBeenCalledWith('/issues', {
        params: { status: 'open', assignee: 'user_123', limit: 10 },
      });
      expect(result).toEqual(mockIssues);
    });

    it('should create issue', async () => {
      const newIssue = {
        title: 'New bug',
        description: 'Bug description',
        status: 'open',
        priority: 'high',
      };

      const mockResponse = {
        id: 'issue_new',
        ...newIssue,
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockResponse,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createIssue(newIssue);

      expect(mockAxios.post).toHaveBeenCalledWith('/issues', newIssue);
      expect(result).toEqual(mockResponse);
    });

    it('should get single issue', async () => {
      const mockIssue = {
        id: 'issue_123',
        title: 'Test issue',
        status: 'open',
      };

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockIssue,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssue('issue_123');

      expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_123');
      expect(result).toEqual(mockIssue);
    });
  });

  describe('Contact Management', () => {
    it('should get contacts', async () => {
      const mockContacts = [
        {
          id: 'contact_1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
        },
      ];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockContacts,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getContacts();

      expect(mockAxios.get).toHaveBeenCalledWith('/contacts', { params: undefined });
      expect(result).toEqual(mockContacts);
    });

    it('should search contacts', async () => {
      const mockContacts = [
        {
          id: 'contact_1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
        },
      ];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockContacts,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.searchContacts('alice@example.com');

      expect(mockAxios.post).toHaveBeenCalledWith('/contacts/search', {
        query: 'alice@example.com',
      });
      expect(result).toEqual(mockContacts);
    });
  });

  describe('Message Management', () => {
    it('should get issue messages with attachments', async () => {
      const mockMessages = [
        {
          id: 'msg_1',
          content: 'Hello, I need help',
          author_id: 'user_1',
          issue_id: 'issue_123',
          created_at: '2024-12-04T10:00:00Z',
        },
        {
          id: 'msg_2',
          content: 'Sure, how can I assist?',
          author_id: 'user_2',
          issue_id: 'issue_123',
          created_at: '2024-12-04T10:05:00Z',
          attachments: [
            {
              id: 'att_1',
              name: 'help.pdf',
              url: 'https://pylon.com/files/help.pdf',
            },
          ],
        },
      ];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockMessages,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssueMessages('issue_123');

      expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_123/messages');
      expect(result).toEqual(mockMessages);
      expect(result[1].attachments).toBeDefined();
      expect(result[1].attachments).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      vi.spyOn(mockAxios, 'get').mockRejectedValue({
        response: { status: 404, data: { error: 'Not found' } },
      });

      await expect(client.getIssue('nonexistent')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle network errors', async () => {
      vi.spyOn(mockAxios, 'get').mockRejectedValue(new Error('Network error'));

      await expect(client.getIssues()).rejects.toThrow('Network error');
    });
  });
});

