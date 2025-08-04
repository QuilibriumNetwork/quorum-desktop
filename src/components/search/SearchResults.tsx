import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../db/messages';
import { SearchResultItem } from './SearchResultItem';
import { Icon, FlexCenter, Container, Text } from '../primitives';
import {
  useSearchResultsState,
  useSearchResultsResponsive,
  useSearchResultsOutsideClick,
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

  const { containerRef } = useSearchResultsResponsive({ results, query });

  useSearchResultsOutsideClick({ containerRef, onClose });

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
        <FlexCenter className="search-error-state">
          <Icon name="exclamation-triangle" className="error-icon" />
          <Text className="error-message">
            {t`Search failed: ${error?.message || 'Unknown error'}`}
          </Text>
        </FlexCenter>
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

  // If no query, loading, error, or no results, show appropriate state
  if (!query.trim() || isLoading || isError || results.length === 0) {
    return (
      <Container
        ref={containerRef}
        className={`search-results ${className || ''}`}
        style={{ maxHeight }}
      >
        {renderEmptyState()}
      </Container>
    );
  }

  return (
    <Container
      ref={containerRef}
      className={`search-results ${className || ''}`}
      style={{ maxHeight }}
    >
      <Container className="search-results-header">
        <Text className="results-count">
          {results.length === 1
            ? t`${results.length} result`
            : t`${results.length} results`}
        </Text>
      </Container>

      <Container className="search-results-list">
        {results.length <= 20 ? (
          // For small result sets, render directly without virtualization
          results.map((result, index) => (
            <SearchResultItem
              key={`${result.message.messageId}-${index}`}
              result={result}
              onNavigate={handleNavigate}
              highlightTerms={highlightTerms}
              searchTerms={searchTerms}
            />
          ))
        ) : (
          // For large result sets, use virtualization
          <Virtuoso
            style={{ height: maxHeight - 60 }}
            totalCount={results.length}
            tabIndex={-1}
            itemContent={(index) => (
              <SearchResultItem
                key={`${results[index].message.messageId}-${index}`}
                result={results[index]}
                onNavigate={handleNavigate}
                highlightTerms={highlightTerms}
                searchTerms={searchTerms}
              />
            )}
            overscan={5}
          />
        )}
      </Container>
    </Container>
  );
};
