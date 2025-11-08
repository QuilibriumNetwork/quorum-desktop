import React from 'react';
import * as IconLibrary from '@tabler/icons-react';
import { IconWebProps, IconSize } from './types';
import { iconComponentMap } from './iconMapping';
import './Icon.scss';

// Convert semantic size to pixel size
const getSizeValue = (size: IconSize): number => {
  if (typeof size === 'number') return size;

  const sizeMap = {
    xs: 12,
    sm: 16,
    md: 18,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
    '5xl': 96,
  };

  return sizeMap[size] || 16;
};

export function Icon({
  name,
  size = 'md',
  color,
  className = '',
  style = {},
  disabled = false,
  id,
  onClick,
  variant = 'outline',
}: IconWebProps) {
  const iconComponentName = iconComponentMap[name];

  if (!iconComponentName) {
    console.warn(`Icon "${name}" not found in icon mapping`);
    return null;
  }

  // Allow global flag to override variant for quick testing (development only)
  // Usage: In browser console, run: localStorage.setItem('__FORCE_FILLED_ICONS__', 'true')
  // To disable: localStorage.removeItem('__FORCE_FILLED_ICONS__')
  const forceFilledFlag = process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' &&
    localStorage.getItem('__FORCE_FILLED_ICONS__') === 'true';

  const effectiveVariant = forceFilledFlag ? 'filled' : variant;

  // Determine final component name based on variant
  const finalComponentName = effectiveVariant === 'filled'
    ? `${iconComponentName}Filled`
    : iconComponentName;

  const IconComponent = (IconLibrary as any)[finalComponentName];

  if (!IconComponent) {
    // If filled variant doesn't exist, try falling back to outline
    if (effectiveVariant === 'filled') {
      console.warn(
        `Icon "${name}" does not have a filled variant. Falling back to outline.`
      );
      const OutlineIcon = (IconLibrary as any)[iconComponentName];
      if (!OutlineIcon) {
        console.warn(`Icon component "${iconComponentName}" not found in icon library`);
        return null;
      }
      // Use the outline icon as fallback
      return renderIcon(OutlineIcon);
    }
    console.warn(`Icon component "${finalComponentName}" not found in icon library`);
    return null;
  }

  return renderIcon(IconComponent);

  function renderIcon(Component: any) {
    const iconSize = getSizeValue(size);

    // Note: stroke scales proportionally with size (Tabler default behavior)
    // 24px = 2px stroke (default)
    // 18px = 1.5px stroke (proportional)
    // 12px = 1px stroke (proportional)

    const combinedStyle = {
      ...(disabled && { opacity: 0.5 }),
      ...(onClick && { cursor: 'pointer' }),
      ...style,
    };

    // Use color from style prop if provided, otherwise use color prop, otherwise default to currentColor
    // Convert 'inherit' to 'currentColor' for SVG compatibility
    let iconColor = (style && style.color) || color || 'currentColor';
    if (iconColor === 'inherit') {
      iconColor = 'currentColor';
    }

    return (
      <Component
        size={iconSize}
        color={iconColor}
        className={className}
        style={combinedStyle}
        id={id}
        onClick={onClick}
      />
    );
  }
}
