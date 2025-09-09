import React, { useState, useRef } from 'react';
import { t } from '@lingui/core/macro';
import {
  Input,
  Button,
  Icon,
  FlexRow,
  FlexCenter,
  Container,
  Text,
} from '../primitives';
import {
  useSearchSuggestions,
  useKeyboardShortcuts,
  useKeyboardNavigation,
  useSearchFocusManager,
} from '../../hooks';
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
  isResultsVisible?: boolean;
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
  isResultsVisible = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Business logic hooks
  const {
    showSuggestions,
    selectedSuggestionIndex,
    suggestionsRef,
    updateSuggestionsVisibility,
    handleSuggestionClick,
    clearSuggestions,
    setSelectedSuggestionIndex,
  } = useSearchSuggestions({ suggestions, onSuggestionSelect });

  const { focusInputSafely, markUserTyping, handleFocusRestoration } =
    useKeyboardShortcuts({
      inputContainerRef,
      isFocused,
      onEscape: clearSuggestions,
    });

  const { handleKeyDown } = useKeyboardNavigation({
    showSuggestions,
    suggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    onSuggestionSelect,
    onHideSuggestions: clearSuggestions,
  });

  const { maintainFocus, preventFocusSteal } = useSearchFocusManager({
    searchInputRef: inputRef,
    isResultsVisible,
  });

  const handleInputChange = (value: string) => {
    markUserTyping();
    preventFocusSteal(() => {
      onQueryChange(value);
      setSelectedSuggestionIndex(-1);
      updateSuggestionsVisibility(value, suggestions.length > 0);
    });
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    updateSuggestionsVisibility(query, suggestions.length > 0);
  };

  const handleInputBlur = () => {
    // Don't blur if user is actively typing (focus was stolen)
    if (handleFocusRestoration()) {
      return;
    }

    // Delay to allow suggestion clicks
    setTimeout(() => {
      setIsFocused(false);
      clearSuggestions();
    }, 150);
  };

  const handleClear = () => {
    onClear();
    clearSuggestions();
    focusInputSafely();
  };

  return (
    <Container className={`search-bar ${className || ''}`}>
      <FlexRow
        ref={inputContainerRef}
        className={`search-input-container ${isFocused ? 'focused' : ''}`}
        onKeyDown={handleKeyDown}
      >
        <Icon
          name="search"
          className={`search-icon ${isFocused ? 'search-icon-focused' : ''}`}
        />
        <Input
          ref={inputRef}
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          disabled={disabled}
        />
        {query && (
          <FlexCenter className="search-clear-button-wrapper">
            <Button
              type="subtle"
              size="small"
              className="search-clear-button"
              onClick={handleClear}
              iconName="times"
              iconOnly
              tooltip={t`Clear search`}
            />
          </FlexCenter>
        )}
        {!query && (
          <Text className="search-shortcut invisible">
            {navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K'}
          </Text>
        )}
      </FlexRow>

      {showSuggestions && suggestions.length > 0 && (
        <Container
          ref={suggestionsRef}
          className="search-suggestions"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <FlexRow
              key={suggestion}
              className={`search-suggestion ${
                index === selectedSuggestionIndex ? 'selected' : ''
              }`}
              onClick={() =>
                handleSuggestionClick(suggestion, focusInputSafely)
              }
              role="option"
              aria-selected={index === selectedSuggestionIndex}
            >
              <Icon name="search" className="suggestion-icon" />
              <Text>{suggestion}</Text>
            </FlexRow>
          ))}
        </Container>
      )}
    </Container>
  );
};
