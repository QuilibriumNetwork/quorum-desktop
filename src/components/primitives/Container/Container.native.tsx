import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { NativeContainerProps } from './types';

const widthMap = {
  auto: undefined,
  full: '100%',
  fit: undefined,
};

const paddingMap = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const marginMap = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  auto: 'auto',
};

export const Container: React.FC<NativeContainerProps> = ({
  children,
  width = 'auto',
  maxWidth,
  padding,
  margin,
  backgroundColor,
  testId,
  onPress,
  accessible,
  accessibilityLabel,
  style,
}) => {
  const containerWidth =
    typeof width === 'string' && width in widthMap
      ? widthMap[width as keyof typeof widthMap]
      : width;

  const containerMaxWidth =
    typeof maxWidth === 'string' && maxWidth.includes('px')
      ? parseInt(maxWidth.replace('px', ''))
      : maxWidth;

  const containerPadding =
    typeof padding === 'string' && padding in paddingMap
      ? paddingMap[padding as keyof typeof paddingMap]
      : padding; // Use number values directly (they're already in pixels)

  const containerMargin =
    typeof margin === 'string' && margin in marginMap
      ? marginMap[margin as keyof typeof marginMap]
      : margin; // Use number values directly (they're already in pixels)

  const containerStyle: ViewStyle = {
    width: containerWidth,
    maxWidth: containerMaxWidth,
    padding: containerPadding,
    margin: containerMargin,
    backgroundColor,
    ...style,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        testID={testId}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={containerStyle}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      testID={testId}
    >
      {children}
    </View>
  );
};
