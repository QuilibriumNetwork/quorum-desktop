import React from 'react';
import clsx from 'clsx';
import { WebContainerProps } from './types';

const widthMap = {
  auto: 'w-auto',
  full: 'w-full',
  fit: 'w-fit',
};

const maxWidthMap = {
  xs: 'max-w-xs',
  sm: 'max-w-sm', 
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

const paddingMap = {
  none: 'p-0',
  xs: 'p-1',
  sm: 'p-2', 
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

const marginMap = {
  none: 'm-0',
  xs: 'm-1',
  sm: 'm-2',
  md: 'm-4', 
  lg: 'm-6',
  xl: 'm-8',
  auto: 'mx-auto',
};

export const Container = React.forwardRef<HTMLDivElement, WebContainerProps>(({
  children,
  className,
  style,
  width = 'auto',
  maxWidth,
  padding,
  margin,
  backgroundColor,
  testId,
  onClick,
  onMouseEnter,
  onMouseLeave,
  ...rest
}, ref) => {
  const widthClass = 
    typeof width === 'string' && width in widthMap
      ? widthMap[width as keyof typeof widthMap]
      : typeof width === 'string'
        ? width
        : undefined;

  const maxWidthClass =
    maxWidth && typeof maxWidth === 'string' && maxWidth in maxWidthMap
      ? maxWidthMap[maxWidth as keyof typeof maxWidthMap]
      : typeof maxWidth === 'string'
        ? maxWidth
        : undefined;

  const paddingClass =
    typeof padding === 'string' && padding in paddingMap
      ? paddingMap[padding as keyof typeof paddingMap]
      : typeof padding === 'number'
        ? `p-${padding}`
        : typeof padding === 'string'
          ? padding
          : undefined;

  const marginClass =
    typeof margin === 'string' && margin in marginMap
      ? marginMap[margin as keyof typeof marginMap]
      : typeof margin === 'number'
        ? `m-${margin}`
        : typeof margin === 'string'
          ? margin
          : undefined;

  const classes = clsx(
    widthClass,
    maxWidthClass,
    paddingClass,
    marginClass,
    className
  );

  const containerStyle = {
    backgroundColor,
    ...style,
  };

  return (
    <div
      ref={ref}
      className={classes}
      style={containerStyle}
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...rest}
    >
      {children}
    </div>
  );
});