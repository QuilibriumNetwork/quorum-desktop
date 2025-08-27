import { MessageDB, SearchContext, SearchResult } from '../db/messages';

export interface SearchServiceConfig {
  debounceMs: number;
  maxResults: number;
  cacheSize: number;
}

export interface SearchQuery {
  query: string;
  context: SearchContext;
  limit?: number;
}

export interface CachedSearchResult {
  results: SearchResult[];
  timestamp: number;
  query: string;
  contextKey: string;
}

export class SearchService {
  private messageDB: MessageDB;
  private config: SearchServiceConfig;
  private searchCache: Map<string, CachedSearchResult> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(messageDB: MessageDB, config?: Partial<SearchServiceConfig>) {
    this.messageDB = messageDB;
    this.config = {
      debounceMs: 300,
      maxResults: 50,
      cacheSize: 100,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    await this.messageDB.initializeSearchIndices();
  }

  private getCacheKey(query: string, context: SearchContext): string {
    const contextKey =
      context.type === 'space'
        ? `space:${context.spaceId}`
        : `dm:${context.conversationId}`;
    return `${query.toLowerCase().trim()}:${contextKey}`;
  }

  private isValidCache(cached: CachedSearchResult): boolean {
    return Date.now() - cached.timestamp < this.CACHE_TTL;
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.searchCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.searchCache.delete(key);
      }
    }

    // Limit cache size
    if (this.searchCache.size > this.config.cacheSize) {
      const entries = Array.from(this.searchCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - this.config.cacheSize);
      toDelete.forEach(([key]) => this.searchCache.delete(key));
    }
  }

  async search(searchQuery: SearchQuery): Promise<SearchResult[]> {
    const { query, context, limit = this.config.maxResults } = searchQuery;

    // Empty query returns empty results
    if (!query.trim()) {
      return [];
    }

    const cacheKey = this.getCacheKey(query, context);

    // Check cache first
    const cached = this.searchCache.get(cacheKey);
    if (cached && this.isValidCache(cached)) {
      return cached.results.slice(0, limit);
    }

    try {
      // Perform search
      const results = await this.messageDB.searchMessages(
        query,
        context,
        limit
      );

      // Cache results
      this.searchCache.set(cacheKey, {
        results,
        timestamp: Date.now(),
        query,
        contextKey: this.getCacheKey('', context),
      });

      // Clean up cache periodically
      this.cleanCache();

      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  searchWithDebounce(
    searchQuery: SearchQuery,
    callback: (results: SearchResult[]) => void
  ): void {
    const { query, context } = searchQuery;
    const debounceKey = this.getCacheKey(query, context);

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      const results = await this.search(searchQuery);
      callback(results);
      this.debounceTimers.delete(debounceKey);
    }, this.config.debounceMs);

    this.debounceTimers.set(debounceKey, timer);
  }

  async getSuggestions(
    query: string,
    context: SearchContext
  ): Promise<string[]> {
    if (!query.trim()) {
      return [];
    }

    try {
      // For now, return simple word-based suggestions
      // This could be enhanced with more sophisticated suggestion logic
      const results = await this.search({ query, context, limit: 10 });

      // Extract unique words from search results for suggestions
      const suggestions = new Set<string>();

      results.forEach((result) => {
        const messageText = this.extractTextFromMessage(result.message);
        const words = messageText.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (word.length > 2 && word.includes(query.toLowerCase())) {
            suggestions.add(word);
          }
        });
      });

      return Array.from(suggestions).slice(0, 5);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  private extractTextFromMessage(message: any): string {
    if (message.content?.type === 'post') {
      const content = message.content.text;
      return Array.isArray(content) ? content.join(' ') : content;
    }
    if (message.content?.type === 'event') {
      return message.content.text;
    }
    return '';
  }

  highlightSearchTerms(text: string, searchTerms: string[]): string {
    if (!searchTerms.length) return text;

    let highlightedText = text;
    searchTerms.forEach((term) => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });

    return highlightedText;
  }

  invalidateCache(context?: SearchContext): void {
    if (!context) {
      // Clear all cache
      this.searchCache.clear();
      return;
    }

    const contextKey =
      context.type === 'space'
        ? `space:${context.spaceId}`
        : `dm:${context.conversationId}`;

    // Remove cached entries for this context
    for (const [key, cached] of this.searchCache.entries()) {
      if (cached.contextKey === contextKey) {
        this.searchCache.delete(key);
      }
    }
  }

  async addMessage(message: any): Promise<void> {
    await this.messageDB.addMessageToIndex(message);

    // Invalidate relevant cache entries
    const spaceContext: SearchContext = {
      type: 'space',
      spaceId: message.spaceId,
    };
    this.invalidateCache(spaceContext);

    // If it's a DM, also invalidate DM cache
    const conversationId = `${message.spaceId}/${message.channelId}`;
    const dmContext: SearchContext = { type: 'dm', conversationId };
    this.invalidateCache(dmContext);
  }

  async removeMessage(
    messageId: string,
    spaceId: string,
    channelId: string
  ): Promise<void> {
    await this.messageDB.removeMessageFromIndex(messageId, spaceId, channelId);

    // Invalidate relevant cache entries
    const spaceContext: SearchContext = { type: 'space', spaceId };
    this.invalidateCache(spaceContext);

    const conversationId = `${spaceId}/${channelId}`;
    const dmContext: SearchContext = { type: 'dm', conversationId };
    this.invalidateCache(dmContext);
  }

  getStats(): {
    cacheSize: number;
    activeDebouncers: number;
    cacheHitRatio: number;
  } {
    return {
      cacheSize: this.searchCache.size,
      activeDebouncers: this.debounceTimers.size,
      cacheHitRatio: 0, // Would need to track hits/misses to calculate this
    };
  }

  cleanup(): void {
    // Clear all timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear cache
    this.searchCache.clear();
  }
}
