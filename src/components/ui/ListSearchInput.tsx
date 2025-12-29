import * as React from 'react';
import { t } from '@lingui/core/macro';
import clsx from 'clsx';
import { Input, Icon } from '../primitives';
import './ListSearchInput.scss';

export interface ListSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'underline' | 'bordered' | 'minimal';
  className?: string;
  clearable?: boolean;
  showSearchIcon?: boolean;
}

/**
 * Reusable search input for filtering lists.
 * - `underline` variant: Icon + minimal input with accent underline on focus (desktop sidebar style)
 * - `bordered` variant: Bordered input with optional clear button (mobile drawer style)
 * - `minimal` variant: Icon + input with no border/underline (clean inline style)
 */
const ListSearchInput: React.FC<ListSearchInputProps> = ({
  value,
  onChange,
  placeholder = t`Search...`,
  variant = 'underline',
  className = '',
  clearable = false,
  showSearchIcon = true,
}) => {
  const [focused, setFocused] = React.useState(false);

  if (variant === 'bordered') {
    return (
      <div className={className}>
        <Input
          type="search"
          variant="bordered"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete="off"
          clearable={clearable}
        />
      </div>
    );
  }

  // Underline or minimal variant
  const isMinimal = variant === 'minimal';
  return (
    <div
      className={clsx(
        'list-search-input',
        isMinimal && 'list-search-input--minimal',
        focused && 'list-search-input--focused',
        className
      )}
    >
      {showSearchIcon && (
        <Icon
          name="search"
          size="md"
          color={focused ? 'var(--accent)' : 'var(--color-text-muted)'}
          className="list-search-input__search-icon"
        />
      )}
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        variant="minimal"
        className="flex-1"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        type="search"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          className="list-search-input__clear-icon"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ListSearchInput;
