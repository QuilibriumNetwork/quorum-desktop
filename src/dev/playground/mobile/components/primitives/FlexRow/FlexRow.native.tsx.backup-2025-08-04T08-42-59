import React from 'react';
import { View, ViewStyle } from 'react-native';
import { FlexRowProps } from './types';

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

const gapToNumber = (gap: string | number): number => {
  if (typeof gap === 'number') return gap;

  const gapValues = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  };

  return gapValues[gap as keyof typeof gapValues] || 0;
};

export const FlexRow: React.FC<FlexRowProps> = ({
  children,
  justify = 'start',
  align = 'center',
  gap = 'none',
  wrap = false,
  style,
  ...rest
}) => {
  const gapValue = gapToNumber(gap as string | number);

  const viewStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: justifyMap[justify],
    alignItems: alignMap[align],
    flexWrap: wrap ? 'wrap' : 'nowrap',
    gap: gapValue,
    ...style,
  };

  return (
    <View style={viewStyle} {...rest}>
      {children}
    </View>
  );
};
