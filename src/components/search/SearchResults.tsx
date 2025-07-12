import React, { useRef, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { SearchResult } from '../../db/messages';
import { SearchResultItem } from './SearchResultItem';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Handle navigation and close
  const handleNavigate = (spaceId: string, channelId: string, messageId: string) => {
    onNavigate(spaceId, channelId, messageId);
    onClose?.();
  };

  // Render empty state
  const renderEmptyState = () => {
    if (!query.trim()) {
      return (
        <div className="search-empty-state">
          <FontAwesomeIcon icon={faSearch} className="empty-icon" />
          <p className="empty-message">Start typing to search messages...</p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="search-loading-state">
          <FontAwesomeIcon icon={faSpinner} className="loading-icon" spin />
          <p className="loading-message">Searching...</p>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="search-error-state">
          <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
          <p className="error-message">
            Search failed: {error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }

    return (
      <div className="search-no-results">
        <FontAwesomeIcon icon={faSearch} className="empty-icon" />
        <p className="empty-message">
          No messages found for "{query}"
        </p>
        <p className="empty-hint">
          Try different keywords or check your spelling
        </p>
      </div>
    );
  };

  // If no query, loading, error, or no results, show appropriate state
  if (!query.trim() || isLoading || isError || results.length === 0) {
    return (
      <div 
        ref={containerRef}
        className={`search-results ${className || ''}`}
        style={{ maxHeight }}
      >
        {renderEmptyState()}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`search-results ${className || ''}`}
      style={{ maxHeight }}
    >
      <div className="search-results-header">
        <span className="results-count">
          {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
        </span>
      </div>
      
      <div className="search-results-list">
        {results.length <= 20 ? (
          // For small result sets, render directly without virtualization
          results.map((result, index) => (
            <SearchResultItem
              key={`${result.message.messageId}-${index}`}
              result={result}
              onNavigate={handleNavigate}
              highlightTerms={highlightTerms}
            />
          ))
        ) : (
          // For large result sets, use virtualization
          <Virtuoso
            style={{ height: maxHeight - 60 }}
            totalCount={results.length}
            itemContent={(index) => (
              <SearchResultItem
                key={`${results[index].message.messageId}-${index}`}
                result={results[index]}
                onNavigate={handleNavigate}
                highlightTerms={highlightTerms}
              />
            )}
            overscan={5}
          />
        )}
      </div>
    </div>
  );
};