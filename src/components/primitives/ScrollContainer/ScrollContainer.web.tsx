import React from 'react';
import clsx from 'clsx';
import { WebScrollContainerProps, ScrollContainerHeight, ScrollContainerBorderRadius } from './types';

const heightMap: Record<ScrollContainerHeight, string> = {
  xs: 'max-h-[200px]',
  sm: 'max-h-[280px]', // UserSettingsModal devices list
  md: 'max-h-[400px]', // SpaceEditor roles list
  lg: 'max-h-[500px]',
  xl: 'max-h-[600px]',
  auto: '',
};

const borderRadiusMap: Record<ScrollContainerBorderRadius, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
};

export const ScrollContainer = React.forwardRef<HTMLDivElement, WebScrollContainerProps>(
  (
    {
      children,
      className,
      style,
      height = 'auto',
      maxHeight,
      showBorder = true,
      borderRadius = 'lg',
      testId,
      onScroll,
      ...rest
    },
    ref
  ) => {
    // Handle height prop
    const heightClass = React.useMemo(() => {
      if (typeof height === 'string' && height in heightMap) {
        return heightMap[height as ScrollContainerHeight];
      }
      if (typeof height === 'string' && height !== 'auto') {
        return height; // Custom CSS class or value
      }
      if (typeof height === 'number') {
        return `max-h-[${height}px]`;
      }
      return ''; // auto case
    }, [height]);

    // Handle maxHeight prop (overrides height if both are provided)
    const maxHeightClass = React.useMemo(() => {
      if (!maxHeight) return '';

      if (typeof maxHeight === 'string' && maxHeight in heightMap) {
        return heightMap[maxHeight as ScrollContainerHeight];
      }
      if (typeof maxHeight === 'string' && maxHeight !== 'auto') {
        return maxHeight; // Custom CSS class or value
      }
      if (typeof maxHeight === 'number') {
        return `max-h-[${maxHeight}px]`;
      }
      return '';
    }, [maxHeight]);

    // Border radius class
    const borderRadiusClass = borderRadius in borderRadiusMap
      ? borderRadiusMap[borderRadius as ScrollContainerBorderRadius]
      : borderRadius;

    const classes = clsx(
      'overflow-y-auto', // Enable vertical scrolling
      maxHeightClass || heightClass, // Use maxHeight if provided, otherwise height
      showBorder && 'border border-surface-6', // Standard border from existing patterns
      borderRadiusClass, // Border radius
      className
    );

    return (
      <div
        ref={ref}
        className={classes}
        style={style}
        data-testid={testId}
        onScroll={onScroll}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

ScrollContainer.displayName = 'ScrollContainer';