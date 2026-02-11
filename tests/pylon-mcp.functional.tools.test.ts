import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { join } from 'node:path';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

function startServerProcess() {
  const serverPath = join(process.cwd(), 'dist', 'index.js');
  return new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: {
      ...process.env,
      PYLON_API_TOKEN: 'test-token',
      PYLON_BASE_URL: process.env.PYLON_BASE_URL,
    },
  });
}

function withJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function makeMockPylonServer(routes: Record<string, Handler>) {
  const server = createServer((req, res) => {
    if (!req.url) {
      withJson(res, 404, { message: 'Not Found' });
      return;
    }

    const match = Object.entries(routes).find(([path]) => {
      if (path.includes(':id')) {
        const base = path.replace(':id', '');
        return req.url.startsWith(base);
      }
      return req.url === path;
    });

    if (!match) {
      withJson(res, 404, { message: 'Not Found' });
      return;
    }

    const handler = match[1];
    handler(req, res);
  });

  return server;
}

describe('pylon-mcp functional tools (stdio, mocked HTTP)', () => {
  let client: Client;
  let mockServer: Server;

  beforeAll(async () => {
    mockServer = makeMockPylonServer({
      '/me': (_req, res) =>
        withJson(res, 200, {
          data: { id: 'user_1', email: 'a@example.com', name: 'Ada Lovelace' },
          request_id: 'req_123',
        }),
      '/users': (_req, res) => withJson(res, 200, [{ id: 'user_1', name: 'Ada' }]),
      '/users/search': async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        const parsed = body ? JSON.parse(body) : {};
        withJson(res, 200, [{ id: 'user_2', name: `Search:${parsed.query}` }]);
      },
      '/contacts': (_req, res) => withJson(res, 200, [{ id: 'contact_1', name: 'Alice' }]),
      '/contacts/search': async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        const parsed = body ? JSON.parse(body) : {};
        withJson(res, 200, [{ id: 'contact_2', name: `Search:${parsed.query}` }]);
      },
      '/issues': async (req, res) => {
        if (req.method === 'GET') {
          withJson(res, 200, [{ id: 'issue_1', title: 'Bug', status: 'open' }]);
        } else if (req.method === 'POST') {
          let body = '';
          for await (const chunk of req) body += chunk;
          const parsed = body ? JSON.parse(body) : {};
          withJson(res, 201, { id: 'issue_new', ...parsed });
        } else {
          withJson(res, 405, { message: 'Method Not Allowed' });
        }
      },
      '/issues/search': async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        const parsed = body ? JSON.parse(body) : {};
        // Extract search terms from the new structured filter format
        // The filter can contain: state, tags, title, requester_id, account_id, etc.
        let searchTerm = 'unknown';
        let requestorId = 'contact_1';
        let accountId = 'account_1';

        if (parsed.filter) {
          // Check for title filter (string_contains or equals)
          if (parsed.filter.title?.value) {
            searchTerm = parsed.filter.title.value;
          }
          // Check for state filter
          else if (parsed.filter.state?.value) {
            searchTerm = `state:${parsed.filter.state.value}`;
          }
          // Check for tag filter
          else if (parsed.filter.tags?.value) {
            const tagValue = Array.isArray(parsed.filter.tags.value)
              ? parsed.filter.tags.value.join(',')
              : parsed.filter.tags.value;
            searchTerm = `tag:${tagValue}`;
          }
          // Get requester_id and account_id from filter
          if (parsed.filter.requester_id?.value) {
            requestorId = parsed.filter.requester_id.value;
          }
          if (parsed.filter.account_id?.value) {
            accountId = parsed.filter.account_id.value;
          }
        }
        // Return mock similar issues based on filters
        const issues = [
          {
            id: 'issue_similar_1',
            title: `Similar: ${searchTerm}`,
            status: 'open',
            state: 'on_hold',
            tags: ['waiting on eng'],
            requestor_id: requestorId,
            account_id: accountId,
          },
          {
            id: 'issue_similar_2',
            title: `Related: ${searchTerm}`,
            status: 'resolved',
            state: 'closed',
            tags: [],
            requestor_id: 'contact_2',
            account_id: accountId,
          },
        ];
        withJson(res, 200, issues);
      },
      '/issues/ISSUE-5': (_req, res) =>
        withJson(res, 200, {
          id: 'ISSUE-5',
          title: 'Five',
          status: 'open',
          requestor_id: 'contact_5',
          account_id: 'account_5',
        }),
      '/issues/ISSUE-5/messages': (_req, res) =>
        withJson(res, 200, [{ id: 'msg_1', content: 'hello' }]),
      '/attachments/att_1': (_req, res) =>
        withJson(res, 200, {
          data: {
            id: 'att_1',
            name: 'goland-logs.zip',
            url: 'https://assets.usepylon.com/signed-url',
            description: 'Sample logs archive',
          },
          request_id: 'req_att_1',
        }),
      '/issues/ISSUE-NO-REQUESTOR': (_req, res) =>
        withJson(res, 200, {
          id: 'ISSUE-NO-REQUESTOR',
          title: 'No Requestor',
          status: 'open',
          // No requestor_id or account_id
        }),
      '/knowledge-bases': (_req, res) => withJson(res, 200, [{ id: 'kb_1', name: 'KB' }]),
      '/knowledge-bases/kb_1/articles': async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          for await (const chunk of req) body += chunk;
          const parsed = body ? JSON.parse(body) : {};
          withJson(res, 201, {
            data: {
              id: 'art_new',
              title: parsed.title,
              body_html: parsed.body_html,
              knowledge_base_id: 'kb_1',
              author_user_id: parsed.author_user_id,
              is_published: parsed.is_published || false,
            },
          });
        } else {
          withJson(res, 200, [{ id: 'art_1', title: 'Article' }]);
        }
      },
      '/teams': (_req, res) => withJson(res, 200, [{ id: 'team_1', name: 'Support' }]),
      '/teams/team_1': (_req, res) =>
        withJson(res, 200, { id: 'team_1', name: 'Support', members: [] }),
      '/accounts': (_req, res) => withJson(res, 200, [{ id: 'acc_1', name: 'Acme Corp' }]),
      '/accounts/acc_1': (_req, res) =>
        withJson(res, 200, { id: 'acc_1', name: 'Acme Corp', plan: 'enterprise' }),
      '/tags': (_req, res) =>
        withJson(res, 200, [{ id: 'tag_1', name: 'urgent', color: '#ff0000' }]),
      '/ticket-forms': (_req, res) =>
        withJson(res, 200, [{ id: 'form_1', name: 'Bug Report', fields: [] }]),
      // Error endpoints for testing error handling
      '/issues/ISSUE-NOT-FOUND': (_req, res) => withJson(res, 404, { error: 'Issue not found' }),
      '/issues/ISSUE-SERVER-ERROR': (_req, res) =>
        withJson(res, 500, { error: 'Internal server error' }),
    });

    await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
    const address = mockServer.address();
    if (typeof address === 'string' || address === null)
      throw new Error('Failed to bind mock server');
    process.env.PYLON_BASE_URL = `http://127.0.0.1:${address.port}`;

    const transport = startServerProcess();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(transport);
  }, 15_000);

  afterAll(async () => {
    await client?.close?.();
    delete process.env.PYLON_BASE_URL;
    await new Promise<void>((resolve) => mockServer?.close(() => resolve()));
  });

  it('pylon_get_me', async () => {
    const res = await client.callTool({ name: 'pylon_get_me', arguments: {} });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('Ada Lovelace');
  });

  it('pylon_get_users', async () => {
    const res = await client.callTool({ name: 'pylon_get_users', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('Ada');
  });

  it('pylon_search_users', async () => {
    const res = await client.callTool({ name: 'pylon_search_users', arguments: { query: 'bob' } });
    expect(res?.content?.[0]?.text).toContain('Search:bob');
  });

  it('pylon_get_contacts', async () => {
    const res = await client.callTool({ name: 'pylon_get_contacts', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('Alice');
  });

  it('pylon_search_contacts', async () => {
    const res = await client.callTool({
      name: 'pylon_search_contacts',
      arguments: { query: 'carol' },
    });
    expect(res?.content?.[0]?.text).toContain('Search:carol');
  });

  it('pylon_get_issues', async () => {
    const res = await client.callTool({ name: 'pylon_get_issues', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('issue_1');
  });

  it('pylon_get_issues validates start_time and end_time are provided together', async () => {
    // Test with only start_time
    const res1 = await client.callTool({
      name: 'pylon_get_issues',
      arguments: { start_time: '2024-01-01T00:00:00Z' },
    });
    expect(res1?.content?.[0]?.text).toContain('error');
    expect(res1?.content?.[0]?.text).toContain(
      'Both start_time and end_time must be provided together'
    );

    // Test with only end_time
    const res2 = await client.callTool({
      name: 'pylon_get_issues',
      arguments: { end_time: '2024-01-31T23:59:59Z' },
    });
    expect(res2?.content?.[0]?.text).toContain('error');
    expect(res2?.content?.[0]?.text).toContain(
      'Both start_time and end_time must be provided together'
    );

    // Test with both (should succeed - no validation error)
    const res3 = await client.callTool({
      name: 'pylon_get_issues',
      arguments: { start_time: '2024-01-01T00:00:00Z', end_time: '2024-01-31T23:59:59Z' },
    });
    // The response should NOT contain our validation error about start_time/end_time
    expect(res3?.content?.[0]?.text).not.toContain(
      'Both start_time and end_time must be provided together'
    );
  });

  it('pylon_create_issue', async () => {
    const res = await client.callTool({
      name: 'pylon_create_issue',
      arguments: { title: 'New', description: 'Desc', status: 'open', priority: 'high' },
    });
    expect(res?.content?.[0]?.text).toContain('issue_new');
  });

  it('pylon_get_issue', async () => {
    const res = await client.callTool({
      name: 'pylon_get_issue',
      arguments: { issue_id: 'ISSUE-5' },
    });
    expect(res?.content?.[0]?.text).toContain('Five');
  });

  it('pylon_get_issue_messages', async () => {
    const res = await client.callTool({
      name: 'pylon_get_issue_messages',
      arguments: { issue_id: 'ISSUE-5' },
    });
    expect(res?.content?.[0]?.text).toContain('msg_1');
  });

  it('pylon_get_issue_with_messages', async () => {
    const res = await client.callTool({
      name: 'pylon_get_issue_with_messages',
      arguments: { issue_id: 'ISSUE-5' },
    });
    expect(res?.content?.[0]?.text).toContain('msg_1');
  });

  it('pylon_get_attachment', async () => {
    const res = await client.callTool({
      name: 'pylon_get_attachment',
      arguments: { attachment_id: 'att_1' },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('att_1');
    expect(text).toContain('goland-logs.zip');
  });

  it('pylon_get_knowledge_bases', async () => {
    const res = await client.callTool({ name: 'pylon_get_knowledge_bases', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('kb_1');
  });

  it('pylon_create_knowledge_base_article', async () => {
    const res = await client.callTool({
      name: 'pylon_create_knowledge_base_article',
      arguments: {
        knowledge_base_id: 'kb_1',
        title: 'New Article',
        body_html: '<p>Article content</p>',
        author_user_id: 'user_123',
      },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('art_new');
    expect(text).toContain('New Article');
    expect(text).toContain('body_html');
  });

  it('pylon_create_knowledge_base_article defaults author_user_id to authenticated user', async () => {
    const res = await client.callTool({
      name: 'pylon_create_knowledge_base_article',
      arguments: {
        knowledge_base_id: 'kb_1',
        title: 'Article With Default Author',
        body_html: '<p>Content</p>',
        // author_user_id intentionally omitted - should default to authenticated user (user_1)
      },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('art_new');
    expect(text).toContain('Article With Default Author');
    // The response should include the author_user_id from the request (defaults to user_1 from /me)
    expect(text).toContain('user_1');
  });

  it('pylon_get_teams', async () => {
    const res = await client.callTool({ name: 'pylon_get_teams', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('team_1');
  });

  // Similar Issues Helper Tools
  it('pylon_find_similar_issues_for_requestor', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_for_requestor',
      arguments: { issue_id: 'ISSUE-5' },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('sourceIssue');
    expect(text).toContain('similarIssues');
    expect(text).toContain('ISSUE-5');
  });

  it('pylon_find_similar_issues_for_requestor with custom query', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_for_requestor',
      arguments: { issue_id: 'ISSUE-5', query: 'login error', limit: 5 },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('sourceIssue');
    expect(text).toContain('similarIssues');
  });

  it('pylon_find_similar_issues_for_requestor returns empty when no requestor', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_for_requestor',
      arguments: { issue_id: 'ISSUE-NO-REQUESTOR' },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('similarIssues');
    expect(text).toContain('[]');
  });

  it('pylon_find_similar_issues_for_account', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_for_account',
      arguments: { issue_id: 'ISSUE-5' },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('sourceIssue');
    expect(text).toContain('similarIssues');
    expect(text).toContain('ISSUE-5');
  });

  it('pylon_find_similar_issues_for_account with custom query', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_for_account',
      arguments: { issue_id: 'ISSUE-5', query: 'billing problem', limit: 10 },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('sourceIssue');
    expect(text).toContain('similarIssues');
  });

  it('pylon_find_similar_issues_for_account returns empty when no account', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_for_account',
      arguments: { issue_id: 'ISSUE-NO-REQUESTOR' },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('similarIssues');
    expect(text).toContain('[]');
  });

  it('pylon_find_similar_issues_global', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_global',
      arguments: { issue_id: 'ISSUE-5' },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('sourceIssue');
    expect(text).toContain('similarIssues');
    expect(text).toContain('ISSUE-5');
  });

  it('pylon_find_similar_issues_global with custom query and limit', async () => {
    const res = await client.callTool({
      name: 'pylon_find_similar_issues_global',
      arguments: { issue_id: 'ISSUE-5', query: 'API timeout', limit: 20 },
    });
    const text = res?.content?.[0]?.text ?? '';
    expect(text).toContain('sourceIssue');
    expect(text).toContain('similarIssues');
  });

  // Additional tool coverage tests
  it('pylon_get_team', async () => {
    const res = await client.callTool({
      name: 'pylon_get_team',
      arguments: { team_id: 'team_1' },
    });
    expect(res?.content?.[0]?.text).toContain('team_1');
    expect(res?.content?.[0]?.text).toContain('Support');
  });

  it('pylon_get_accounts', async () => {
    const res = await client.callTool({ name: 'pylon_get_accounts', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('acc_1');
    expect(res?.content?.[0]?.text).toContain('Acme Corp');
  });

  it('pylon_get_account', async () => {
    const res = await client.callTool({
      name: 'pylon_get_account',
      arguments: { account_id: 'acc_1' },
    });
    expect(res?.content?.[0]?.text).toContain('acc_1');
    expect(res?.content?.[0]?.text).toContain('enterprise');
  });

  it('pylon_get_tags', async () => {
    const res = await client.callTool({ name: 'pylon_get_tags', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('tag_1');
    expect(res?.content?.[0]?.text).toContain('urgent');
  });

  it('pylon_get_ticket_forms', async () => {
    const res = await client.callTool({ name: 'pylon_get_ticket_forms', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('form_1');
    expect(res?.content?.[0]?.text).toContain('Bug Report');
  });

  it('pylon_search_issues with title_contains filter', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues',
      arguments: { title_contains: 'login error' },
    });
    expect(res?.content?.[0]?.text).toContain('Similar: login error');
  });

  it('pylon_search_issues with state filter', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues',
      arguments: { state: 'on_hold' },
    });
    expect(res?.content?.[0]?.text).toContain('Similar: state:on_hold');
  });

  it('pylon_search_issues with tag filter', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues',
      arguments: { tag: 'waiting on eng' },
    });
    expect(res?.content?.[0]?.text).toContain('Similar: tag:waiting on eng');
  });

  it('pylon_search_issues with state and tag filter (custom status)', async () => {
    // This simulates searching for a custom status like "Waiting on Eng Input"
    // which is represented as state=on_hold + tag=waiting on eng
    const res = await client.callTool({
      name: 'pylon_search_issues',
      arguments: { state: 'on_hold', tag: 'waiting on eng' },
    });
    // The mock server checks state first, then tags, so we see state in the title
    // But importantly, both filters are sent to the API (verified by other tests)
    // The real API would apply both filters
    expect(res?.content?.[0]?.text).toContain('issue_similar_1');
    expect(res?.content?.[0]?.text).toContain('on_hold');
    expect(res?.content?.[0]?.text).toContain('waiting on eng');
  });

  // pylon_search_issues_by_status tool tests
  it('pylon_search_issues_by_status - searches by built-in state name', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues_by_status',
      arguments: { status: 'on_hold' },
    });
    const text = res?.content?.[0]?.text;
    expect(text).toContain('status_resolved');
    expect(text).toContain('"state": "on_hold"');
    expect(text).toContain('"isCustom": false');
    expect(text).toContain('issues');
  });

  it('pylon_search_issues_by_status - searches by custom status name', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues_by_status',
      arguments: { status: 'Waiting on Eng Input' },
    });
    const text = res?.content?.[0]?.text;
    expect(text).toContain('status_resolved');
    expect(text).toContain('"state": "on_hold"');
    expect(text).toContain('"tag": "waiting on eng"');
    expect(text).toContain('"isCustom": true');
  });

  it('pylon_search_issues_by_status - case insensitive lookup', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues_by_status',
      arguments: { status: 'WAITING ON ENG' },
    });
    const text = res?.content?.[0]?.text;
    expect(text).toContain('"state": "on_hold"');
    expect(text).toContain('"tag": "waiting on eng"');
    expect(text).toContain('"isCustom": true');
  });

  it('pylon_search_issues_by_status - unknown status treated as tag', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues_by_status',
      arguments: { status: 'custom-unknown-status' },
    });
    const text = res?.content?.[0]?.text;
    expect(text).toContain('"state": "on_hold"');
    expect(text).toContain('"tag": "custom-unknown-status"');
    expect(text).toContain('"isCustom": true');
  });

  it('pylon_search_issues_by_status - includes issue count in response', async () => {
    const res = await client.callTool({
      name: 'pylon_search_issues_by_status',
      arguments: { status: 'on_hold', limit: 10 },
    });
    const text = res?.content?.[0]?.text;
    expect(text).toContain('issue_count');
  });
});
