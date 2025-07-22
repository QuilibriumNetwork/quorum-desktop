import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { SearchContext, SearchResult } from '../../../db/db';
import { SearchService } from '../../../services/searchService';
import { buildSearchKey } from './buildSearchKey';
import { buildSearchFetcher } from './buildSearchFetcher';

interface UseGlobalSearchProps {
  searchService: SearchService;
  context: SearchContext;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseGlobalSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  suggestions: string[];
  highlightTerms: (text: string) => string;
  clearSearch: () => void;
}

export const useGlobalSearch = ({
  searchService,
  context,
  enabled = true,
  debounceMs = 300,
}: UseGlobalSearchProps): UseGlobalSearchReturn => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Build query key and fetcher
  const queryKey = buildSearchKey({ query: debouncedQuery, context });
  const queryFn = buildSearchFetcher(searchService);

  // Use React Query for search
  const {
    data: results = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn,
    enabled: enabled && debouncedQuery.trim().length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get suggestions when query changes
  useEffect(() => {
    if (query.trim() && query.length > 2) {
      searchService.getSuggestions(query, context).then(setSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [query, context, searchService]);

  // Highlight search terms in text
  const highlightTerms = useCallback(
    (text: string): string => {
      if (!query.trim()) return text;

      const terms = query.trim().split(/\s+/);
      return searchService.highlightSearchTerms(text, terms);
    },
    [query, searchService]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setSuggestions([]);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isError,
    error: error as Error | null,
    suggestions,
    highlightTerms,
    clearSearch,
  };
};
