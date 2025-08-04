import React from 'react';
import { ColorSwatchWebProps } from './types';
import { Icon } from '../Icon';
import './ColorSwatch.scss';

// Helper function to get hex color for accent colors
const getColorHex = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    blue: '#3b82f6', // blue-500
    purple: '#8b5cf6', // purple-500
    fuchsia: '#d946ef', // fuchsia-500
    orange: '#f97316', // orange-500
    green: '#22c55e', // green-500
    yellow: '#eab308', // yellow-500
  };
  return colorMap[color] || '#3b82f6';
};

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
      style={{
        backgroundColor: getColorHex(color), // Use direct hex color
        ...style,
      }}
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
