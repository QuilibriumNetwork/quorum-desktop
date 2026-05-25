import { useEffect, useMemo } from 'react';
import { SearchService } from '../../../services/SearchService';

export interface UseSearchServiceProps {
  messageDB: any; // TODO: Type this properly based on your MessageDB interface
}

export interface UseSearchServiceReturn {
  searchService: SearchService | null;
}

/**
 * Creates and initializes a SearchService instance
 * This hook is platform-agnostic and manages the search service lifecycle
 */
export const useSearchService = ({
  messageDB,
}: UseSearchServiceProps): UseSearchServiceReturn => {
  const searchService = useMemo(() => {
    if (!messageDB) return null;
    // Indices are built lazily on first search per-space/DM (Phase 1.2).
    // No upfront initialization needed.
    return new SearchService(messageDB);
  }, [messageDB]);

  // Phase 1.3: flush any dirty (in-memory but not yet persisted) search
  // indices on visibility change / app close so we don't lose the last ~5s
  // of incremental updates on the debounce window.
  useEffect(() => {
    if (!searchService) return;
    const handler = () => {
      searchService.flushIndices().catch(() => {
        // Best-effort flush — failures here just mean a slightly stale cache
        // on next launch, not data loss (messages remain in their own store).
      });
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, [searchService]);

  return {
    searchService,
  };
};
