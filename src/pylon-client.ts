import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Simple in-memory cache with TTL support
 */
class SimpleCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ttl: number;

  constructor(ttlMs: number = 30000) {
    this.ttl = ttlMs;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      // Entry expired
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.ttl,
    };
  }
}

export interface PylonConfig {
  apiToken: string;
  baseUrl?: string;
  /**
   * Cache TTL in milliseconds. Set to 0 to disable caching.
   * Default: 30000 (30 seconds)
   */
  cacheTtl?: number;
}

export interface PylonUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface PylonContact {
  id: string;
  email: string;
  name: string;
  portal_role?: string;
}

export interface PylonIssue {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee?: string;
}

export interface PylonKnowledgeBase {
  id: string;
  name: string;
  description?: string;
}

export interface PylonArticle {
  id: string;
  title: string;
  content: string;
  knowledge_base_id: string;
}

export interface PylonTeam {
  id: string;
  name: string;
  description?: string;
  members?: string[];
}

export interface PylonAccount {
  id: string;
  name: string;
  domain?: string;
  plan?: string;
}

export interface PylonAttachment {
  id: string;
  name: string;
  url: string;
  description?: string;
}

export interface PylonMessage {
  id: string;
  content: string;
  author_id: string;
  issue_id: string;
  created_at: string;
  attachments?: PylonAttachment[];
}

export interface PylonTag {
  id: string;
  name: string;
  color?: string;
}

export interface PylonTicketForm {
  id: string;
  name: string;
  description?: string;
  fields: any[];
}

export interface PylonWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export class PylonClient {
  private client: AxiosInstance;
  private cache: SimpleCache | null;

  constructor(config: PylonConfig) {
    const baseUrl = config.baseUrl || process.env.PYLON_BASE_URL || 'https://api.usepylon.com';

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Initialize cache if TTL is provided and > 0
    const cacheTtl = config.cacheTtl ?? 30000; // Default 30 seconds
    this.cache = cacheTtl > 0 ? new SimpleCache(cacheTtl) : null;
  }

