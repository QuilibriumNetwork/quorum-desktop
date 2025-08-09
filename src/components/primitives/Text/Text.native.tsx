import React from 'react';
import {
  Text as RNText,
  TextStyle,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { NativeTextProps } from './types';
import { useTheme } from '../theme';

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
  accessibilityRole,
  testId,
  href,
  linkStyle = 'default',
  underline,
  style,
  marginBottom,
  marginTop,
  lineHeight,
}) => {
  const theme = useTheme();
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
        return colors.link.default; // Use link color from theme
      default:
        return colors.text.main;
    }
  };

  // Determine if this is a link and what style to use
  const isLink = !!(href || onPress);
  const isDefaultLinkStyle = linkStyle === 'default' || variant === 'link';
  const isSimpleLinkStyle = linkStyle === 'simple';
  
  // Get link color and weight
  const getLinkColor = () => {
    if (isDefaultLinkStyle) {
      return color || colors.link.default;
    }
    if (isSimpleLinkStyle) {
      return color || getVariantColor(); // Inherit surrounding color
    }
    return color || getVariantColor();
  };
  
  const getLinkWeight = () => {
    if (isDefaultLinkStyle) {
      return weight || 'medium'; // Default link weight is medium (500)
    }
    return weight; // For simple links, inherit weight
  };

  // Default line height based on size for better readability
  const getDefaultLineHeight = () => {
    const fontSize = sizeMap[size];
    return fontSize * 1.4; // 1.4 ratio for good readability
  };

  // Use link-aware color and weight if this is a link
  const finalColor = isLink ? getLinkColor() : (color || getVariantColor());
  const finalWeight = isLink ? getLinkWeight() : weight;

  const textStyle: TextStyle = {
    fontSize: sizeMap[size],
    fontWeight: weightMap[finalWeight] as any,
    textAlign: alignMap[align] as any,
    color: finalColor,
    lineHeight: lineHeight || getDefaultLineHeight(),
    marginBottom: marginBottom,
    marginTop: marginTop,
    includeFontPadding: false, // Better alignment on Android
    // Add underline for simple link style or explicit underline prop
    ...((isSimpleLinkStyle || underline) && {
      textDecorationLine: 'underline',
      textDecorationColor: finalColor,
      textDecorationStyle: 'solid',
    }),
    // Merge additional styles
    ...style,
  };

  const textContent = (
    <RNText
      style={textStyle}
      numberOfLines={numberOfLines}
      selectable={selectable}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={isLink ? 'link' : accessibilityRole}
      testID={testId}
      onPress={isLink ? handlePress : undefined}
    >
      {children}
    </RNText>
  );

  // Handle link functionality in React Native
  const handlePress = () => {
    if (href) {
      Linking.openURL(href).catch((err: any) =>
        console.error('Failed to open URL:', err)
      );
    } else if (onPress) {
      onPress();
    }
  };

  // For inline links, we don't want TouchableOpacity wrapper as it can cause layout issues
  // Instead, use onPress directly on the Text component for better inline behavior
  return textContent;
};
