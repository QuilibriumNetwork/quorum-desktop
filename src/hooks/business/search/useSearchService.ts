import { useMemo } from 'react';
import { SearchService } from '../../../services/searchService';

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
  messageDB 
}: UseSearchServiceProps): UseSearchServiceReturn => {
  const searchService = useMemo(() => {
    if (!messageDB) return null;
    
    const service = new SearchService(messageDB);
    
    // Initialize search indices asynchronously
    service.initialize().catch(() => {
      // Search initialization failed - service will handle gracefully
      // This is intentionally silent as the service should degrade gracefully
    });
    
    return service;
  }, [messageDB]);

  return {
    searchService,
  };
};