import React from 'react';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import { useMessageDB } from '../context/useMessageDB';
import { Container } from '../primitives';
import { isTouchDevice } from '../../utils/platform';
import {
  useGlobalSearch,
  useGlobalSearchState,
  useGlobalSearchNavigation,
  useSearchService,
  useSearchContext,
  getContextDisplayName,
} from '../../hooks';
import './GlobalSearch.scss';

interface GlobalSearchProps {
  className?: string;
  isOpen?: boolean;      // Controlled by Channel.tsx for unified panel state
  onOpen?: () => void;   // Controlled by Channel.tsx for unified panel state
  onClose?: () => void;  // Controlled by Channel.tsx for unified panel state
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  className,
  isOpen: externalIsOpen,
  onOpen: externalOnOpen,
  onClose: externalOnClose,
}) => {
  const { messageDB } = useMessageDB();
  const isTouch = isTouchDevice();

  // Get search context from current route
  const searchContext = useSearchContext();

  // Business logic hooks
  const { searchService } = useSearchService({ messageDB });

  const {
    showResults: internalShowResults,
    handleQueryChange: internalHandleQueryChange,
    handleSuggestionSelect,
    handleClear: internalHandleClear,
    handleCloseResults: internalHandleClose,
  } = useGlobalSearchState({ minQueryLength: 3 });

  const { handleNavigate } = useGlobalSearchNavigation();

  // Use external control if provided, otherwise use internal state
  const showResults = externalIsOpen !== undefined ? externalIsOpen : internalShowResults;
  const handleCloseResults = externalOnClose || internalHandleClose;

  // Wrapper for handleQueryChange that also opens the panel if external control is provided
  const handleQueryChange = React.useCallback(
    (newQuery: string, setQuery: (query: string) => void) => {
      internalHandleQueryChange(newQuery, setQuery);
      // If we have external control and query is long enough, notify parent to open panel
      if (externalOnOpen && newQuery.trim().length >= 3 && !showResults) {
        externalOnOpen();
      }
    },
    [internalHandleQueryChange, externalOnOpen, showResults]
  );

  // Wrapper for handleClear that also closes the panel if external control is provided
  const handleClear = React.useCallback(
    (clearSearch: () => void) => {
      internalHandleClear(clearSearch);
      if (externalOnClose) {
        externalOnClose();
      }
    },
    [internalHandleClear, externalOnClose]
  );

  // Search hook
  const {
    query,
    setQuery,
    results,
    isLoading,
    isError,
    error,
    suggestions,
    highlightTerms,
    clearSearch,
  } = useGlobalSearch({
    searchService: searchService!,
    context: searchContext,
    enabled: !!searchService,
    debounceMs: 800, // Increased delay to prevent focus stealing during typing
  });

  // Get contextual placeholder
  const placeholder = getContextDisplayName(searchContext);

  if (!searchService) {
    return null;
  }

  return (
    <Container className={`global-search ${className || ''}`}>
      {/* Desktop: Show search bar inline */}
      {!isTouch && (
        <SearchBar
          query={query}
          onQueryChange={(newQuery) => handleQueryChange(newQuery, setQuery)}
          onClear={() => handleClear(clearSearch)}
          placeholder={placeholder}
          suggestions={suggestions}
          onSuggestionSelect={(suggestion) =>
            handleSuggestionSelect(suggestion, setQuery)
          }
          className="global-search-bar"
          isResultsVisible={showResults}
        />
      )}

      <SearchResults
        results={results}
        isLoading={isLoading}
        isError={isError}
        error={error}
        query={query}
        onNavigate={handleNavigate}
        highlightTerms={highlightTerms}
        onClose={handleCloseResults}
        className="global-search-results"
        isOpen={showResults}
        // Mobile-specific props
        onQueryChange={setQuery}
        onClear={() => clearSearch()}
        searchContext={searchContext}
      />
    </Container>
  );
};
