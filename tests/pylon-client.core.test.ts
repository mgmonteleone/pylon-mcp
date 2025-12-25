import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PylonClient } from '../src/pylon-client.js';
import type { AxiosInstance } from 'axios';

describe('PylonClient - Core Functionality', () => {
  let client: PylonClient;
  let mockAxios: AxiosInstance;

  beforeEach(() => {
    client = new PylonClient('test-token');
    mockAxios = (client as any).client;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

      expect(mockAxios.get).toHaveBeenCalledWith('/me', { params: undefined });
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

      expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_123', { params: undefined });
      expect(result).toEqual(mockIssue);
    });

    it('should search issues with filters', async () => {
      const mockIssues = [{ id: 'issue_2', title: 'Search result', status: 'pending' }];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockIssues,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.searchIssues('foo', { status: 'pending', limit: 5 });

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
        query: 'foo',
        status: 'pending',
        limit: 5,
      });
      expect(result).toEqual(mockIssues);
    });

    it('should update an issue', async () => {
      const updates = { status: 'closed', priority: 'low' } as const;
      const updated = { id: 'issue_3', title: 'Done', ...updates };

      vi.spyOn(mockAxios, 'patch').mockResolvedValue({
        data: updated,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.updateIssue('issue_3', updates);

      expect(mockAxios.patch).toHaveBeenCalledWith('/issues/issue_3', updates);
      expect(result).toEqual(updated);
    });

    it('should snooze an issue until a date', async () => {
      const until = '2025-01-01T00:00:00Z';
      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: {},
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      });

      await client.snoozeIssue('issue_4', until);

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_4/snooze', { until });
    });

    it('should create issue message', async () => {
      const message = { id: 'msg_1', content: 'hello', issue_id: 'issue_5' } as any;

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: message,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createIssueMessage('issue_5', 'hello');

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_5/messages', { content: 'hello' });
      expect(result).toEqual(message);
    });

    it('should fetch issue with messages using combined method', async () => {
      const mockIssue = { id: 'issue_6', title: 'Combined' } as any;
      const mockMessages = [{ id: 'msg_2', content: 'hi' } as any];

      vi.spyOn(client, 'getIssue').mockResolvedValue(mockIssue);
      vi.spyOn(client, 'getIssueMessages').mockResolvedValue(mockMessages);

      const result = await client.getIssueWithMessages('issue_6');

      expect(client.getIssue).toHaveBeenCalledWith('issue_6');
      expect(client.getIssueMessages).toHaveBeenCalledWith('issue_6');
      expect(result).toEqual({ issue: mockIssue, messages: mockMessages });
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

  describe('Knowledge Bases', () => {
    it('should list knowledge bases', async () => {
      const mockKbs = [{ id: 'kb1', name: 'General' }];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockKbs,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getKnowledgeBases();

      expect(mockAxios.get).toHaveBeenCalledWith('/knowledge-bases', { params: undefined });
      expect(result).toEqual(mockKbs);
    });

    it('should list articles for a knowledge base', async () => {
      const mockArticles = [{ id: 'art1', title: 'How to' }];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockArticles,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getKnowledgeBaseArticles('kb1');

      expect(mockAxios.get).toHaveBeenCalledWith('/knowledge-bases/kb1/articles', {
        params: undefined,
      });
      expect(result).toEqual(mockArticles);
    });

    it('should create an article in a knowledge base', async () => {
      const newArticle = { title: 'FAQ', content: 'Content' } as any;
      const created = { id: 'art2', ...newArticle, knowledge_base_id: 'kb1' } as any;

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: created,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createKnowledgeBaseArticle('kb1', newArticle);

      expect(mockAxios.post).toHaveBeenCalledWith('/knowledge-bases/kb1/articles', newArticle);
      expect(result).toEqual(created);
    });
  });

  describe('Teams and Accounts', () => {
    it('should list teams', async () => {
      const mockTeams = [{ id: 'team1', name: 'Support' }];
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockTeams,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getTeams();

      expect(mockAxios.get).toHaveBeenCalledWith('/teams', { params: undefined });
      expect(result).toEqual(mockTeams);
    });

    it('should get team by id', async () => {
      const mockTeam = { id: 'team1', name: 'Support' };
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockTeam,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getTeam('team1');

      expect(mockAxios.get).toHaveBeenCalledWith('/teams/team1', { params: undefined });
      expect(result).toEqual(mockTeam);
    });

    it('should create a team', async () => {
      const payload = { name: 'New Team', description: 'desc' };
      const created = { id: 'team2', ...payload };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: created,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createTeam(payload as any);

      expect(mockAxios.post).toHaveBeenCalledWith('/teams', payload);
      expect(result).toEqual(created);
    });

    it('should list accounts', async () => {
      const mockAccounts = [{ id: 'acc1', name: 'Acme' }];
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockAccounts,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getAccounts();

      expect(mockAxios.get).toHaveBeenCalledWith('/accounts', { params: undefined });
      expect(result).toEqual(mockAccounts);
    });

    it('should get account by id', async () => {
      const mockAccount = { id: 'acc2', name: 'Beta' };
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockAccount,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getAccount('acc2');

      expect(mockAxios.get).toHaveBeenCalledWith('/accounts/acc2', { params: undefined });
      expect(result).toEqual(mockAccount);
    });
  });

  describe('Tags, Ticket Forms, Webhooks', () => {
    it('should list tags', async () => {
      const mockTags = [{ id: 'tag1', name: 'urgent' }];
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockTags,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getTags();

      expect(mockAxios.get).toHaveBeenCalledWith('/tags', { params: undefined });
      expect(result).toEqual(mockTags);
    });

    it('should create tag', async () => {
      const payload = { name: 'priority-high', color: '#f00' };
      const created = { id: 'tag2', ...payload };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: created,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createTag(payload as any);

      expect(mockAxios.post).toHaveBeenCalledWith('/tags', payload);
      expect(result).toEqual(created);
    });

    it('should list ticket forms', async () => {
      const mockForms = [{ id: 'form1', name: 'Bug Report', fields: [] }];
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockForms,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getTicketForms();

      expect(mockAxios.get).toHaveBeenCalledWith('/ticket-forms', { params: undefined });
      expect(result).toEqual(mockForms);
    });

    it('should create ticket form', async () => {
      const payload = { name: 'Feedback', description: 'desc', fields: [] } as any;
      const created = { id: 'form2', ...payload };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: created,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createTicketForm(payload);

      expect(mockAxios.post).toHaveBeenCalledWith('/ticket-forms', payload);
      expect(result).toEqual(created);
    });

    it('should list webhooks', async () => {
      const hooks = [
        { id: 'wh1', url: 'https://example.com', events: ['issue.created'], active: true },
      ];
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: hooks,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getWebhooks();

      expect(mockAxios.get).toHaveBeenCalledWith('/webhooks', { params: undefined });
      expect(result).toEqual(hooks);
    });

    it('should create webhook', async () => {
      const payload = {
        url: 'https://example.com/hook',
        events: ['issue.updated'],
        active: true,
      } as any;
      const created = { id: 'wh2', ...payload };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: created,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createWebhook(payload);

      expect(mockAxios.post).toHaveBeenCalledWith('/webhooks', payload);
      expect(result).toEqual(created);
    });

    it('should delete webhook', async () => {
      vi.spyOn(mockAxios, 'delete').mockResolvedValue({
        data: {},
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      });

      await client.deleteWebhook('wh3');

      expect(mockAxios.delete).toHaveBeenCalledWith('/webhooks/wh3');
    });
  });

  describe('Users', () => {
    it('should list users', async () => {
      const mockUsers = [{ id: 'user_3', name: 'Terry' }];
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockUsers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getUsers();

      expect(mockAxios.get).toHaveBeenCalledWith('/users', { params: undefined });
      expect(result).toEqual(mockUsers);
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

      expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_123/messages', {
        params: undefined,
      });
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
