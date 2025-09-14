import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../db/messages';
import { SearchResultItem } from './SearchResultItem';
import { Icon, FlexCenter, Container, Text, Callout } from '../primitives';
import { DropdownPanel } from '../DropdownPanel';
import {
  useSearchResultsState,
  useBatchSearchResultsDisplay,
} from '../../hooks';
import './SearchResults.scss';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  query: string;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  highlightTerms: (text: string) => string;
  onClose?: () => void;
  className?: string;
  maxHeight?: number;
  isOpen?: boolean;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading,
  isError,
  error,
  query,
  onNavigate,
  highlightTerms,
  onClose,
  className,
  maxHeight = 400,
  isOpen = true,
}) => {
  // Business logic hooks
  const { searchTerms, handleNavigate } = useSearchResultsState({
    results,
    isLoading,
    isError,
    error,
    query,
    onNavigate,
    onClose,
  });

  // Batch load display data for all search results
  const { resultsData } = useBatchSearchResultsDisplay({
    results,
  });

  // Render empty state
  const renderEmptyState = () => {
    if (!query.trim()) {
      return (
        <FlexCenter className="search-empty-state">
          <Icon name="search" className="empty-icon" />
          <Text className="empty-message">{t`Start typing to search messages...`}</Text>
        </FlexCenter>
      );
    }

    if (isLoading) {
      return (
        <FlexCenter className="search-loading-state">
          <Icon name="spinner" className="loading-icon" spin />
          <Text className="loading-message">{t`Searching...`}</Text>
        </FlexCenter>
      );
    }

    if (isError) {
      return (
        <Container className="p-3">
          <Callout variant="error" className="w-full">
            {t`Search failed: ${error?.message || 'Unknown error'}`}
          </Callout>
        </Container>
      );
    }

    return (
      <FlexCenter className="search-no-results">
        <Icon name="search" className="empty-icon" />
        <Text className="empty-message">{t`No messages found`}</Text>
        <Text className="empty-hint">
          {t`Try different keywords or check your spelling`}
        </Text>
      </FlexCenter>
    );
  };

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose || (() => {})}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={500}
      maxHeight={maxHeight}
      resultsCount={results.length}
      className={`search-results ${className || ''}`}
      showCloseButton={false}
    >
      {!query.trim() || isLoading || isError || results.length === 0 ? (
        renderEmptyState()
      ) : (
        <Container className="search-results-list">
          {/* Staggered loading SearchResultItem components */}
          {results.map((result, index) => (
            <SearchResultItem
              key={`${result.message.messageId}-${index}`}
              result={result}
              onNavigate={handleNavigate}
              highlightTerms={highlightTerms}
              searchTerms={searchTerms}
              index={index}
              displayData={resultsData.get(result.message.messageId)}
            />
          ))}
        </Container>
      )}
    </DropdownPanel>
  );
};
