import React from 'react';
import { ScrollView, ViewStyle } from 'react-native';
import { NativeScrollContainerProps, ScrollContainerHeight } from './types';

const heightMap: Record<ScrollContainerHeight, number> = {
  xs: 200,
  sm: 280, // UserSettingsModal devices list
  md: 400, // SpaceEditor roles list
  lg: 500,
  xl: 600,
  auto: 0, // Will be handled separately
};

const borderRadiusMap = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
};

export const ScrollContainer: React.FC<NativeScrollContainerProps> = ({
  children,
  style,
  height = 'auto',
  maxHeight,
  showBorder = true,
  borderColor,
  borderRadius = 'lg',
  testId,
  showsVerticalScrollIndicator = true,
  showsHorizontalScrollIndicator = false,
  bounces = true,
  scrollEnabled = true,
  accessible,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  onScroll,
  onContentSizeChange,
  ...rest
}) => {
  // Handle height prop
  const containerHeight = React.useMemo(() => {
    if (typeof height === 'string' && height in heightMap) {
      return height === 'auto' ? undefined : heightMap[height as ScrollContainerHeight];
    }
    if (typeof height === 'number') {
      return height;
    }
    if (typeof height === 'string' && height !== 'auto') {
      // Try to parse pixel values like "300px"
      const match = height.match(/^(\d+)px$/);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return undefined; // auto case
  }, [height]);

  // Handle maxHeight prop (overrides height if both are provided)
  const containerMaxHeight = React.useMemo(() => {
    if (!maxHeight) return undefined;

    if (typeof maxHeight === 'string' && maxHeight in heightMap) {
      return maxHeight === 'auto' ? undefined : heightMap[maxHeight as ScrollContainerHeight];
    }
    if (typeof maxHeight === 'number') {
      return maxHeight;
    }
    if (typeof maxHeight === 'string' && maxHeight !== 'auto') {
      // Try to parse pixel values like "300px"
      const match = maxHeight.match(/^(\d+)px$/);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return undefined;
  }, [maxHeight]);

  // Border radius value
  const borderRadiusValue = typeof borderRadius === 'string' && borderRadius in borderRadiusMap
    ? borderRadiusMap[borderRadius as keyof typeof borderRadiusMap]
    : typeof borderRadius === 'number'
      ? borderRadius
      : 8; // default to 'lg'

  const containerStyle: ViewStyle = {
    height: containerMaxHeight || containerHeight,
    borderWidth: showBorder ? 1 : 0,
    borderColor: showBorder ? (borderColor || 'rgba(255, 255, 255, 0.1)') : 'transparent', // Use borderColor prop or default
    borderRadius: borderRadiusValue,
    ...style,
  };

  return (
    <ScrollView
      style={containerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      bounces={bounces}
      scrollEnabled={scrollEnabled}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      onScroll={onScroll}
      onContentSizeChange={onContentSizeChange}
      testID={testId}
      // Nested scrolling support
      nestedScrollEnabled={true}
      scrollEventThrottle={16}
      {...rest}
    >
      {children}
    </ScrollView>
  );
};