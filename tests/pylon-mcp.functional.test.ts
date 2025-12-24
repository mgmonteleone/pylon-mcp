import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'node:path';
import { createServer, Server } from 'node:http';
import nock from 'nock';

// Helper to spawn the locally built server entrypoint via node (stdio transport)
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

describe('pylon-mcp functional (stdio, mocked HTTP)', () => {
  let pylonBase = 'http://127.0.0.1';
  let mockServer: Server;
  let client: Client;

  beforeAll(async () => {
    // Ensure nock intercepts all network calls and disallows real HTTP
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    // Spin up a lightweight local HTTP server to mock Pylon responses
    mockServer = createServer((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/issues/')) {
        const issueId = req.url.split('/').pop();
        const body = JSON.stringify({ id: issueId, title: 'Example ticket', status: 'open' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not Found' }));
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => resolve());
    });

    const address = mockServer.address();
    if (typeof address === 'string' || address === null) {
      throw new Error('Failed to bind mock server');
    }
    pylonBase = `http://127.0.0.1:${address.port}`;
    process.env.PYLON_BASE_URL = pylonBase;

    // Spin up the MCP server (stdio) using the built dist/index.js
    const transport = startServerProcess();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(transport);
  }, 15_000);

  afterAll(async () => {
    await client?.close?.();
    delete process.env.PYLON_BASE_URL;
    nock.cleanAll();
    nock.enableNetConnect();
    nock.restore();
    await new Promise<void>((resolve) => mockServer?.close(() => resolve()));
  });

  it('calls pylon_get_issue end-to-end with mocked HTTP', async () => {
    const issueId = 'ISSUE-1234';

    const result = await client.callTool({
      name: 'pylon_get_issue',
      arguments: { issue_id: issueId },
    });

    expect(result).toBeDefined();
    const textContent = result?.content?.[0];
    expect(textContent?.type).toBe('text');
    expect(textContent?.text).toContain(issueId);
    expect(textContent?.text).toContain('Example ticket');
  });
});
