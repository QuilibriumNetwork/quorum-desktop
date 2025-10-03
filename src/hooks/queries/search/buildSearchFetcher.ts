import { SearchService, SearchQuery } from '../../../services/SearchService';
import { SearchResult } from '../../../db/messages';

const buildSearchFetcher =
  (searchService: SearchService) =>
  async ({ queryKey }: { queryKey: any[] }): Promise<SearchResult[]> => {
    const [, query, contextKey] = queryKey;

    if (!query || !query.trim()) {
      return [];
    }

    // Parse context from contextKey
    const [type, id] = contextKey.split(':');
    const context =
      type === 'space'
        ? { type: 'space' as const, spaceId: id }
        : { type: 'dm' as const, conversationId: id };

    const searchQuery: SearchQuery = {
      query,
      context,
    };

    return searchService.search(searchQuery);
  };

export { buildSearchFetcher };
