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

      // The /me endpoint returns a wrapped response: { data: { ... }, request_id: '...' }
      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: { data: mockUser, request_id: 'req_123' },
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

    it('should get single issue when API returns wrapped data envelope', async () => {
      const mockIssue = {
        id: 'issue_123',
        title: 'Test issue',
        status: 'open',
      };

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: { data: mockIssue, request_id: 'req_1' },
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

      const result = await client.searchIssues({
        filter: {
          state: { operator: 'equals', value: 'pending' },
        },
        limit: 5,
      });

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
        filter: {
          state: { operator: 'equals', value: 'pending' },
        },
        limit: 5,
      });
      expect(result).toEqual(mockIssues);
    });

    it('should search issues when API returns wrapped data envelope', async () => {
      const mockIssues = [{ id: 'issue_2', title: 'Search result', status: 'pending' }];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: {
          data: mockIssues,
          request_id: 'req_1',
          pagination: { next: null },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.searchIssues({
        filter: {
          state: { operator: 'equals', value: 'pending' },
        },
        limit: 5,
      });

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
        filter: {
          state: { operator: 'equals', value: 'pending' },
        },
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

    // Test removed: createIssueMessage method removed because the Pylon API
    // does not support creating messages via POST /issues/{id}/messages
    // See: https://github.com/mgmonteleone/pylon-mcp/issues/13

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

    it('should create an article in a knowledge base', async () => {
      const newArticle = {
        title: 'FAQ',
        body_html: '<p>Content</p>',
        author_user_id: 'user_123',
      };
      const created = { id: 'art2', ...newArticle, knowledge_base_id: 'kb1' };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: { data: created },
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

  describe('Similar Issues Helper Methods', () => {
    describe('findSimilarIssuesForRequestor', () => {
      it('should find similar issues from the same requestor', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: 'Login problem',
          description: 'Cannot login',
          status: 'open',
          priority: 'high',
          requestor_id: 'contact_123',
          account_id: 'account_456',
        };

        const similarIssues = [
          { id: 'issue_1', title: 'Login problem', status: 'open' },
          { id: 'issue_2', title: 'Login issue', status: 'resolved' },
          { id: 'issue_3', title: 'Password reset', status: 'closed' },
        ];

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        vi.spyOn(mockAxios, 'post').mockResolvedValue({
          data: similarIssues,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        const result = await client.findSimilarIssuesForRequestor('issue_1');

        expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_1', { params: undefined });
        expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
          filter: {
            requester_id: { operator: 'equals', value: 'contact_123' },
            title: { operator: 'string_contains', value: 'Login problem' },
          },
        });
        expect(result.sourceIssue).toEqual(sourceIssue);
        // Source issue should be excluded from results
        expect(result.similarIssues).toHaveLength(2);
        expect(result.similarIssues.map((i) => i.id)).not.toContain('issue_1');
      });

      it('should return empty array when requestor_id is missing', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: 'Login problem',
          description: 'Cannot login',
          status: 'open',
          priority: 'high',
          // No requestor_id
        };

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        const result = await client.findSimilarIssuesForRequestor('issue_1');

        expect(result.sourceIssue).toEqual(sourceIssue);
        expect(result.similarIssues).toEqual([]);
      });

      it('should use custom query and limit when provided', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: 'Login problem',
          description: 'Cannot login',
          status: 'open',
          priority: 'high',
          requestor_id: 'contact_123',
        };

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        vi.spyOn(mockAxios, 'post').mockResolvedValue({
          data: [],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        await client.findSimilarIssuesForRequestor('issue_1', {
          query: 'custom search',
          limit: 5,
        });

        expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
          filter: {
            requester_id: { operator: 'equals', value: 'contact_123' },
            title: { operator: 'string_contains', value: 'custom search' },
          },
          limit: 5,
        });
      });
    });

    describe('findSimilarIssuesForAccount', () => {
      it('should find similar issues from the same account', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: 'API timeout',
          description: 'API calls timing out',
          status: 'open',
          priority: 'high',
          requestor_id: 'contact_123',
          account_id: 'account_456',
        };

        const similarIssues = [
          { id: 'issue_1', title: 'API timeout', status: 'open' },
          { id: 'issue_4', title: 'API slow', status: 'open' },
        ];

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        vi.spyOn(mockAxios, 'post').mockResolvedValue({
          data: similarIssues,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        const result = await client.findSimilarIssuesForAccount('issue_1');

        expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
          filter: {
            account_id: { operator: 'equals', value: 'account_456' },
            title: { operator: 'string_contains', value: 'API timeout' },
          },
        });
        expect(result.sourceIssue).toEqual(sourceIssue);
        expect(result.similarIssues).toHaveLength(1);
        expect(result.similarIssues[0].id).toBe('issue_4');
      });

      it('should return empty array when account_id is missing', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: 'API timeout',
          description: 'API calls timing out',
          status: 'open',
          priority: 'high',
          // No account_id
        };

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        const result = await client.findSimilarIssuesForAccount('issue_1');

        expect(result.sourceIssue).toEqual(sourceIssue);
        expect(result.similarIssues).toEqual([]);
      });
    });

    describe('findSimilarIssuesGlobal', () => {
      it('should find similar issues across all users and accounts', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: 'Server error 500',
          description: 'Getting 500 errors',
          status: 'open',
          priority: 'urgent',
        };

        const similarIssues = [
          { id: 'issue_1', title: 'Server error 500', status: 'open' },
          { id: 'issue_5', title: 'Server error', status: 'resolved' },
          { id: 'issue_6', title: '500 error on checkout', status: 'closed' },
        ];

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        vi.spyOn(mockAxios, 'post').mockResolvedValue({
          data: similarIssues,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        const result = await client.findSimilarIssuesGlobal('issue_1');

        expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
          filter: {
            title: { operator: 'string_contains', value: 'Server error 500' },
          },
        });
        expect(result.sourceIssue).toEqual(sourceIssue);
        expect(result.similarIssues).toHaveLength(2);
        expect(result.similarIssues.map((i) => i.id)).not.toContain('issue_1');
      });

      it('should use custom query and limit when provided', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: 'Server error 500',
          description: 'Getting 500 errors',
          status: 'open',
          priority: 'urgent',
        };

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        vi.spyOn(mockAxios, 'post').mockResolvedValue({
          data: [],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        await client.findSimilarIssuesGlobal('issue_1', {
          query: 'error 500',
          limit: 20,
        });

        expect(mockAxios.post).toHaveBeenCalledWith('/issues/search', {
          filter: {
            title: { operator: 'string_contains', value: 'error 500' },
          },
          limit: 20,
        });
      });

      it('should return empty results when source issue has no title and no query provided', async () => {
        const sourceIssue = {
          id: 'issue_1',
          title: '', // Empty title
          description: 'Some description',
          status: 'open',
          priority: 'normal',
        };

        vi.spyOn(mockAxios, 'get').mockResolvedValue({
          data: sourceIssue,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

        const postSpy = vi.spyOn(mockAxios, 'post');

        const result = await client.findSimilarIssuesGlobal('issue_1');

        // Should NOT call the search API when there's no query
        expect(postSpy).not.toHaveBeenCalled();
        // Should return empty similar issues
        expect(result.sourceIssue).toEqual(sourceIssue);
        expect(result.similarIssues).toEqual([]);
      });
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

    it('should handle 401 unauthorized errors', async () => {
      vi.spyOn(mockAxios, 'get').mockRejectedValue({
        response: { status: 401, data: { error: 'Unauthorized' } },
      });

      await expect(client.getMe()).rejects.toMatchObject({
        response: { status: 401 },
      });
    });

    it('should handle 500 server errors', async () => {
      vi.spyOn(mockAxios, 'get').mockRejectedValue({
        response: { status: 500, data: { error: 'Internal server error' } },
      });

      await expect(client.getTeams()).rejects.toMatchObject({
        response: { status: 500 },
      });
    });

    it('should handle timeout errors', async () => {
      vi.spyOn(mockAxios, 'get').mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      });

      await expect(client.getAccounts()).rejects.toMatchObject({
        code: 'ECONNABORTED',
      });
    });

    it('should handle POST request errors', async () => {
      vi.spyOn(mockAxios, 'post').mockRejectedValue({
        response: { status: 400, data: { error: 'Bad request' } },
      });

      await expect(
        client.createIssue({ title: '', description: '', status: '', priority: '' })
      ).rejects.toMatchObject({
        response: { status: 400 },
      });
    });

    it('should handle PATCH request errors', async () => {
      vi.spyOn(mockAxios, 'patch').mockRejectedValue({
        response: { status: 403, data: { error: 'Forbidden' } },
      });

      await expect(client.updateIssue('issue_1', { status: 'closed' })).rejects.toMatchObject({
        response: { status: 403 },
      });
    });
  });

  describe('Contact Management - Additional', () => {
    it('should create contact', async () => {
      const newContact = {
        email: 'new@example.com',
        name: 'New Contact',
        portal_role: 'member',
      };

      const mockResponse = {
        id: 'contact_new',
        ...newContact,
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockResponse,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createContact(newContact);

      expect(mockAxios.post).toHaveBeenCalledWith('/contacts', newContact);
      expect(result).toEqual(mockResponse);
    });

    it('should get contacts with search and limit', async () => {
      const mockContacts = [{ id: 'contact_1', name: 'Alice', email: 'alice@example.com' }];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockContacts,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getContacts({ search: 'alice', limit: 10 });

      expect(mockAxios.get).toHaveBeenCalledWith('/contacts', {
        params: { search: 'alice', limit: 10 },
      });
      expect(result).toEqual(mockContacts);
    });
  });

  describe('Issue Messages - Standalone', () => {
    it('should get issue messages', async () => {
      const mockMessages = [
        {
          id: 'msg_1',
          content: 'Hello',
          author_id: 'user_1',
          issue_id: 'issue_1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockMessages,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssueMessages('issue_1');

      expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_1/messages', { params: undefined });
      expect(result).toEqual(mockMessages);
    });

    it('should get issue messages when API returns wrapped data envelope', async () => {
      const mockMessages = [
        {
          id: 'msg_1',
          content: 'Hello',
          author_id: 'user_1',
          issue_id: 'issue_1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: { data: mockMessages, request_id: 'req_1', pagination: { next: null } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssueMessages('issue_1');

      expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_1/messages', { params: undefined });
      expect(result).toEqual(mockMessages);
    });
  });

  describe('External Issue Linking', () => {
    it('should link an external Linear issue to a Pylon issue', async () => {
      const mockUpdatedIssue = {
        id: 'issue_123',
        title: 'Test issue',
        status: 'open',
        external_issues: [
          {
            external_id: 'ABC-123',
            link: 'https://linear.app/team/issue/ABC-123',
            source: 'linear',
          },
        ],
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockUpdatedIssue,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.linkExternalIssue('issue_123', 'ABC-123', 'linear');

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/external-issues', {
        external_issue_id: 'ABC-123',
        source: 'linear',
        operation: 'link',
      });
      expect(result).toEqual(mockUpdatedIssue);
      expect(result.external_issues).toHaveLength(1);
      expect(result.external_issues![0].source).toBe('linear');
    });

    it('should link an external Jira issue to a Pylon issue', async () => {
      const mockUpdatedIssue = {
        id: 'issue_123',
        title: 'Test issue',
        status: 'open',
        external_issues: [
          {
            external_id: 'PROJ-456',
            link: 'https://company.atlassian.net/browse/PROJ-456',
            source: 'jira',
          },
        ],
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: { data: mockUpdatedIssue, request_id: 'req_1' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.linkExternalIssue('issue_123', 'PROJ-456', 'jira');

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/external-issues', {
        external_issue_id: 'PROJ-456',
        source: 'jira',
        operation: 'link',
      });
      expect(result).toEqual(mockUpdatedIssue);
    });

    it('should link an external GitHub issue to a Pylon issue', async () => {
      const mockUpdatedIssue = {
        id: 'issue_123',
        title: 'Test issue',
        status: 'open',
        external_issues: [
          {
            external_id: '789',
            link: 'https://github.com/org/repo/issues/789',
            source: 'github',
          },
        ],
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockUpdatedIssue,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.linkExternalIssue('issue_123', '789', 'github');

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/external-issues', {
        external_issue_id: '789',
        source: 'github',
        operation: 'link',
      });
      expect(result.external_issues![0].source).toBe('github');
    });

    it('should link an external Asana task to a Pylon issue', async () => {
      const mockUpdatedIssue = {
        id: 'issue_123',
        title: 'Test issue',
        status: 'open',
        external_issues: [
          {
            external_id: '1234567890',
            link: 'https://app.asana.com/0/project/1234567890',
            source: 'asana',
          },
        ],
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockUpdatedIssue,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.linkExternalIssue('issue_123', '1234567890', 'asana');

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/external-issues', {
        external_issue_id: '1234567890',
        source: 'asana',
        operation: 'link',
      });
      expect(result.external_issues![0].source).toBe('asana');
    });

    it('should unlink an external issue from a Pylon issue', async () => {
      const mockUpdatedIssue = {
        id: 'issue_123',
        title: 'Test issue',
        status: 'open',
        external_issues: [],
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockUpdatedIssue,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.unlinkExternalIssue('issue_123', 'ABC-123', 'linear');

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/external-issues', {
        external_issue_id: 'ABC-123',
        source: 'linear',
        operation: 'unlink',
      });
      expect(result.external_issues).toHaveLength(0);
    });

    it('should handle API errors when linking external issues', async () => {
      vi.spyOn(mockAxios, 'post').mockRejectedValue({
        response: { status: 404, data: { error: 'Issue not found' } },
      });

      await expect(
        client.linkExternalIssue('nonexistent', 'ABC-123', 'linear')
      ).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('Issue Followers Management', () => {
    it('should get issue followers', async () => {
      const mockFollowers = [
        { id: 'user_123', type: 'user' },
        { id: 'contact_456', type: 'contact' },
      ];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockFollowers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssueFollowers('issue_123');

      expect(mockAxios.get).toHaveBeenCalledWith('/issues/issue_123/followers', {
        params: undefined,
      });
      expect(result).toEqual(mockFollowers);
      expect(result).toHaveLength(2);
    });

    it('should get issue followers when API returns wrapped data envelope', async () => {
      const mockFollowers = [{ id: 'user_123', type: 'user' }];

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: { data: mockFollowers, request_id: 'req_1' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getIssueFollowers('issue_123');

      expect(result).toEqual(mockFollowers);
    });

    it('should add user followers to an issue', async () => {
      const mockFollowers = [
        { id: 'user_123', type: 'user' },
        { id: 'user_456', type: 'user' },
      ];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockFollowers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.addIssueFollowers('issue_123', ['user_123', 'user_456']);

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/followers', {
        user_ids: ['user_123', 'user_456'],
        contact_ids: undefined,
        operation: 'add',
      });
      expect(result).toEqual(mockFollowers);
    });

    it('should add contact followers to an issue', async () => {
      const mockFollowers = [{ id: 'contact_789', type: 'contact' }];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockFollowers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.addIssueFollowers('issue_123', undefined, ['contact_789']);

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/followers', {
        user_ids: undefined,
        contact_ids: ['contact_789'],
        operation: 'add',
      });
      expect(result).toEqual(mockFollowers);
    });

    it('should add both user and contact followers to an issue', async () => {
      const mockFollowers = [
        { id: 'user_123', type: 'user' },
        { id: 'contact_789', type: 'contact' },
      ];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockFollowers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.addIssueFollowers('issue_123', ['user_123'], ['contact_789']);

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/followers', {
        user_ids: ['user_123'],
        contact_ids: ['contact_789'],
        operation: 'add',
      });
      expect(result).toHaveLength(2);
    });

    it('should remove user followers from an issue', async () => {
      const mockFollowers: any[] = [];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockFollowers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.removeIssueFollowers('issue_123', ['user_123']);

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/followers', {
        user_ids: ['user_123'],
        contact_ids: undefined,
        operation: 'remove',
      });
      expect(result).toEqual([]);
    });

    it('should remove contact followers from an issue', async () => {
      const mockFollowers = [{ id: 'user_123', type: 'user' }];

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockFollowers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.removeIssueFollowers('issue_123', undefined, ['contact_789']);

      expect(mockAxios.post).toHaveBeenCalledWith('/issues/issue_123/followers', {
        user_ids: undefined,
        contact_ids: ['contact_789'],
        operation: 'remove',
      });
      expect(result).toHaveLength(1);
    });

    it('should handle API errors when getting followers', async () => {
      vi.spyOn(mockAxios, 'get').mockRejectedValue({
        response: { status: 404, data: { error: 'Issue not found' } },
      });

      await expect(client.getIssueFollowers('nonexistent')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('Issue Deletion', () => {
    it('should delete an issue', async () => {
      const mockResponse = {
        id: 'issue_123',
        deleted: true,
      };

      vi.spyOn(mockAxios, 'delete').mockResolvedValue({
        data: { data: mockResponse },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.deleteIssue('issue_123');

      expect(mockAxios.delete).toHaveBeenCalledWith('/issues/issue_123');
      expect(result).toEqual(mockResponse);
      expect(result.deleted).toBe(true);
    });

    it('should handle 404 error when deleting non-existent issue', async () => {
      vi.spyOn(mockAxios, 'delete').mockRejectedValue({
        response: { status: 404, data: { error: 'Issue not found' } },
      });

      await expect(client.deleteIssue('nonexistent')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle 403 error when unauthorized to delete', async () => {
      vi.spyOn(mockAxios, 'delete').mockRejectedValue({
        response: { status: 403, data: { error: 'Forbidden' } },
      });

      await expect(client.deleteIssue('issue_123')).rejects.toMatchObject({
        response: { status: 403 },
      });
    });

    it('should handle unwrapped response from delete API', async () => {
      const mockResponse = {
        id: 'issue_456',
        deleted: true,
      };

      vi.spyOn(mockAxios, 'delete').mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.deleteIssue('issue_456');

      expect(mockAxios.delete).toHaveBeenCalledWith('/issues/issue_456');
      expect(result).toEqual(mockResponse);
      expect(result.deleted).toBe(true);
    });
  });
});
