import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import { useGlobalSearch } from '../../hooks/queries/search/useGlobalSearch';
import { SearchService } from '../../services/searchService';
import { useMessageDB } from '../context/MessageDB';
import { useSearchContext, getContextDisplayName } from '../../hooks/useSearchContext';
import './GlobalSearch.scss';

interface GlobalSearchProps {
  className?: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ className }) => {
  const navigate = useNavigate();
  const { messageDB } = useMessageDB();
  const [showResults, setShowResults] = useState(false);

  // Get search context from current route
  const searchContext = useSearchContext();

  // Create search service instance (in a real app, this should be a singleton)
  const searchService = useMemo(() => {
    if (!messageDB) return null;
    const service = new SearchService(messageDB);
    // Initialize search indices
    service.initialize().catch(console.error);
    return service;
  }, [messageDB]);

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
  });

  // Handle navigation to message
  const handleNavigate = (spaceId: string, channelId: string, messageId: string) => {
    navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);
  };

  // Handle query changes
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setShowResults(newQuery.trim().length >= 3);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowResults(true);
  };

  // Handle clear
  const handleClear = () => {
    clearSearch();
    setShowResults(false);
  };

  // Handle close results
  const handleCloseResults = () => {
    setShowResults(false);
  };

  // Get contextual placeholder
  const placeholder = getContextDisplayName(searchContext);

  if (!searchService) {
    return null;
  }

  return (
    <div className={`global-search ${className || ''}`}>
      <SearchBar
        query={query}
        onQueryChange={handleQueryChange}
        onClear={handleClear}
        placeholder={placeholder}
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
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
    </div>
  );
};