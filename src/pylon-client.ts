import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Simple in-memory cache with TTL support and LRU eviction
 *
 * Features:
 * - TTL-based expiration
 * - LRU (Least Recently Used) eviction when max size is reached
 * - Proactive cleanup of expired entries
 * - Bounded memory usage
 */
class SimpleCache {
  private cache: Map<string, { data: any; timestamp: number; lastAccessed: number }> = new Map();
  private ttl: number;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttlMs: number = 30000, maxSize: number = 1000) {
    this.ttl = ttlMs;
    this.maxSize = maxSize;

    // Start periodic cleanup of expired entries (every 60 seconds)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
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

    // Update last accessed time for LRU tracking
    entry.lastAccessed = now;
    return entry.data;
  }

  set(key: string, data: any): void {
    const now = Date.now();

    // If cache is at max size and key doesn't exist, evict LRU entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      lastAccessed: now,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Remove all expired entries from the cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): { size: number; ttl: number; maxSize: number } {
    return {
      size: this.cache.size,
      ttl: this.ttl,
      maxSize: this.maxSize,
    };
  }

  /**
   * Cleanup resources (stop cleanup interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
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
  /**
   * Maximum number of entries in the cache. When exceeded, least recently used entries are evicted.
   * Default: 1000
   */
  maxCacheSize?: number;
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
  /** The ID of the contact who created the issue */
  requestor_id?: string;
  /** Canonical requester id (newer API) */
  requester_id?: string;
  /** Requester object (newer API) */
  requester?: { id: string; email?: string };
  /** The ID of the account the requestor belongs to */
  account_id?: string;
  /** Account object (newer API) */
  account?: { id: string };
  /** Issue number (newer API) */
  number?: number;
  /** The HTML body content of the issue */
  body_html?: string;
  /**
   * Issue state - can be one of: "new", "waiting_on_you", "waiting_on_customer", "on_hold", "closed"
   * or a custom status slug
   */
  state?: string;
  /** Tags associated with the issue */
  tags?: string[];
}

/**
 * Filter operator for issue search.
 * Different fields support different operators:
 * - state: equals, in, not_in
 * - tags: contains, does_not_contain, in, not_in
 * - created_at: time_is_after, time_is_before, time_range
 * - requester_id, account_id, assignee_id, team_id: equals, in, not_in, is_set, is_unset
 */
export interface PylonSearchFilterCondition {
  operator:
    | 'equals'
    | 'in'
    | 'not_in'
    | 'contains'
    | 'does_not_contain'
    | 'is_set'
    | 'is_unset'
    | 'time_is_after'
    | 'time_is_before'
    | 'time_range'
    | 'string_contains'
    | 'string_does_not_contain';
  value?: string | string[];
  /** For time_range operator */
  start?: string;
  end?: string;
}

/**
 * Search filter for the /issues/search endpoint.
 * Each key is a field name, and the value is a filter condition.
 */
export interface PylonIssueSearchFilter {
  /** Filter by state: "new", "waiting_on_you", "waiting_on_customer", "on_hold", "closed", or custom status slug */
  state?: PylonSearchFilterCondition;
  /** Filter by tags (tag names) */
  tags?: PylonSearchFilterCondition;
  /** Filter by requester ID */
  requester_id?: PylonSearchFilterCondition;
  /** Filter by account ID */
  account_id?: PylonSearchFilterCondition;
  /** Filter by assignee ID */
  assignee_id?: PylonSearchFilterCondition;
  /** Filter by team ID */
  team_id?: PylonSearchFilterCondition;
  /** Filter by created_at timestamp (RFC3339) */
  created_at?: PylonSearchFilterCondition;
  /** Filter by title content */
  title?: PylonSearchFilterCondition;
  /** Filter by body_html content */
  body_html?: PylonSearchFilterCondition;
  /** Filter by ticket form ID */
  ticket_form_id?: PylonSearchFilterCondition;
  /** Filter by issue type: "Conversation" or "Ticket" */
  issue_type?: PylonSearchFilterCondition;
  /** Custom field filters (use the custom field slug as key) */
  [customField: string]: PylonSearchFilterCondition | undefined;
}

/**
 * Options for searching issues.
 */
