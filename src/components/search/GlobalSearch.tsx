import React from 'react';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import { useMessageDB } from '../context/useMessageDB';
import { Container } from '../primitives';
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
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ className }) => {
  const { messageDB } = useMessageDB();

  // Get search context from current route
  const searchContext = useSearchContext();

  // Business logic hooks
  const { searchService } = useSearchService({ messageDB });

  const {
    showResults,
    handleQueryChange,
    handleSuggestionSelect,
    handleClear,
    handleCloseResults,
  } = useGlobalSearchState({ minQueryLength: 3 });

  const { handleNavigate } = useGlobalSearchNavigation();

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
      />

      {showResults && (
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
        />
      )}
    </Container>
  );
};
