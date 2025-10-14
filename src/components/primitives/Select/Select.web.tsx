import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WebSelectProps } from './types';
import { Icon } from '../Icon';
import { Portal } from '../Portal';
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
  multiple = false,
  renderSelectedValue,
  selectAllLabel = t`All`,
  clearAllLabel = t`Clear`,
  maxHeight,
  showSelectAllOption = true,
  maxDisplayedChips = 3,
  compactMode = false,
  compactIcon = 'filter',
  showSelectionCount = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | string[]>(
    multiple ? (Array.isArray(value) ? value : []) : value || ''
  );
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const selectRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (value !== undefined) {
      if (multiple) {
        setSelectedValue(Array.isArray(value) ? value : []);
      } else {
        setSelectedValue(value);
      }
    }
  }, [value, multiple]);

  useEffect(() => {
    if (autoFocus && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [autoFocus]);

  // Calculate dropdown position
  const calculateDropdownPosition = useCallback(() => {
    if (!selectRef.current || !buttonRef.current) return;

    // Use buttonRef for more accurate positioning (the actual trigger element)
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = maxHeight ? Math.min(Number(maxHeight), 240) : 240;

    let top = rect.bottom + 4; // 4px gap

    // Auto-placement logic
    if (dropdownPlacement === 'auto') {
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top - dropdownHeight - 4;
      }
    } else if (dropdownPlacement === 'top') {
      top = rect.top - dropdownHeight - 4;
    }

    // In compact mode, let dropdown size based on content with constraints
    // Otherwise, match the button width exactly
    const dropdownStyle: React.CSSProperties = {
      position: 'fixed',
      top: `${top}px`,
      left: `${rect.left}px`,
      maxHeight: maxHeight || 240,
      zIndex: 10200, // Higher than ModalContainer (10100) to work inside modals
      overflow: 'auto',
    };

    if (compactMode) {
      // Compact mode: auto-size based on content with min/max constraints
      dropdownStyle.width = 'fit-content';
      dropdownStyle.minWidth = '150px';
      dropdownStyle.maxWidth = '250px';
    } else {
      // Regular mode: match button width
      dropdownStyle.width = `${rect.width}px`;
    }

    setDropdownStyle(dropdownStyle);
  }, [dropdownPlacement, maxHeight, compactMode]);

  // Update position when dropdown opens
  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition();
    }
  }, [isOpen, calculateDropdownPosition]);

  // Debounced update on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const handlePositionUpdate = () => {
      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Debounce updates by 10ms
      updateTimeoutRef.current = setTimeout(() => {
        calculateDropdownPosition();
      }, 10);
    };

    window.addEventListener('scroll', handlePositionUpdate, true);
    window.addEventListener('resize', handlePositionUpdate);

    return () => {
      window.removeEventListener('scroll', handlePositionUpdate, true);
      window.removeEventListener('resize', handlePositionUpdate);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [isOpen, calculateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is inside the select button OR inside the dropdown
      const isInsideButton = selectRef.current && selectRef.current.contains(target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);

      if (!isInsideButton && !isInsideDropdown) {
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
      return groups.flatMap((group) => group.options);
    }
    return options || [];
  };

  const handleSelect = (optionValue: string) => {
    if (!disabled) {
      if (multiple) {
        const currentValues = selectedValue as string[];
        let newValues: string[];

        if (currentValues.includes(optionValue)) {
          // Remove if already selected
          newValues = currentValues.filter((v) => v !== optionValue);
        } else {
          // Add if not selected
          newValues = [...currentValues, optionValue];
        }

        setSelectedValue(newValues);
        onChange?.(newValues);
        // Keep dropdown open for multiselect
      } else {
        setSelectedValue(optionValue);
        setIsOpen(false);
        onChange?.(optionValue);
      }
    }
  };

  const handleSelectAll = () => {
    if (!disabled && multiple) {
      const allOptions = getAllOptions();
      const allValues = allOptions
        .filter((opt) => !opt.disabled)
        .map((opt) => opt.value);
      setSelectedValue(allValues);
      onChange?.(allValues);
    }
  };

  const handleClearAll = () => {
    if (!disabled && multiple) {
      setSelectedValue([]);
      onChange?.([]);
    }
  };

  const allOptions = getAllOptions();

  // Helper to get display text/content
  const getDisplayContent = () => {
    // Compact mode: show only icon
    if (compactMode) {
      return (
        <div className="quorum-select__compact-content">
          <Icon
            name={compactIcon}
            size={size === 'small' ? 'sm' : 'md'}
            className="quorum-select__compact-icon"
          />
          {showSelectionCount && multiple && (
            (() => {
              const selectedValues = selectedValue as string[];
              const count = selectedValues.length;
              return count > 0 ? (
                <span className="quorum-select__selection-badge">
                  {count}
                </span>
              ) : null;
            })()
          )}
        </div>
      );
    }

    if (multiple) {
      const selectedValues = selectedValue as string[];

      if (selectedValues.length === 0) {
        return (
          <span className="quorum-select__placeholder">{placeholder}</span>
        );
      }

      if (renderSelectedValue) {
        return renderSelectedValue(selectedValues, allOptions);
      }

      // Default display: show chips for selected items
      const selectedOptions = allOptions.filter((opt) =>
        selectedValues.includes(opt.value)
      );
      const displayedOptions = selectedOptions.slice(0, maxDisplayedChips);
      const remainingCount = selectedOptions.length - maxDisplayedChips;

      return (
        <div className="quorum-select__chips">
          {displayedOptions.map((opt) => (
            <span key={opt.value} className="quorum-select__chip">
              {opt.label}
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="quorum-select__chip quorum-select__chip--count">
              +{remainingCount} more
            </span>
          )}
        </div>
      );
    } else {
      const selectedOption = allOptions.find(
        (opt) => opt.value === selectedValue
      );
      return selectedOption ? (
        <>
          {selectedOption.icon &&
            (isValidIconName(selectedOption.icon) ? (
              <Icon
                name={selectedOption.icon}
                size="sm"
                className="text-subtle quorum-select__icon"
              />
            ) : (
              <span className="quorum-select__icon">{selectedOption.icon}</span>
            ))}
          <span>{selectedOption.label}</span>
        </>
      ) : (
        <span className="quorum-select__placeholder">{placeholder}</span>
      );
    }
  };

  const selectClasses = [
    'quorum-select',
    `quorum-select--${size}`,
    `quorum-select--${variant}`,
    error && 'quorum-select--error',
    disabled && 'quorum-select--disabled',
    fullWidth && 'quorum-select--full-width',
    isOpen && 'quorum-select--open',
    compactMode && 'quorum-select--compact',
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
          aria-multiselectable={multiple}
        >
          <span className="quorum-select__value">{getDisplayContent()}</span>
          <Icon
            name="chevron-down"
            size="xs"
            className="quorum-select__arrow"
          />
        </button>

        {isOpen && (
          <Portal>
            <div
              ref={dropdownRef}
              className="quorum-select__dropdown quorum-select__dropdown--fixed"
              role="listbox"
              style={dropdownStyle}
              aria-label={placeholder}
            >
              {/* Select All / Clear All options for multiselect */}
              {multiple && showSelectAllOption && allOptions.length > 0 && (
                <div className="quorum-select__actions">
                  <div
                    className="quorum-select__action"
                    onClick={handleSelectAll}
                    role="option"
                  >
                    <Icon
                      name="check-square"
                      size="sm"
                      className="quorum-select__action-icon"
                    />
                    <span>{selectAllLabel}</span>
                  </div>
                  <div
                    className="quorum-select__action"
                    onClick={handleClearAll}
                    role="option"
                  >
                    <Icon
                      name="square"
                      size="sm"
                      className="quorum-select__action-icon"
                    />
                    <span>{clearAllLabel}</span>
                  </div>
                </div>
              )}
              {groups
                ? // Render grouped options
                  groups.map((group, groupIndex) => (
                    <div key={groupIndex} className="quorum-select__group">
                      <div className="quorum-select__group-label">
                        {group.groupLabel}
                      </div>
                      {group.options.map((option) => {
                        const isSelected = multiple
                          ? (selectedValue as string[]).includes(option.value)
                          : option.value === selectedValue;

                        return (
                          <div
                            key={option.value}
                            className={[
                              'quorum-select__option',
                              'quorum-select__option--grouped',
                              isSelected && 'quorum-select__option--selected',
                              option.disabled &&
                                'quorum-select__option--disabled',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() =>
                              !option.disabled && handleSelect(option.value)
                            }
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="quorum-select__option-content">
                              {/* Show checkbox for multiselect */}
                              {multiple && (
                                <Icon
                                  name={isSelected ? 'check-square' : 'square'}
                                  size="sm"
                                  className="quorum-select__checkbox"
                                />
                              )}
                              {option.avatar && (
                                <div
                                  className="quorum-select__option-avatar"
                                  style={{
                                    backgroundImage: `url(${option.avatar})`,
                                  }}
                                />
                              )}
                              {option.icon &&
                                !option.avatar &&
                                (isValidIconName(option.icon) ? (
                                  <Icon
                                    name={option.icon}
                                    size="sm"
                                    className="text-subtle quorum-select__option-icon"
                                  />
                                ) : (
                                  <span className="quorum-select__option-icon">
                                    {option.icon}
                                  </span>
                                ))}
                              <div className="quorum-select__option-text">
                                <span className="quorum-select__option-label">
                                  {option.label}
                                </span>
                                {option.subtitle && (
                                  <span className="quorum-select__option-subtitle">
                                    {option.subtitle}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Show checkmark for single select */}
                            {!multiple && isSelected && (
                              <Icon
                                name="check"
                                size="sm"
                                className="quorum-select__checkmark"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                : // Render simple options
                  allOptions.map((option) => {
                    const isSelected = multiple
                      ? (selectedValue as string[]).includes(option.value)
                      : option.value === selectedValue;

                    return (
                      <div
                        key={option.value}
                        className={[
                          'quorum-select__option',
                          isSelected && 'quorum-select__option--selected',
                          option.disabled && 'quorum-select__option--disabled',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() =>
                          !option.disabled && handleSelect(option.value)
                        }
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="quorum-select__option-content">
                          {/* Show checkbox for multiselect */}
                          {multiple && (
                            <Icon
                              name={isSelected ? 'check-square' : 'square'}
                              size="sm"
                              className="quorum-select__checkbox"
                            />
                          )}
                          {option.avatar && (
                            <div
                              className="quorum-select__option-avatar"
                              style={{ backgroundImage: `url(${option.avatar})` }}
                            />
                          )}
                          {option.icon &&
                            !option.avatar &&
                            (isValidIconName(option.icon) ? (
                              <Icon
                                name={option.icon}
                                size="sm"
                                className="text-subtle quorum-select__option-icon"
                              />
                            ) : (
                              <span className="quorum-select__option-icon">
                                {option.icon}
                              </span>
                            ))}
                          <div className="quorum-select__option-text">
                            <span className="quorum-select__option-label">
                              {option.label}
                            </span>
                            {option.subtitle && (
                              <span className="quorum-select__option-subtitle">
                                {option.subtitle}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Show checkmark for single select */}
                        {!multiple && isSelected && (
                          <Icon
                            name="check"
                            size="sm"
                            className="quorum-select__checkmark"
                          />
                        )}
                      </div>
                    );
                  })}
            </div>
          </Portal>
        )}
      </div>

      {error && errorMessage && (
        <div className="quorum-select__error-message">{errorMessage}</div>
      )}

      {/* Hidden native select for form compatibility */}
      {name && !multiple && (
        <select
          name={name}
          id={id}
          value={selectedValue as string}
          onChange={(e) => handleSelect(e.target.value)}
          style={{ display: 'none' }}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {allOptions.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {name && multiple && (
        <select
          name={name}
          id={id}
          value={selectedValue as string[]}
          onChange={(e) => {
            const values = Array.from(
              e.target.selectedOptions,
              (option) => option.value
            );
            setSelectedValue(values);
            onChange?.(values);
          }}
          style={{ display: 'none' }}
          disabled={disabled}
          multiple
        >
          {allOptions.map((opt) => (
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