export interface PylonIssueSearchOptions {
  /** Structured filter object for the Pylon API */
  filter?: PylonIssueSearchFilter;
  /** Maximum number of issues to return (1-1000, default 100) */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

type PylonApiResponse<T> = {
  data: T;
  request_id?: string;
  pagination?: unknown;
};

export interface PylonKnowledgeBase {
  id: string;
  name: string;
  description?: string;
}

/**
 * Represents an article as returned by the Pylon API.
 * Note: The response format differs from the request format (CreateArticleInput).
 * Response uses `current_published_content_html` and `identifier`,
 * while requests use `body_html` and `author_user_id`.
 */
export interface PylonArticle {
  id: string;
  identifier?: string;
  title: string;
  /** The published HTML content of the article (read-only, from API response) */
  current_published_content_html?: string;
  collection_id?: string;
  is_published?: boolean;
  last_published_at?: string;
  slug?: string;
  url?: string;
  visibility_config?: {
    visibility?: string;
    ai_agent_access?: string;
    allowed_agent_ids?: string[];
  };
}

export interface CreateArticleInput {
  title: string;
  body_html: string;
  author_user_id: string;
  collection_id?: string;
  is_published?: boolean;
  is_unlisted?: boolean;
  slug?: string;
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
      timeout: 30000, // 30 second timeout for all requests
    });

    // Initialize cache if TTL is provided and > 0
    const cacheTtl = config.cacheTtl ?? 30000; // Default 30 seconds
    const maxCacheSize = config.maxCacheSize ?? 1000; // Default 1000 entries
    this.cache = cacheTtl > 0 ? new SimpleCache(cacheTtl, maxCacheSize) : null;
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
  getCacheStats(): { size: number; ttl: number; maxSize: number } | null {
    return this.cache ? this.cache.getStats() : null;
  }

  /**
   * Cleanup resources (stop cache cleanup interval)
   * Call this when you're done with the client to prevent memory leaks
   */
  destroy(): void {
    if (this.cache) {
      this.cache.destroy();
    }
  }

  async getMe(): Promise<PylonUser> {
    // The /me endpoint returns a wrapped response: { data: { id, name }, request_id }
    const response = await this.cachedGet<{ data: PylonUser }>('/me');
    return response.data;
  }

  async getContacts(params?: { search?: string; limit?: number }): Promise<PylonContact[]> {
    return this.cachedGet<PylonContact[]>('/contacts', params);
  }

  async createContact(contact: Omit<PylonContact, 'id'>): Promise<PylonContact> {
    const response: AxiosResponse<PylonContact> = await this.client.post('/contacts', contact);
    return response.data;
  }

  /**
   * Get issues within a time range.
   * Note: The GET /issues endpoint requires start_time and end_time parameters.
   * For filtering by state, tags, or other criteria, use searchIssues() instead.
   */
  async getIssues(params?: {
    /** Start time (RFC3339) - required, max 30 days range with end_time */
    start_time?: string;
    /** End time (RFC3339) - required, max 30 days range with start_time */
    end_time?: string;
  }): Promise<PylonIssue[]> {
    const response = await this.cachedGet<PylonIssue[] | PylonApiResponse<PylonIssue[]>>(
      '/issues',
      params
    );
    return this.unwrapArray(response);
  }

  async createIssue(issue: Omit<PylonIssue, 'id'>): Promise<PylonIssue> {
    const response: AxiosResponse<PylonIssue> = await this.client.post('/issues', issue);
    return this.unwrapData(response.data);
  }

  async getKnowledgeBases(): Promise<PylonKnowledgeBase[]> {
    return this.cachedGet<PylonKnowledgeBase[]>('/knowledge-bases');
  }

  async createKnowledgeBaseArticle(
    knowledgeBaseId: string,
    article: CreateArticleInput
  ): Promise<PylonArticle> {
    const response: AxiosResponse<{ data: PylonArticle }> = await this.client.post(
      `/knowledge-bases/${knowledgeBaseId}/articles`,
      article
    );
    return response.data.data;
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

  /**
   * Search for issues using the Pylon API's structured filter format.
   *
   * @param options - Search options including filter, limit, and cursor
   * @returns Array of matching issues
   *
   * @example
   * // Search for issues with state "on_hold" and tag "waiting on eng"
   * const issues = await client.searchIssues({
   *   filter: {
   *     state: { operator: 'equals', value: 'on_hold' },
   *     tags: { operator: 'contains', value: 'waiting on eng' }
   *   }
   * });
   */
  async searchIssues(options?: PylonIssueSearchOptions): Promise<PylonIssue[]> {
    const body: Record<string, unknown> = {};

    if (options?.filter) {
      body.filter = options.filter;
    }
    if (options?.limit) {
      body.limit = options.limit;
    }
    if (options?.cursor) {
      body.cursor = options.cursor;
    }

    const response: AxiosResponse<PylonIssue[] | PylonApiResponse<PylonIssue[]>> =
      await this.client.post('/issues/search', body);
    return this.unwrapArray(response.data);
  }

  /**
   * @deprecated Use searchIssues(options) with PylonIssueSearchOptions instead.
   * This method is kept for backward compatibility but will be removed in a future version.
   */
  async searchIssuesLegacy(query: string, filters?: Record<string, unknown>): Promise<PylonIssue[]> {
    const response: AxiosResponse<PylonIssue[] | PylonApiResponse<PylonIssue[]>> =
      await this.client.post('/issues/search', {
        query,
        ...filters,
      });
    return this.unwrapArray(response.data);
  }

  async getIssue(issueId: string): Promise<PylonIssue> {
    const response = await this.cachedGet<PylonIssue | PylonApiResponse<PylonIssue>>(
      `/issues/${issueId}`
    );
    return this.unwrapData(response);
  }

  async updateIssue(issueId: string, updates: Partial<PylonIssue>): Promise<PylonIssue> {
    const response: AxiosResponse<PylonIssue> = await this.client.patch(
      `/issues/${issueId}`,
      updates
    );
    return this.unwrapData(response.data);
  }

  async snoozeIssue(issueId: string, until: string): Promise<void> {
    await this.client.post(`/issues/${issueId}/snooze`, { until });
  }

  // Similar Issues Helper Methods

  /**
   * Find similar issues from the same requestor (contact).
   * Helps identify patterns or recurring issues from a specific customer.
   */
  async findSimilarIssuesForRequestor(
    issueId: string,
    options?: { query?: string; limit?: number }
  ): Promise<{ sourceIssue: PylonIssue; similarIssues: PylonIssue[] }> {
    const sourceIssue = await this.getIssue(issueId);

    const requestorId =
      sourceIssue.requestor_id || sourceIssue.requester_id || sourceIssue.requester?.id;

    if (!requestorId) {
      return { sourceIssue, similarIssues: [] };
    }

    // Use the new structured filter format
    const searchOptions: PylonIssueSearchOptions = {
      filter: {
        requester_id: { operator: 'equals', value: requestorId },
        // Also search by title content if query provided
        ...(options?.query && {
          title: { operator: 'string_contains', value: options.query },
        }),
      },
      limit: options?.limit,
    };

    const results = await this.searchIssues(searchOptions);

    // Exclude the source issue from results (support both id and number)
    const issueIdStr = String(issueId);
    const similarIssues = results.filter(
      (issue) =>
        issue.id !== issueId && (issue.number == null || String(issue.number) !== issueIdStr)
    );

    return { sourceIssue, similarIssues };
  }

  /**
   * Find similar issues from the same account/company.
   * Helps identify company-wide issues or patterns.
   */
  async findSimilarIssuesForAccount(
    issueId: string,
    options?: { query?: string; limit?: number }
  ): Promise<{ sourceIssue: PylonIssue; similarIssues: PylonIssue[] }> {
    const sourceIssue = await this.getIssue(issueId);

    const accountId = sourceIssue.account_id || sourceIssue.account?.id;

    if (!accountId) {
      return { sourceIssue, similarIssues: [] };
    }

    // Use the new structured filter format
    const searchOptions: PylonIssueSearchOptions = {
      filter: {
        account_id: { operator: 'equals', value: accountId },
        // Also search by title content if query provided
        ...(options?.query && {
          title: { operator: 'string_contains', value: options.query },
        }),
      },
      limit: options?.limit,
    };

    const results = await this.searchIssues(searchOptions);

    // Exclude the source issue from results (support both id and number)
    const issueIdStr = String(issueId);
    const similarIssues = results.filter(
      (issue) =>
        issue.id !== issueId && (issue.number == null || String(issue.number) !== issueIdStr)
    );

    return { sourceIssue, similarIssues };
  }

  /**
   * Find similar issues across all users and companies.
   * Helps identify widespread issues or find solutions from past tickets.
   */
  async findSimilarIssuesGlobal(
    issueId: string,
    options?: { query?: string; limit?: number }
  ): Promise<{ sourceIssue: PylonIssue; similarIssues: PylonIssue[] }> {
    const sourceIssue = await this.getIssue(issueId);

    // Build search query from title or provided query
    const searchQuery = options?.query || sourceIssue.title;

    // Use the new structured filter format - search by title content
    const searchOptions: PylonIssueSearchOptions = {
      filter: {
        title: { operator: 'string_contains', value: searchQuery },
      },
      limit: options?.limit,
    };

    const results = await this.searchIssues(searchOptions);

    // Exclude the source issue from results (support both id and number)
    const issueIdStr = String(issueId);
    const similarIssues = results.filter(
      (issue) =>
        issue.id !== issueId && (issue.number == null || String(issue.number) !== issueIdStr)
    );

    return { sourceIssue, similarIssues };
  }

  // Messages API
  async getIssueMessages(issueId: string): Promise<PylonMessage[]> {
    const response = await this.cachedGet<PylonMessage[] | PylonApiResponse<PylonMessage[]>>(
      `/issues/${issueId}/messages`
    );
    return this.unwrapArray(response);
  }

  private unwrapData<T>(payload: T | PylonApiResponse<T>): T {
    if (payload && typeof payload === 'object' && 'data' in (payload as any)) {
      return (payload as any).data as T;
    }
    return payload as T;
  }

  private unwrapArray<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === 'object' && Array.isArray((payload as any).data)) {
      return (payload as any).data as T[];
    }
    return [];
  }

  // Note: The Pylon API does not support creating messages via API.
  // Messages can only be created through:
  // 1. The Pylon web UI
  // 2. Original channels (Slack, email, etc.) for externally-sourced issues
  // 3. The initial body_html when creating a new issue via POST /issues

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

  async getAttachment(attachmentId: string): Promise<PylonAttachment> {
    const response = await this.cachedGet<PylonAttachment | PylonApiResponse<PylonAttachment>>(
      `/attachments/${attachmentId}`
    );
    return this.unwrapData(response);
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
