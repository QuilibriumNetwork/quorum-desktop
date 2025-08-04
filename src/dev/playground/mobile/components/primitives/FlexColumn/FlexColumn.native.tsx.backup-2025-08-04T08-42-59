import React from 'react';
import { View, ViewStyle } from 'react-native';
import { FlexColumnProps } from './types';

const justifyMap = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

const alignMap = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  stretch: 'stretch',
  baseline: 'baseline',
};

const gapMap = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const FlexColumn: React.FC<FlexColumnProps> = ({
  children,
  justify = 'start',
  align = 'stretch',
  gap = 'none',
  wrap = false,
  style,
  testId,
}) => {
  const gapValue =
    typeof gap === 'string' && gap in gapMap
      ? gapMap[gap as keyof typeof gapMap]
      : typeof gap === 'number'
        ? gap * 4 // Convert to px equivalent
        : 0;

  const containerStyle: ViewStyle = {
    flexDirection: 'column',
    justifyContent: justifyMap[justify] as any,
    alignItems: alignMap[align] as any,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    gap: gapValue,
    ...style,
  };

  return (
    <View style={containerStyle} testID={testId}>
      {children}
    </View>
  );
};
