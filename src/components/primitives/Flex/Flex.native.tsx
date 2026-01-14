import React from 'react';
import { View, ViewStyle } from 'react-native';
import { FlexProps } from './types';

const justifyMap = {
  start: 'flex-start' as const,
  end: 'flex-end' as const,
  center: 'center' as const,
  between: 'space-between' as const,
  around: 'space-around' as const,
  evenly: 'space-evenly' as const,
};

const alignMap = {
  start: 'flex-start' as const,
  end: 'flex-end' as const,
  center: 'center' as const,
  stretch: 'stretch' as const,
  baseline: 'baseline' as const,
};

const gapMap = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Flex: React.FC<FlexProps> = ({
  children,
  direction = 'row',
  justify = 'start',
  align,
  gap = 'none',
  wrap = false,
  style,
  testId,
  ...rest
}) => {
  // Direction-dependent align default: row → center, column → stretch
  const effectiveAlign = align ?? (direction === 'row' ? 'center' : 'stretch');

  const gapValue =
    typeof gap === 'string' && gap in gapMap
      ? gapMap[gap as keyof typeof gapMap]
      : typeof gap === 'number'
        ? gap
        : 0;

  const viewStyle: ViewStyle = {
    flexDirection: direction,
    justifyContent: justifyMap[justify],
    alignItems: alignMap[effectiveAlign],
    flexWrap: wrap ? 'wrap' : 'nowrap',
    gap: gapValue,
    ...style,
  };

  return (
    <View style={viewStyle} testID={testId} {...rest}>
      {children}
    </View>
  );
};
