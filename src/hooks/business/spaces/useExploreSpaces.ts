import { useState, useMemo, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
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
  /** Per-category counts when the full set is known (mock mode); null when paginating against the real server. */
  categoryCounts: Record<string, number> | null;
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
  const [mockOffset, setMockOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setMockOffset(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setMockOffset(0);
  }, [category]);

  const mockEnabled = useMemo(() => isMockSpacesEnabled(), []);
  const mockCount = useMemo(() => (mockEnabled ? getMockSpacesCount() : 0), [mockEnabled]);
  const mockAll = useMemo(
    () => (mockEnabled ? generateMockSpaces(mockCount) : []),
    [mockEnabled, mockCount]
  );

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<DirectoryResponse, Error>({
    queryKey: ['exploreSpaces', debouncedSearch, category, mockEnabled],
    enabled: !mockEnabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.reduce((sum, p) => sum + p.entries.length, 0);
    },
    queryFn: async ({ pageParam }) => {
      const apiClient = new QuorumApiClient();
      const response = await apiClient.exploreSpaces({
        search: debouncedSearch || undefined,
        category: category || undefined,
        offset: pageParam as number,
        limit: PAGE_SIZE,
      });
      return response.data;
    },
    staleTime: 60_000,
  });

  const result = useMemo<{ entries: DirectoryEntry[]; total: number; has_more: boolean }>(() => {
    if (mockEnabled) {
      const filtered = filterMockEntries(mockAll, debouncedSearch, category);
      const page = filtered.slice(0, mockOffset + PAGE_SIZE);
      return {
        entries: page,
        total: filtered.length,
        has_more: page.length < filtered.length,
      };
    }
    const pages = data?.pages ?? [];
    const entries = pages.flatMap((p) => p.entries);
    const total = pages[0]?.total ?? 0;
    return {
      entries,
      total,
      has_more: hasNextPage ?? false,
    };
  }, [mockEnabled, mockAll, debouncedSearch, category, mockOffset, data, hasNextPage]);

  const loadMore = () => {
    if (mockEnabled) {
      if (result.has_more) {
        setMockOffset((prev) => prev + PAGE_SIZE);
      }
      return;
    }
    if (hasNextPage) {
      void fetchNextPage();
    }
  };

  const categoryCounts = useMemo<Record<string, number> | null>(() => {
    if (!mockEnabled) return null;
    const counts: Record<string, number> = {};
    for (const entry of mockAll) {
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    }
    return counts;
  }, [mockEnabled, mockAll]);

  return {
    entries: result.entries,
    total: result.total,
    hasMore: result.has_more,
    isLoading: mockEnabled ? false : isLoading,
    error,
    search,
    setSearch,
    category,
    setCategory,
    loadMore,
    refetch,
    categoryCounts,
  };
}
