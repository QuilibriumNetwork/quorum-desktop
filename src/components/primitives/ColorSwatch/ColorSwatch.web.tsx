import React from 'react';
import { ColorSwatchWebProps } from './types';
import { Icon } from '../Icon';
import './ColorSwatch.scss';

export const ColorSwatch: React.FC<ColorSwatchWebProps> = ({
  color,
  isActive = false,
  onPress,
  size = 'medium',
  showCheckmark = true,
  disabled = false,
  className = '',
  style,
  testID,
}) => {
  const handleClick = () => {
    if (!disabled && onPress) {
      onPress();
    }
  };

  return (
    <div
      className={`
        color-swatch
        color-swatch--${size}
        accent-${color}
        ${isActive ? 'color-swatch--active' : ''}
        ${disabled ? 'color-swatch--disabled' : ''}
        ${className}
      `}
      onClick={handleClick}
      style={style}
      data-testid={testID}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isActive}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {isActive && showCheckmark && (
        <Icon
          name="check"
          size={size === 'small' ? 'xs' : size === 'large' ? 'lg' : 'sm'}
          className="color-swatch__checkmark"
        />
      )}
    </div>
  );
};
