import React, { useState, useRef, useEffect } from 'react';
import { WebSelectProps } from './types';
import { useTheme } from '../theme';
import { Icon } from '../Icon';
import { isValidIconName } from '../Icon/iconMapping';
import { t } from '@lingui/core/macro';
import './Select.scss';

const Select: React.FC<WebSelectProps> = ({
  value,
  options,
  groups,
  onChange,
  placeholder = t`Select an option`,
  disabled = false,
  error = false,
  errorMessage,
  className = '',
  style,
  size = 'medium',
  variant = 'filled',
  fullWidth = false,
  width,
  dropdownPlacement = 'auto',
  name,
  id,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const [actualPlacement, setActualPlacement] = useState<'top' | 'bottom'>('bottom');
  const selectRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  // Calculate dropdown placement when opening
  useEffect(() => {
    if (isOpen && selectRef.current && dropdownPlacement === 'auto') {
      const rect = selectRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 200; // Estimated dropdown height

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setActualPlacement('top');
      } else {
        setActualPlacement('bottom');
      }
    } else {
      // Use explicit placement or default to bottom
      setActualPlacement(dropdownPlacement === 'top' ? 'top' : 'bottom');
    }
  }, [isOpen, dropdownPlacement]);

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

  // Helper function to get all options (flattened from groups or direct options)
  const getAllOptions = () => {
    if (groups) {
      return groups.flatMap(group => group.options);
    }
    return options || [];
  };

  const handleSelect = (optionValue: string) => {
    if (!disabled) {
      setSelectedValue(optionValue);
      setIsOpen(false);
      onChange?.(optionValue);
    }
  };

  const allOptions = getAllOptions();
  const selectedOption = allOptions.find((opt) => opt.value === selectedValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const selectClasses = [
    'quorum-select',
    `quorum-select--${size}`,
    `quorum-select--${variant}`,
    error && 'quorum-select--error',
    disabled && 'quorum-select--disabled',
    fullWidth && 'quorum-select--full-width',
    isOpen && 'quorum-select--open',
    isOpen && `quorum-select--placement-${actualPlacement}`,
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
              isValidIconName(selectedOption.icon) ? (
                <Icon name={selectedOption.icon} size="sm" className="text-subtle quorum-select__icon" />
              ) : (
                <span className="quorum-select__icon">{selectedOption.icon}</span>
              )
            )}
            <span
              className={!selectedOption ? 'quorum-select__placeholder' : ''}
            >
              {displayText}
            </span>
          </span>
          <Icon name="chevron-down" size="xs" className="quorum-select__arrow" />
        </button>

        {isOpen && (
          <div ref={dropdownRef} className="quorum-select__dropdown" role="listbox">
            {groups ? (
              // Render grouped options
              groups.map((group, groupIndex) => (
                <div key={groupIndex} className="quorum-select__group">
                  <div className="quorum-select__group-label">{group.groupLabel}</div>
                  {group.options.map((option) => (
                    <div
                      key={option.value}
                      className={[
                        'quorum-select__option',
                        'quorum-select__option--grouped',
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
                      <div className="quorum-select__option-content">
                        {option.avatar && (
                          <div
                            className="quorum-select__option-avatar"
                            style={{ backgroundImage: `url(${option.avatar})` }}
                          />
                        )}
                        {option.icon && !option.avatar && (
                          isValidIconName(option.icon) ? (
                            <Icon name={option.icon} size="sm" className="text-subtle quorum-select__option-icon" />
                          ) : (
                            <span className="quorum-select__option-icon">{option.icon}</span>
                          )
                        )}
                        <div className="quorum-select__option-text">
                          <span className="quorum-select__option-label">{option.label}</span>
                          {option.subtitle && (
                            <span className="quorum-select__option-subtitle">{option.subtitle}</span>
                          )}
                        </div>
                      </div>
                      {option.value === selectedValue && (
                        <Icon
                          name="check"
                          size="sm"
                          className="quorum-select__checkmark"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              // Render simple options
              allOptions.map((option) => (
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
                  <div className="quorum-select__option-content">
                    {option.avatar && (
                      <div
                        className="quorum-select__option-avatar"
                        style={{ backgroundImage: `url(${option.avatar})` }}
                      />
                    )}
                    {option.icon && !option.avatar && (
                      isValidIconName(option.icon) ? (
                        <Icon name={option.icon} size="sm" className="text-subtle quorum-select__option-icon" />
                      ) : (
                        <span className="quorum-select__option-icon">{option.icon}</span>
                      )
                    )}
                    <div className="quorum-select__option-text">
                      <span className="quorum-select__option-label">{option.label}</span>
                      {option.subtitle && (
                        <span className="quorum-select__option-subtitle">{option.subtitle}</span>
                      )}
                    </div>
                  </div>
                  {option.value === selectedValue && (
                    <Icon
                      name="check"
                      size="sm"
                      className="quorum-select__checkmark"
                    />
                  )}
                </div>
              ))
            )}
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
