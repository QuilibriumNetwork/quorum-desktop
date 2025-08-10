import React from 'react';
import { View } from 'react-native';
import { NativeSpacerProps } from './types';

// Spacing values with clean progression
const SPACING_MAP = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Spacer: React.FC<NativeSpacerProps> = ({ 
  size, 
  direction = 'vertical',
  testId 
}) => {
  const spacingValue = typeof size === 'number' ? size : SPACING_MAP[size];
  
  const style: any = direction === 'vertical' 
    ? { height: spacingValue, width: 0 }
    : { width: spacingValue, height: 0 };

  return (
    <View 
      style={style}
      {...(testId ? { testID: testId } : {})}
    />
  );
};