  /**
   * Helper method to perform cached GET requests
   */
  private async cachedGet<T>(url: string, params?: any): Promise<T> {
    // Generate cache key from URL and params
    const cacheKey = `GET:${url}:${JSON.stringify(params || {})}`;

    // Check cache if enabled
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Make the actual request
    const response: AxiosResponse<T> = await this.client.get(url, { params });
    const data = response.data;

    // Store in cache if enabled
    if (this.cache) {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  /**
   * Clear the cache (useful for testing or manual cache invalidation)
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } | null {
    return this.cache ? this.cache.getStats() : null;
  }

  async getMe(): Promise<PylonUser> {
    return this.cachedGet<PylonUser>('/me');
  }

  async getContacts(params?: { search?: string; limit?: number }): Promise<PylonContact[]> {
    return this.cachedGet<PylonContact[]>('/contacts', params);
  }

  async createContact(contact: Omit<PylonContact, 'id'>): Promise<PylonContact> {
    const response: AxiosResponse<PylonContact> = await this.client.post('/contacts', contact);
    return response.data;
  }

  async getIssues(params?: {
    assignee?: string;
    status?: string;
    limit?: number;
  }): Promise<PylonIssue[]> {
    return this.cachedGet<PylonIssue[]>('/issues', params);
  }

  async createIssue(issue: Omit<PylonIssue, 'id'>): Promise<PylonIssue> {
    const response: AxiosResponse<PylonIssue> = await this.client.post('/issues', issue);
    return response.data;
  }

  async getKnowledgeBases(): Promise<PylonKnowledgeBase[]> {
    return this.cachedGet<PylonKnowledgeBase[]>('/knowledge-bases');
  }

  async getKnowledgeBaseArticles(knowledgeBaseId: string): Promise<PylonArticle[]> {
    return this.cachedGet<PylonArticle[]>(`/knowledge-bases/${knowledgeBaseId}/articles`);
  }

  async createKnowledgeBaseArticle(
    knowledgeBaseId: string,
    article: Omit<PylonArticle, 'id' | 'knowledge_base_id'>
  ): Promise<PylonArticle> {
    const response: AxiosResponse<PylonArticle> = await this.client.post(
      `/knowledge-bases/${knowledgeBaseId}/articles`,
      article
    );
    return response.data;
  }

  // Teams API
  async getTeams(): Promise<PylonTeam[]> {
    return this.cachedGet<PylonTeam[]>('/teams');
  }

  async getTeam(teamId: string): Promise<PylonTeam> {
    return this.cachedGet<PylonTeam>(`/teams/${teamId}`);
  }

  async createTeam(team: Omit<PylonTeam, 'id'>): Promise<PylonTeam> {
    const response: AxiosResponse<PylonTeam> = await this.client.post('/teams', team);
    return response.data;
  }

  // Accounts API
  async getAccounts(): Promise<PylonAccount[]> {
    return this.cachedGet<PylonAccount[]>('/accounts');
  }

  async getAccount(accountId: string): Promise<PylonAccount> {
    return this.cachedGet<PylonAccount>(`/accounts/${accountId}`);
  }

  // Users API (search)
  async searchUsers(query: string): Promise<PylonUser[]> {
    const response: AxiosResponse<PylonUser[]> = await this.client.post('/users/search', { query });
    return response.data;
  }

  async getUsers(): Promise<PylonUser[]> {
    return this.cachedGet<PylonUser[]>('/users');
  }

  // Contacts API (search)
  async searchContacts(query: string): Promise<PylonContact[]> {
    const response: AxiosResponse<PylonContact[]> = await this.client.post('/contacts/search', {
      query,
    });
    return response.data;
  }

  // Issues API (search and additional operations)
  async searchIssues(query: string, filters?: any): Promise<PylonIssue[]> {
    const response: AxiosResponse<PylonIssue[]> = await this.client.post('/issues/search', {
      query,
      ...filters,
    });
    return response.data;
  }

  async getIssue(issueId: string): Promise<PylonIssue> {
    return this.cachedGet<PylonIssue>(`/issues/${issueId}`);
  }

  async updateIssue(issueId: string, updates: Partial<PylonIssue>): Promise<PylonIssue> {
    const response: AxiosResponse<PylonIssue> = await this.client.patch(
      `/issues/${issueId}`,
      updates
    );
    return response.data;
  }

  async snoozeIssue(issueId: string, until: string): Promise<void> {
    await this.client.post(`/issues/${issueId}/snooze`, { until });
  }

  // Messages API
  async getIssueMessages(issueId: string): Promise<PylonMessage[]> {
    return this.cachedGet<PylonMessage[]>(`/issues/${issueId}/messages`);
  }

  async createIssueMessage(issueId: string, content: string): Promise<PylonMessage> {
    const response: AxiosResponse<PylonMessage> = await this.client.post(
      `/issues/${issueId}/messages`,
      { content }
    );
    return response.data;
  }

  // Combined method to get issue with all messages
  async getIssueWithMessages(
    issueId: string
  ): Promise<{ issue: PylonIssue; messages: PylonMessage[] }> {
    const [issue, messages] = await Promise.all([
      this.getIssue(issueId),
      this.getIssueMessages(issueId),
    ]);
    return { issue, messages };
  }

  // Tags API
  async getTags(): Promise<PylonTag[]> {
    return this.cachedGet<PylonTag[]>('/tags');
  }

  async createTag(tag: Omit<PylonTag, 'id'>): Promise<PylonTag> {
    const response: AxiosResponse<PylonTag> = await this.client.post('/tags', tag);
    return response.data;
  }

  // Ticket Forms API
  async getTicketForms(): Promise<PylonTicketForm[]> {
    return this.cachedGet<PylonTicketForm[]>('/ticket-forms');
  }

  async createTicketForm(form: Omit<PylonTicketForm, 'id'>): Promise<PylonTicketForm> {
    const response: AxiosResponse<PylonTicketForm> = await this.client.post('/ticket-forms', form);
    return response.data;
  }

  // Webhooks API
  async getWebhooks(): Promise<PylonWebhook[]> {
    return this.cachedGet<PylonWebhook[]>('/webhooks');
  }

  async createWebhook(webhook: Omit<PylonWebhook, 'id'>): Promise<PylonWebhook> {
    const response: AxiosResponse<PylonWebhook> = await this.client.post('/webhooks', webhook);
    return response.data;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.client.delete(`/webhooks/${webhookId}`);
  }

  // Attachments API
  async getAttachment(attachmentId: string): Promise<PylonAttachment> {
    return this.cachedGet<PylonAttachment>(`/attachments/${attachmentId}`);
  }

  async createAttachment(file: File | Blob, description?: string): Promise<PylonAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    const response: AxiosResponse<{ data: PylonAttachment }> = await this.client.post(
      '/attachments',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  }

  async createAttachmentFromUrl(fileUrl: string, description?: string): Promise<PylonAttachment> {
    const payload: any = { file_url: fileUrl };
    if (description) {
      payload.description = description;
    }

    const response: AxiosResponse<{ data: PylonAttachment }> = await this.client.post(
      '/attachments',
      payload
    );
    return response.data.data;
  }
}
