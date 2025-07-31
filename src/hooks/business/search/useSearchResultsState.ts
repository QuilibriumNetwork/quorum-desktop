import { useMemo, useCallback } from 'react';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../../db/messages';

export interface UseSearchResultsStateProps {
  results: SearchResult[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  query: string;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  onClose?: () => void;
}

export interface UseSearchResultsStateReturn {
  searchTerms: string[];
  handleNavigate: (spaceId: string, channelId: string, messageId: string) => void;
}

/**
 * Manages state and interactions for search results
 * This hook is platform-agnostic and handles search terms and navigation
 */
export const useSearchResultsState = ({
  results,
  isLoading,
  isError,
  error,
  query,
  onNavigate,
  onClose,
}: UseSearchResultsStateProps): UseSearchResultsStateReturn => {
  
  // Extract search terms from query
  const searchTerms = useMemo(() => {
    return query
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);
  }, [query]);

  // Handle navigation and close
  const handleNavigate = useCallback(
    (spaceId: string, channelId: string, messageId: string) => {
      onNavigate(spaceId, channelId, messageId);
      onClose?.();
    },
    [onNavigate, onClose]
  );

  return {
    searchTerms,
    handleNavigate,
  };
};