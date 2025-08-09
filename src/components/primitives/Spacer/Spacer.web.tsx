import React from 'react';
import { WebSpacerProps } from './types';

// Spacing values with clean progression
const SPACING_MAP = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Spacer: React.FC<WebSpacerProps> = ({ 
  size, 
  direction = 'vertical',
  className,
  testId 
}) => {
  const spacingValue = typeof size === 'number' ? size : SPACING_MAP[size];
  
  const style = direction === 'vertical' 
    ? { height: `${spacingValue}px`, width: 0 }
    : { width: `${spacingValue}px`, height: 0 };

  return (
    <div 
      style={style}
      className={className}
      data-testid={testId}
    />
  );
};