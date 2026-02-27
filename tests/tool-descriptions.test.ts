import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const indexPath = join(process.cwd(), 'src', 'index.ts');
const indexSource = readFileSync(indexPath, 'utf8');

describe('Tool descriptions guide ticket-number usage', () => {
  it('pylon_get_issue encourages direct use with ticket numbers', () => {
    expect(indexSource).toContain("'pylon_get_issue'");
    expect(indexSource).toContain('Prefer this over message tools when you only need issue metadata');
  });

  it('pylon_get_issue_with_messages is positioned as full history option', () => {
    expect(indexSource).toContain("'pylon_get_issue_with_messages'");
    expect(indexSource).toContain('full conversation history');
    expect(indexSource).toContain('Prefer pylon_get_issue when you only need issue details');
  });

  it('pylon_get_issue_messages is for message bodies only', () => {
    expect(indexSource).toContain("'pylon_get_issue_messages'");
    expect(indexSource).toContain('Use when you need message content, not just issue metadata');
  });

  it('pylon_get_attachment guides how to find attachment_id and download via returned url', () => {
    expect(indexSource).toContain("'pylon_get_attachment'");
    expect(indexSource).toContain('attachment_id');
    expect(indexSource).toContain('Download the file using the returned URL');
  });
});
