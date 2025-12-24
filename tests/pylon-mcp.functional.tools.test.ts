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
        withJson(res, 200, { id: 'user_1', email: 'a@example.com', name: 'Ada Lovelace' }),
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
      '/issues/ISSUE-5': (_req, res) =>
        withJson(res, 200, { id: 'ISSUE-5', title: 'Five', status: 'open' }),
      '/issues/ISSUE-5/messages': (_req, res) =>
        withJson(res, 200, [{ id: 'msg_1', content: 'hello' }]),
      '/knowledge-bases': (_req, res) => withJson(res, 200, [{ id: 'kb_1', name: 'KB' }]),
      '/knowledge-bases/kb_1/articles': (_req, res) =>
        withJson(res, 200, [{ id: 'art_1', title: 'Article' }]),
      '/teams': (_req, res) => withJson(res, 200, [{ id: 'team_1', name: 'Support' }]),
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

  it('pylon_get_knowledge_bases', async () => {
    const res = await client.callTool({ name: 'pylon_get_knowledge_bases', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('kb_1');
  });

  it('pylon_get_knowledge_base_articles', async () => {
    const res = await client.callTool({
      name: 'pylon_get_knowledge_base_articles',
      arguments: { knowledge_base_id: 'kb_1' },
    });
    expect(res?.content?.[0]?.text).toContain('art_1');
  });

  it('pylon_get_teams', async () => {
    const res = await client.callTool({ name: 'pylon_get_teams', arguments: {} });
    expect(res?.content?.[0]?.text).toContain('team_1');
  });
});
