import React, { useMemo, useCallback, createElement } from 'react';
import { SearchResult } from '../../../db/messages';

export interface UseSearchResultsVirtualizationProps {
  results: SearchResult[];
  query: string;
  highlightTerms: string[];
  handleItemClick: (result: SearchResult) => void;
  itemHeight?: number;
  maxHeight?: number;
}

export interface UseSearchResultsVirtualizationReturn {
  ITEM_HEIGHT: number;
  MAX_HEIGHT: number;
  VISIBLE_ITEMS: number;
  LIST_HEIGHT: number;
  renderItem: ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => React.ReactNode;
}

/**
 * Handles virtualization logic for search results
 * This hook contains web-specific react-window logic
 * Native version would use different virtualization approach
 */
export const useSearchResultsVirtualization = ({
  results,
  query,
  highlightTerms,
  handleItemClick,
  itemHeight = 120,
  maxHeight = 400,
}: UseSearchResultsVirtualizationProps): UseSearchResultsVirtualizationReturn => {
  // Constants for virtualization
  const ITEM_HEIGHT = itemHeight;
  const MAX_HEIGHT = maxHeight;
  const VISIBLE_ITEMS = Math.floor(MAX_HEIGHT / ITEM_HEIGHT);
  const LIST_HEIGHT = Math.min(results.length * ITEM_HEIGHT, MAX_HEIGHT);

  // Memoized list item renderer
  const renderItem = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const result = results[index];

      // Dynamic import to avoid circular dependencies
      // In a real app, you might want to pass this as a prop
      const SearchResultItem =
        require('../../../components/search/SearchResultItem').SearchResultItem;

      return createElement(
        'div',
        { style },
        createElement(SearchResultItem, {
          result,
          query,
          highlightTerms,
          onClick: () => handleItemClick(result),
        })
      );
    },
    [results, query, highlightTerms, handleItemClick]
  );

  return {
    ITEM_HEIGHT,
    MAX_HEIGHT,
    VISIBLE_ITEMS,
    LIST_HEIGHT,
    renderItem,
  };
};

// TODO: Create native version at useSearchResultsVirtualization.native.ts
// export const useSearchResultsVirtualization = ({
//   results,
//   query,
//   highlightTerms,
//   handleItemClick,
//   itemHeight = 120,
// }: UseSearchResultsVirtualizationProps) => {
//   // React Native would use FlatList with different props
//   const renderItem = useCallback(({ item }: { item: SearchResult }) => (
//     <SearchResultItem
//       result={item}
//       query={query}
//       highlightTerms={highlightTerms}
//       onClick={() => handleItemClick(item)}
//     />
//   ), [query, highlightTerms, handleItemClick]);
//
//   return {
//     data: results,
//     renderItem,
//     keyExtractor: (item: SearchResult) => item.messageId,
//     ItemSeparatorComponent: () => <View style={{ height: 1 }} />,
//   };
// };
