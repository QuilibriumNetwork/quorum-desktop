import React from 'react';
import { Text as RNText, TextStyle, TouchableOpacity } from 'react-native';
import { NativeTextProps } from './types';

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

// These would map to your theme colors
const variantColorMap = {
  default: '#000000', // This should come from your theme
  strong: '#000000',
  subtle: '#666666',
  muted: '#999999',
  error: '#dc2626',
  success: '#16a34a',
  warning: '#ca8a04',
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
}) => {
  const textStyle: TextStyle = {
    fontSize: sizeMap[size],
    fontWeight: weightMap[weight] as any,
    textAlign: alignMap[align] as any,
    color: color || variantColorMap[variant],
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

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress}>
        {textContent}
      </TouchableOpacity>
    );
  }

  return textContent;
};