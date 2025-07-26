import React from 'react';
import { RadioGroupWebProps } from './types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import './RadioGroup.scss';

export function RadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  direction = 'vertical',
  disabled = false,
  className = '',
  style,
  name = 'radio-group',
  testID,
}: RadioGroupWebProps<T>) {
  const handleChange = (optionValue: T) => {
    if (!disabled) {
      onChange(optionValue);
    }
  };

  return (
    <div
      className={`
        radio-group
        radio-group--${direction}
        ${disabled ? 'radio-group--disabled' : ''}
        ${className}
      `}
      style={style}
      data-testid={testID}
      role="radiogroup"
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const isDisabled = disabled || option.disabled;
        
        return (
          <label
            key={option.value}
            className={`
              radio-group__item
              ${isSelected ? 'radio-group__item--selected' : ''}
              ${isDisabled ? 'radio-group__item--disabled' : ''}
            `}
            onClick={() => !isDisabled && handleChange(option.value)}
          >
            <div className="radio-group__content">
              {option.icon && (
                <span className="radio-group__icon">
                  {/* Check if it's a FontAwesome icon or emoji */}
                  {typeof option.icon === 'object' ? (
                    <FontAwesomeIcon icon={option.icon as IconDefinition} />
                  ) : (
                    option.icon
                  )}
                </span>
              )}
              <span className="radio-group__label">{option.label}</span>
            </div>
            
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => handleChange(option.value)}
              disabled={isDisabled}
              className="radio-group__input"
              aria-label={option.label}
            />
          </label>
        );
      })}
    </div>
  );
}