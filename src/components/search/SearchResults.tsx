import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { SearchResult, SearchContext } from '../../db/messages';
import { SearchResultItem } from './SearchResultItem';
import { Icon, Flex, Callout, Input } from '../primitives';
import { DropdownPanel } from '../ui';
import { isTouchDevice } from '../../utils/platform';
import {
  useSearchResultsState,
  useBatchSearchResultsDisplay,
} from '../../hooks';
import { IdentityScopeProvider } from '../../identity';
import { useMultiSpaceRosters, useLocalDmNames } from '../../hooks/business/identity';
import './SearchResults.scss';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  query: string;
  onNavigate: (spaceId: string, channelId: string, messageId: string, threadId?: string) => void;
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

/**
 * `SearchResults` is the mount point for `useBatchSearchResultsDisplay`
 * (name resolution via `src/identity`), so it needs an ambient
 * `<IdentityScopeProvider>` to be an ANCESTOR of the hook call — a component
 * cannot both call a hook that needs the provider and return that same
 * provider as its own descendant. Wherever `<GlobalSearch>` happens to be
 * mounted (a DM header, a Channel header, the sidebar) may or may not sit
 * inside a matching scope, and search results can span EVERY space the user
 * belongs to in one flat list — a detached, cross-space surface exactly like
 * `ReactionsModal` and the bookmarks/notifications panels, so this component
 * mounts its own multi-space provider rather than relying on ambient scope.
 *
 * Because this provider is its own mount (not the app-root one), it feeds
 * itself rather than relying on `useRootIdentityScope` — search spans every
 * space, so it needs the multi-space roster whatever sits above it.
 *
 * (This comment used to say a nested provider "always shadows an ancestor's
 * completely, nothing merges". That was true when it was written and is NOT
 * true now: since the merge fix, a nested `<IdentityScopeProvider>` MERGES with
 * the enclosing scope — `rostersBySpace` two levels deep, `locallyKnownNames`
 * and `profiles` flat, child wins per key — so a child can only ever add data,
 * never remove it. `defaultSpaceId` is the one field that does not merge; it is
 * always the provider's own prop, which is what stops a DM inheriting an
 * unrelated space's nickname. See `identityProvider.tsx`.)
 *
 * `locallyKnownNames` is built here the same way `rostersBySpace` is:
 * an independent call to the SAME reusable hook the root uses
 * (`useLocalDmNames` — local IndexedDB conversations, no network, shares its
 * query key with the DM sidebar's own read), so a DM partner known only from
 * their local conversation record (no public profile, no space roster row —
 * they're a DM contact, not a space member) resolves to their name instead of
 * a truncated address in DM search results.
 */
export const SearchResults: React.FC<SearchResultsProps> = (props) => {
  const user = usePasskeysContext();
  const selfAddress = user?.currentPasskeyInfo?.address || null;

  const spaceIds = React.useMemo(() => {
    const ids = new Set<string>();
    props.results.forEach((result) => {
      const { message } = result;
      const isDM = message.spaceId === message.channelId;
      if (!isDM) ids.add(message.spaceId);
    });
    return Array.from(ids);
  }, [props.results]);
  const rostersBySpace = useMultiSpaceRosters(spaceIds);
  const locallyKnownNames = useLocalDmNames(selfAddress);

  return (
    <IdentityScopeProvider
      rostersBySpace={rostersBySpace}
      selfAddress={selfAddress}
      locallyKnownNames={locallyKnownNames}
    >
      <SearchResultsInner {...props} />
    </IdentityScopeProvider>
  );
};

const SearchResultsInner: React.FC<SearchResultsProps> = ({
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
        <Flex justify="center" align="center" className="search-empty-state">
          <Icon name="search" size="3xl" className="empty-icon" />
          <span className="empty-message">{t`Start typing to search messages...`}</span>
        </Flex>
      );
    }

    if (isLoading) {
      return (
        <Flex justify="center" align="center" className="search-loading-state">
          <Icon name="spinner" className="loading-icon icon-spin" />
          <span className="loading-message">{t`Searching...`}</span>
        </Flex>
      );
    }

    if (isError) {
      return (
        <div className="p-3">
          <Callout variant="error" className="w-full">
            {t`Search failed: ${error?.message || 'Unknown error'}`}
          </Callout>
        </div>
      );
    }

    return (
      <Flex justify="center" align="center" className="search-no-results">
        <Icon name="search" size="3xl" className="empty-icon" />
        <span className="empty-message">{t`No messages found`}</span>
        <span className="empty-hint">
          {t`Try different keywords or check your spelling`}
        </span>
      </Flex>
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
              onChange={(value: string) => {
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
              <span className="text-label">
                {results.length === 1
                  ? t`${results.length} result`
                  : t`${results.length} results`}
              </span>
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
            /* Desktop: card item layout */
            <>
              <Virtuoso
                data={results}
                style={{ height: Math.min(window.innerHeight * 0.8, 600) - 100 }}
                className="search-results-list"
                components={{ Header: () => <div style={{ height: '16px' }} /> }}
                itemContent={(index, result) => (
                  <div className="panel-item-box panel-item-box--interactive">
                    <SearchResultItem
                      key={`${result.message.messageId}-${index}`}
                      result={result}
                      onNavigate={handleNavigate}
                      highlightTerms={highlightTerms}
                      searchTerms={searchTerms}
                      index={index}
                      displayData={resultsData.get(result.message.messageId)}
                    />
                  </div>
                )}
              />
              {results.length >= 500 && (
                <div className="p-3 border-t border-default">
                  <Callout variant="info" className="w-full">
                    {t`Showing first 500 results. Refine your search for more specific results.`}
                  </Callout>
                </div>
              )}
            </>
          )}
        </>
      )}
    </DropdownPanel>
  );
};
