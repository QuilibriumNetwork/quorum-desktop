import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DirectoryEntry, DirectoryResponse, SpaceCategory } from '@quilibrium/quorum-shared';
import { QuorumApiClient } from '../../../api/baseTypes';
import {
  generateMockSpaces,
  isMockSpacesEnabled,
  getMockSpacesCount,
} from '../../../utils/mock/mockSpaces';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

export const SPACE_CATEGORIES: { label: string; value: SpaceCategory | null }[] = [
  { label: 'All', value: null },
  { label: 'Community', value: 'community' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Tech', value: 'tech' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Social', value: 'social' },
  { label: 'Education', value: 'education' },
  { label: 'Other', value: 'other' },
];

interface UseExploreSpacesReturn {
  entries: DirectoryEntry[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
  search: string;
  setSearch: (value: string) => void;
  category: SpaceCategory | null;
  setCategory: (value: SpaceCategory | null) => void;
  loadMore: () => void;
  refetch: () => void;
  offset: number;
}

function filterMockEntries(
  all: DirectoryEntry[],
  search: string,
  category: SpaceCategory | null
): DirectoryEntry[] {
  let result = all;
  if (category) {
    result = result.filter((e) => e.category === category);
  }
  if (search.trim()) {
    const needle = search.toLowerCase().trim();
    result = result.filter((e) => e.name.toLowerCase().includes(needle));
  }
  return result;
}

export function useExploreSpaces(): UseExploreSpacesReturn {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<SpaceCategory | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [category]);

  const mockEnabled = useMemo(() => isMockSpacesEnabled(), []);
  const mockCount = useMemo(() => (mockEnabled ? getMockSpacesCount() : 0), [mockEnabled]);
  const mockAll = useMemo(
    () => (mockEnabled ? generateMockSpaces(mockCount) : []),
    [mockEnabled, mockCount]
  );

  const queryKey = useMemo(
    () => ['exploreSpaces', debouncedSearch, category, offset, mockEnabled],
    [debouncedSearch, category, offset, mockEnabled]
  );

  const { data, isLoading, error, refetch } = useQuery<DirectoryResponse>({
    queryKey,
    enabled: !mockEnabled,
    queryFn: async () => {
      const apiClient = new QuorumApiClient();
      const response = await apiClient.exploreSpaces({
        search: debouncedSearch || undefined,
        category: category || undefined,
        offset,
        limit: PAGE_SIZE,
      });
      return response.data;
    },
    staleTime: 60_000,
  });

  const result = useMemo<{ entries: DirectoryEntry[]; total: number; has_more: boolean }>(() => {
    if (mockEnabled) {
      const filtered = filterMockEntries(mockAll, debouncedSearch, category);
      const page = filtered.slice(0, offset + PAGE_SIZE);
      return {
        entries: page,
        total: filtered.length,
        has_more: page.length < filtered.length,
      };
    }
    return {
      entries: data?.entries ?? [],
      total: data?.total ?? 0,
      has_more: data?.has_more ?? false,
    };
  }, [mockEnabled, mockAll, debouncedSearch, category, offset, data]);

  const loadMore = () => {
    if (result.has_more) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  };

  return {
    entries: result.entries,
    total: result.total,
    hasMore: result.has_more,
    isLoading: mockEnabled ? false : isLoading,
    error: error as Error | null,
    search,
    setSearch,
    category,
    setCategory,
    loadMore,
    refetch,
    offset,
  };
}
