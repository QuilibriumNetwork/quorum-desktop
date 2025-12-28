import React from 'react';
import { RadioGroupWebProps } from './types';
import { Icon } from '../Icon';
import { Tooltip } from '../Tooltip';
import { isValidIconName } from '../Icon/iconMapping';
import './RadioGroup.scss';

export function RadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  direction = 'vertical',
  disabled = false,
  iconOnly = false,
  variant = 'default',
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
        radio-group--${variant}
        ${iconOnly ? 'radio-group--icon-only' : ''}
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

        const labelElement = (
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
                  {isValidIconName(option.icon) ? (
                    <Icon name={option.icon} size="sm" />
                  ) : (
                    option.icon
                  )}
                </span>
              )}
              {!iconOnly && <span className="radio-group__label">{option.label}</span>}
            </div>

            {!iconOnly && (
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
            )}
          </label>
        );

        if (option.tooltip) {
          return (
            <Tooltip
              key={option.value}
              id={`radio-${name}-${option.value}`}
              content={option.tooltip}
              place={option.tooltipPlace || 'top'}
            >
              {labelElement}
            </Tooltip>
          );
        }

        return labelElement;
      })}
    </div>
  );
}
