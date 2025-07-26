import React, { useState, useRef, useEffect } from 'react';
import { WebSelectProps } from './types';
import { useTheme } from '../theme';
import './Select.scss';

const Select: React.FC<WebSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error = false,
  errorMessage,
  className = '',
  style,
  size = 'medium',
  variant = 'default',
  fullWidth = false,
  width,
  name,
  id,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const selectRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    if (!disabled) {
      setSelectedValue(optionValue);
      setIsOpen(false);
      onChange?.(optionValue);
    }
  };

  const selectedOption = options.find((opt) => opt.value === selectedValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const selectClasses = [
    'quorum-select',
    `quorum-select--${size}`,
    `quorum-select--${variant}`,
    error && 'quorum-select--error',
    disabled && 'quorum-select--disabled',
    fullWidth && 'quorum-select--full-width',
    isOpen && 'quorum-select--open',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Build custom style with width override
  const customStyle = {
    ...style,
    ...(width && { width }),
  };

  return (
    <div
      className={`quorum-select-wrapper${fullWidth ? ' quorum-select-wrapper--full-width' : ''}`}
      style={customStyle}
    >
      <div ref={selectRef} className={selectClasses}>
        <button
          ref={buttonRef}
          type="button"
          className="quorum-select__trigger"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="quorum-select__value">
            {selectedOption?.icon && (
              <span className="quorum-select__icon">{selectedOption.icon}</span>
            )}
            <span
              className={!selectedOption ? 'quorum-select__placeholder' : ''}
            >
              {displayText}
            </span>
          </span>
          <span className="quorum-select__arrow">▼</span>
        </button>

        {isOpen && (
          <div className="quorum-select__dropdown" role="listbox">
            {options.map((option) => (
              <div
                key={option.value}
                className={[
                  'quorum-select__option',
                  option.value === selectedValue &&
                    'quorum-select__option--selected',
                  option.disabled && 'quorum-select__option--disabled',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => !option.disabled && handleSelect(option.value)}
                role="option"
                aria-selected={option.value === selectedValue}
              >
                {option.icon && (
                  <span className="quorum-select__option-icon">
                    {option.icon}
                  </span>
                )}
                <span>{option.label}</span>
                {option.value === selectedValue && (
                  <span className="quorum-select__checkmark">✓</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && errorMessage && (
        <div className="quorum-select__error-message">{errorMessage}</div>
      )}

      {/* Hidden native select for form compatibility */}
      {name && (
        <select
          name={name}
          id={id}
          value={selectedValue}
          onChange={(e) => handleSelect(e.target.value)}
          style={{ display: 'none' }}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default Select;
