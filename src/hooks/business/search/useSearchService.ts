import { useMemo } from 'react';
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

  return {
    searchService,
  };
};
