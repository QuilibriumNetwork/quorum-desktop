import React from 'react';
import { TouchableOpacity } from 'react-native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import { IconNativeProps, IconSize } from './types';
import { reactNativeIconMap } from './iconMapping';
import { useTheme } from '../theme';

// Convert semantic size to numeric size for React Native
const getSizeValue = (size: IconSize): number => {
  if (typeof size === 'number') {
    return size;
  }

  const sizeMap = {
    xs: 12,
    sm: 14,
    md: 16,
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
  className, // Ignored on native - for API consistency
  style = {},
  disabled = false,
  allowFontScaling = true,
  id, // Ignored on native - for API consistency
  onClick,
}: IconNativeProps) {
  const theme = useTheme();
  const colors = theme.colors;

  const iconName = reactNativeIconMap[name];

  if (!iconName) {
    console.warn(`Icon "${name}" not found in reactNative mapping`);
    return null;
  }

  const iconSize = getSizeValue(size);
  const iconColor = color || colors.text.main;

  const combinedStyle = {
    ...(disabled && { opacity: 0.5 }),
    ...style,
  };

  const iconComponent = (
    <FontAwesomeIcon
      name={iconName}
      size={iconSize}
      color={iconColor}
      style={combinedStyle}
      allowFontScaling={allowFontScaling}
    />
  );

  // If onClick is provided, wrap in TouchableOpacity
  if (onClick && !disabled) {
    return (
      <TouchableOpacity onPress={onClick} activeOpacity={0.7}>
        {iconComponent}
      </TouchableOpacity>
    );
  }

  return iconComponent;
}
