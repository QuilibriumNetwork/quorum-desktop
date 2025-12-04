import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import { SearchResult, SearchContext } from '../../db/messages';
import { SearchResultItem } from './SearchResultItem';
import { Icon, FlexCenter, Container, Text, Callout, Input, Button } from '../primitives';
import { DropdownPanel } from '../ui';
import { isTouchDevice } from '../../utils/platform';
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
  // Mobile-specific props
  onQueryChange?: (query: string) => void;
  onClear?: () => void;
  searchContext?: SearchContext;
  placeholder?: string;
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
  maxHeight = Math.min(window.innerHeight * 0.8, 600),
  isOpen = true,
  onQueryChange,
  onClear,
  searchContext,
  placeholder,
}) => {
  const isTouch = isTouchDevice();


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
          <Icon name="search" size="3xl" className="empty-icon" />
          <Text className="empty-message">{t`Start typing to search messages...`}</Text>
        </FlexCenter>
      );
    }

    if (isLoading) {
      return (
        <FlexCenter className="search-loading-state">
          <Icon name="spinner" className="loading-icon icon-spin" />
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
        <Icon name="search" size="3xl" className="empty-icon" />
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
      resultsCount={!isTouch ? results.length : undefined}
      title={!isTouch ? t`Search Results` : undefined}
      className={`search-results ${className || ''}`}
      showCloseButton={true}
    >
      {/* Mobile: Search input at top of bottom sheet */}
      {isTouch && (
        <div className="search-mobile-sticky-header">
          <div className="search-mobile-header">
            <Input
              type="search"
              variant="bordered"
              placeholder={placeholder || t`Search in this Space...`}
              value={query}
              onChange={(value) => {
                if (value === '') {
                  onClear?.();
                } else {
                  onQueryChange?.(value);
                }
              }}
              className="search-mobile-input"
              autoComplete="off"
              clearable={true}
              autoFocus={isOpen}
            />
          </div>
          {query.trim() && !isLoading && !isError && (
            <div className="search-results-count">
              <Text variant="subtle" size="sm">
                {results.length === 1
                  ? t`${results.length} result`
                  : t`${results.length} results`}
              </Text>
            </div>
          )}
        </div>
      )}

      {!query.trim() || isLoading || isError || results.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {/* Mobile: Use new item list layout */}
          {isTouch ? (
            <div className="mobile-drawer__item-list">
              <Virtuoso
                data={results}
                style={{ height: Math.min(window.innerHeight * 0.8, 600) - 100 }}
                className="search-results-list"
                itemContent={(index, result) => (
                  <div className="mobile-drawer__item-box mobile-drawer__item-box--interactive">
                    <SearchResultItem
                      key={`${result.message.messageId}-${index}`}
                      result={result}
                      onNavigate={handleNavigate}
                      highlightTerms={highlightTerms}
                      searchTerms={searchTerms}
                      index={index}
                      displayData={resultsData.get(result.message.messageId)}
                      compactDate={true}
                    />
                  </div>
                )}
              />
              {results.length >= 500 && (
                <div className="mobile-drawer__item-box">
                  <Callout variant="info" className="w-full">
                    {t`Showing first 500 results. Refine your search for more specific results.`}
                  </Callout>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: Keep existing layout */
            <>
              <Virtuoso
                data={results}
                style={{ height: Math.min(window.innerHeight * 0.8, 600) - 100 }}
                className="search-results-list"
                itemContent={(index, result) => (
                  <SearchResultItem
                    key={`${result.message.messageId}-${index}`}
                    result={result}
                    onNavigate={handleNavigate}
                    highlightTerms={highlightTerms}
                    searchTerms={searchTerms}
                    index={index}
                    displayData={resultsData.get(result.message.messageId)}
                  />
                )}
              />
              {results.length >= 500 && (
                <Container className="p-3 border-top">
                  <Callout variant="info" className="w-full">
                    {t`Showing first 500 results. Refine your search for more specific results.`}
                  </Callout>
                </Container>
              )}
            </>
          )}
        </>
      )}
    </DropdownPanel>
  );
};
