import React, { useRef, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
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

  // Preserve search input focus when component mounts
  useEffect(() => {
    // Ensure search input keeps focus when results appear
    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.focus();
    }
  }, []); // Run only on mount

  // Adjust position to prevent going off-screen
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // If results would go off the right side of the screen
      if (rect.right > viewportWidth) {
        containerRef.current.style.right = '0';
        containerRef.current.style.left = 'auto';
      }
    }
  }, [results, query]);

  // Close on click outside (but not on search bar)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the search results container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking on the search bar or its children
      const searchBar = document.querySelector('.search-bar');
      if (searchBar && searchBar.contains(target)) {
        return;
      }
      
      // Close if clicking anywhere else
      onClose?.();
    };

    // Use a slight delay to avoid conflicts with search bar focus
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
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
          <p className="empty-message">{t`Start typing to search messages...`}</p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="search-loading-state">
          <FontAwesomeIcon icon={faSpinner} className="loading-icon" spin />
          <p className="loading-message">{t`Searching...`}</p>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="search-error-state">
          <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
          <p className="error-message">
            {t`Search failed: ${error?.message || 'Unknown error'}`}
          </p>
        </div>
      );
    }

    return (
      <div className="search-no-results">
        <FontAwesomeIcon icon={faSearch} className="empty-icon" />
        <p className="empty-message">
          {t`No messages found for "${query}"`}
        </p>
        <p className="empty-hint">
          {t`Try different keywords or check your spelling`}
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
        tabIndex={-1}
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
      tabIndex={-1}
    >
      <div className="search-results-header">
        <span className="results-count">
          {t`${results.length} ${results.length === 1 ? t`result` : t`results`} for "${query}"`}
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
            tabIndex={-1}
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