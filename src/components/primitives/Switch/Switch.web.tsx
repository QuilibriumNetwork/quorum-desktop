import React from 'react';
import { WebSwitchProps } from './types';
import './Switch.scss';

export const Switch: React.FC<WebSwitchProps> = ({
  value,
  onChange,
  disabled = false,
  size = 'medium',
  variant = 'default',
  accessibilityLabel,
  className,
  style,
  testID,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(event.target.checked);
    }
  };

  const switchClasses = [
    'switch-container',
    `switch-${size}`,
    `switch-${variant}`,
    value && 'switch-on',
    disabled && 'switch-disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label
      className={switchClasses}
      style={style}
      data-testid={testID}
      aria-label={accessibilityLabel}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={handleChange}
        disabled={disabled}
        className="switch-input"
        aria-label={accessibilityLabel}
      />
      <span className="switch-slider">
        <span className="switch-thumb" />
      </span>
    </label>
  );
};
