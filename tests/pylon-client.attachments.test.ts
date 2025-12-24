import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PylonClient } from '../src/pylon-client.js';
import type { AxiosInstance } from 'axios';

describe('PylonClient - Attachments', () => {
  let client: PylonClient;
  let mockAxios: AxiosInstance;

  beforeEach(() => {
    client = new PylonClient('test-token');
    // Access the private axios client for mocking
    mockAxios = (client as any).client;
  });

  describe('getAttachment', () => {
    it('should fetch attachment by ID', async () => {
      const mockAttachment = {
        id: 'att_123',
        name: 'document.pdf',
        url: 'https://pylon.com/files/document.pdf',
        description: 'Test document',
      };

      vi.spyOn(mockAxios, 'get').mockResolvedValue({
        data: mockAttachment,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.getAttachment('att_123');

      expect(mockAxios.get).toHaveBeenCalledWith('/attachments/att_123');
      expect(result).toEqual(mockAttachment);
    });

    it('should handle API errors', async () => {
      vi.spyOn(mockAxios, 'get').mockRejectedValue(new Error('Not found'));

      await expect(client.getAttachment('invalid_id')).rejects.toThrow('Not found');
    });
  });

  describe('createAttachmentFromUrl', () => {
    it('should create attachment from URL', async () => {
      const mockResponse = {
        data: {
          id: 'att_456',
          name: 'remote-file.pdf',
          url: 'https://pylon.com/files/remote-file.pdf',
        },
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockResponse,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createAttachmentFromUrl('https://example.com/file.pdf');

      expect(mockAxios.post).toHaveBeenCalledWith('/attachments', {
        file_url: 'https://example.com/file.pdf',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should include description when provided', async () => {
      const mockResponse = {
        data: {
          id: 'att_789',
          name: 'file.pdf',
          url: 'https://pylon.com/files/file.pdf',
          description: 'Important document',
        },
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockResponse,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createAttachmentFromUrl(
        'https://example.com/file.pdf',
        'Important document'
      );

      expect(mockAxios.post).toHaveBeenCalledWith('/attachments', {
        file_url: 'https://example.com/file.pdf',
        description: 'Important document',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors', async () => {
      vi.spyOn(mockAxios, 'post').mockRejectedValue(new Error('Invalid URL'));

      await expect(client.createAttachmentFromUrl('invalid-url')).rejects.toThrow('Invalid URL');
    });
  });

  describe('createAttachment', () => {
    it('should upload file as attachment', async () => {
      const mockFile = new Blob(['test content'], { type: 'application/pdf' });
      const mockResponse = {
        data: {
          id: 'att_upload_123',
          name: 'uploaded.pdf',
          url: 'https://pylon.com/files/uploaded.pdf',
        },
      };

      vi.spyOn(mockAxios, 'post').mockResolvedValue({
        data: mockResponse,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await client.createAttachment(mockFile);

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/attachments',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
      expect(result).toEqual(mockResponse.data);
    });
  });
});
