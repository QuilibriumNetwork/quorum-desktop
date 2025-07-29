import React from 'react';

export interface FlexColumnProps {
  children: React.ReactNode;
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  wrap?: boolean;
  className?: string;
  style?: React.CSSProperties;
  testId?: string;
}