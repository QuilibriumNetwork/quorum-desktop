import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconWebProps, IconSize } from './types';
import { fontAwesomeIconMap } from './iconMapping';

// Convert semantic size to FontAwesome size
const getSizeValue = (size: IconSize): any => {
  if (typeof size === 'number') {
    return { fontSize: `${size}px` };
  }

  const sizeMap = {
    xs: 'xs',
    sm: 'sm',
    md: '1x',
    lg: 'lg',
    xl: 'xl',
  };

  return sizeMap[size] || '1x';
};

export function Icon({
  name,
  size = 'md',
  color,
  className = '',
  style = {},
  disabled = false,
  rotation,
  flip,
  spin = false,
  pulse = false,
  fixedWidth = false,
  id,
}: IconWebProps) {
  const fontAwesomeIcon = fontAwesomeIconMap[name];

  if (!fontAwesomeIcon) {
    console.warn(`Icon "${name}" not found in fontAwesome mapping`);
    return null;
  }

  // Handle custom size (number) vs semantic size (string)
  const sizeStyle = typeof size === 'number' ? getSizeValue(size) : {};
  const faSize = typeof size === 'string' ? getSizeValue(size) : undefined;

  const combinedStyle = {
    ...sizeStyle,
    ...(color && { color }),
    ...(disabled && { opacity: 0.5 }),
    ...style,
  };

  return (
    <FontAwesomeIcon
      icon={fontAwesomeIcon}
      size={faSize}
      className={className}
      style={combinedStyle}
      rotation={rotation}
      flip={flip}
      spin={spin}
      pulse={pulse}
      fixedWidth={fixedWidth}
      id={id}
    />
  );
}
