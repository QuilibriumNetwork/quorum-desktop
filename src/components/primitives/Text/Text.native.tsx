import React from 'react';
import { Text as RNText, TextStyle, TouchableOpacity, Linking } from 'react-native';
import { NativeTextProps } from './types';
import { useCrossPlatformTheme } from '../theme/ThemeProvider';

const sizeMap = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
};

const weightMap = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

const alignMap = {
  left: 'left',
  center: 'center',
  right: 'right',
};


export const Text: React.FC<NativeTextProps> = ({
  children,
  variant = 'default',
  size = 'base',
  weight = 'normal',
  align = 'left',
  color,
  numberOfLines,
  onPress,
  selectable = true,
  accessible,
  accessibilityLabel,
  testId,
  href,
}) => {
  const theme = useCrossPlatformTheme();
  const colors = theme.colors;

  // Map variants to theme colors
  const getVariantColor = () => {
    switch (variant) {
      case 'strong':
        return colors.text.strong;
      case 'subtle':
        return colors.text.subtle;
      case 'muted':
        return colors.text.muted;
      case 'error':
        return colors.utilities.danger;
      case 'success':
        return colors.utilities.success;
      case 'warning':
        return colors.utilities.warning;
      case 'link':
        return colors.accent[300]; // Use accent color for links
      default:
        return colors.text.main;
    }
  };

  const textStyle: TextStyle = {
    fontSize: sizeMap[size],
    fontWeight: weightMap[weight] as any,
    textAlign: alignMap[align] as any,
    color: color || getVariantColor(),
  };

  const textContent = (
    <RNText
      style={textStyle}
      numberOfLines={numberOfLines}
      selectable={selectable}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      testID={testId}
    >
      {children}
    </RNText>
  );

  // Handle link functionality in React Native
  const handlePress = () => {
    if (href) {
      Linking.openURL(href).catch(err => console.error('Failed to open URL:', err));
    } else if (onPress) {
      onPress();
    }
  };

  if (onPress || href) {
    return (
      <TouchableOpacity onPress={handlePress}>
        {textContent}
      </TouchableOpacity>
    );
  }

  return textContent;
};