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

// NEW: Typography mappings for semantic text styles
// Maps to the same styles as _typography.scss on web
const typographyMap = {
  'title-large': {
    fontSize: 24, // text-2xl
    fontWeight: '700', // bold
    letterSpacing: 0.025, // tracking-wide
    colorVariant: 'strong' as const,
  },
  'title': {
    fontSize: 20, // text-xl
    fontWeight: '700', // bold
    letterSpacing: 0.025, // tracking-wide
    colorVariant: 'strong' as const,
  },
  'subtitle': {
    fontSize: 18, // text-lg
    fontWeight: '700', // bold
    letterSpacing: 0.025, // tracking-wide
    colorVariant: 'default' as const,
  },
  'subtitle-2': {
    fontSize: 14, // text-sm
    fontWeight: '700', // bold
    colorVariant: 'subtle' as const,
    // Note: text-transform uppercase not directly supported in inline styles
  },
  'body': {
    fontSize: 16, // text-base
    fontWeight: '400', // normal
    colorVariant: 'default' as const,
  },
  'label': {
    fontSize: 14, // text-sm
    fontWeight: '400', // normal
    colorVariant: 'subtle' as const,
  },
  'label-strong': {
    fontSize: 14, // text-sm
    fontWeight: '400', // normal
    colorVariant: 'default' as const,
  },
  'small': {
    fontSize: 14, // text-xs-responsive (14px on mobile)
    fontWeight: '400', // normal
    colorVariant: 'subtle' as const,
  },
  'small-desktop': {
    fontSize: 12, // text-xs (always 12px)
    fontWeight: '400', // normal
    colorVariant: 'subtle' as const,
  },
};

export const Text: React.FC<NativeTextProps> = ({
  children,
  typography,
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
      case 'danger':
        return colors.text.danger;
      case 'success':
        return colors.utilities.success;
      case 'warning':
        return colors.utilities.warning;
      case 'link':
        return colors.link.default;
      default:
        return colors.text.main;
    }
  };

  // NEW: If typography prop is used, apply semantic styling
  if (typography) {
    const typoStyle = typographyMap[typography];

    // Map colorVariant to actual theme color (default from typography)
    const getTypographyColor = () => {
      switch (typoStyle.colorVariant) {
        case 'strong':
          return colors.text.strong;
        case 'subtle':
          return colors.text.subtle;
        default:
          return colors.text.main;
      }
    };

    // Allow variant prop to override typography's default color
    const finalColor = variant !== 'default' ? getVariantColor() : getTypographyColor();

    const textStyle: TextStyle = {
      fontSize: typoStyle.fontSize,
      fontWeight: typoStyle.fontWeight as any,
      letterSpacing: typoStyle.letterSpacing,
      textAlign: alignMap[align] as any,
      color: color || finalColor, // color prop > variant > typography default
      lineHeight: lineHeight || typoStyle.fontSize * 1.4,
      marginBottom: marginBottom,
      marginTop: marginTop,
      includeFontPadding: false,
      ...style,
    };

    return (
      <RNText
        style={textStyle}
        numberOfLines={numberOfLines}
        selectable={selectable}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        testID={testId}
        onPress={onPress}
      >
        {children}
      </RNText>
    );
  }

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
  const finalColor = isLink ? getLinkColor() : color || getVariantColor();
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

  // For inline links, we don't want TouchableOpacity wrapper as it can cause layout issues
  // Instead, use onPress directly on the Text component for better inline behavior
  return textContent;
};
