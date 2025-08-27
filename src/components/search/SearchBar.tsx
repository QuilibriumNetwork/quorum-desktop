import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import './SearchBar.scss';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  className?: string;
  disabled?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  onClear,
  placeholder = t`Search messages...`,
  suggestions = [],
  onSuggestionSelect,
  className,
  disabled = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isUserTyping = useRef(false);

  // Centralized focus management - prevents focus when mobile overlay is active
  const focusInputSafely = () => {
    // Don't steal focus if user is actively typing
    if (isUserTyping.current) return;
    
    // Prevent focus if mobile overlay is active
    if (window.innerWidth < 1024) {
      const mobileOverlay = document.querySelector('.bg-mobile-overlay');
      if (mobileOverlay) return; // Don't focus
    }
    inputRef.current?.focus();
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusInputSafely();
      }

      // Escape to blur search
      if (e.key === 'Escape' && isFocused) {
        inputRef.current?.blur();
        setShowSuggestions(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, focusInputSafely]);

  // Handle suggestion navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          const suggestion = suggestions[selectedSuggestionIndex];
          onSuggestionSelect?.(suggestion);
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
        break;
      case 'Tab':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          const suggestion = suggestions[selectedSuggestionIndex];
          onSuggestionSelect?.(suggestion);
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mark user as actively typing
    isUserTyping.current = true;
    
    const value = e.target.value;
    onQueryChange(value);
    setSelectedSuggestionIndex(-1);
    setShowSuggestions(value.length > 0 && suggestions.length > 0);
    
    // Reset typing state after a short delay
    setTimeout(() => {
      isUserTyping.current = false;
    }, 300);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setShowSuggestions(query.length > 0 && suggestions.length > 0);
  };

  const handleInputBlur = () => {
    // Don't blur if user is actively typing (focus was stolen)
    if (isUserTyping.current) {
      // Try to restore focus
      setTimeout(() => {
        if (isUserTyping.current && inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
      return;
    }
    
    // Delay to allow suggestion clicks
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionSelect?.(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    focusInputSafely();
  };

  const handleClear = () => {
    onClear();
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    focusInputSafely();
  };

  return (
    <div className={`search-bar ${className || ''}`}>
      <div className={`search-input-container ${isFocused ? 'focused' : ''}`}>
        <FontAwesomeIcon
          icon={faSearch}
          className={`search-icon ${isFocused ? 'search-icon-focused' : ''}`}
        />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            className="search-clear-button"
            onClick={handleClear}
            type="button"
            aria-label={t`Clear search`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
        {!query && (
          <span className="search-shortcut invisible">
            {navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K'}
          </span>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="search-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              className={`search-suggestion ${
                index === selectedSuggestionIndex ? 'selected' : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
              role="option"
              aria-selected={index === selectedSuggestionIndex}
            >
              <FontAwesomeIcon icon={faSearch} className="suggestion-icon" />
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
