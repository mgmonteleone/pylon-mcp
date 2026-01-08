import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const indexPath = join(process.cwd(), 'src', 'index.ts');
const indexSource = readFileSync(indexPath, 'utf8');

describe('Tool descriptions guide ticket-number usage', () => {
  it('pylon_get_issue encourages direct use with ticket numbers', () => {
    expect(indexSource).toContain('If you are given a ticket/issue number, call this tool first');
    expect(indexSource).toContain(
      'ID (ticket/issue number) to retrieve. You can pass the user-provided ticket number directly'
    );
  });

  it('pylon_get_issue_with_messages is positioned as full history option', () => {
    expect(indexSource).toContain('explicitly need the full conversation history');
    expect(indexSource).toContain(
      'prefer pylon_get_issue first; reach for this when message bodies are required'
    );
    expect(indexSource).toContain(
      'ID (ticket/issue number) to retrieve with messages. You can pass the user-provided ticket number directly'
    );
  });

  it('pylon_get_issue_messages is for message bodies only', () => {
    expect(indexSource).toContain('Use when you need message bodies only');
    expect(indexSource).toContain(
      'If you have a ticket number and just need issue details, call pylon_get_issue first'
    );
    expect(indexSource).toContain(
      'ID (ticket/issue number) of the issue to get messages for. You can pass the user-provided ticket number directly'
    );
  });

  it('pylon_get_attachment guides how to find attachment_id and download via returned url', () => {
    expect(indexSource).toContain("'pylon_get_attachment'");
    expect(indexSource).toContain('attachment_id');
    expect(indexSource).toContain('pylon_get_issue_messages or pylon_get_issue_with_messages');
    expect(indexSource).toContain('To download the file contents');
    expect(indexSource).toContain('signed URLs may expire');
  });
});
