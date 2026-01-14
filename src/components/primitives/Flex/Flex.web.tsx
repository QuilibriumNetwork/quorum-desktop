import React from 'react';
import clsx from 'clsx';
import { FlexProps } from './types';

const justifyMap = {
  start: 'justify-start',
  end: 'justify-end',
  center: 'justify-center',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const alignMap = {
  start: 'items-start',
  end: 'items-end',
  center: 'items-center',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  (
    {
      children,
      direction = 'row',
      justify = 'start',
      align,
      gap = 'none',
      wrap = false,
      className,
      style,
      testId,
      ...rest
    },
    ref
  ) => {
    // Direction-dependent align default: row → center, column → stretch
    const effectiveAlign = align ?? (direction === 'row' ? 'center' : 'stretch');

    const gapClass =
      typeof gap === 'string' && gap in gapMap
        ? gapMap[gap as keyof typeof gapMap]
        : typeof gap === 'number'
          ? `gap-${gap}`
          : typeof gap === 'string'
            ? gap
            : 'gap-0';

    const classes = clsx(
      'flex',
      direction === 'row' ? 'flex-row' : 'flex-col',
      justifyMap[justify],
      alignMap[effectiveAlign],
      gapClass,
      wrap && 'flex-wrap',
      className
    );

    return (
      <div ref={ref} className={classes} style={style} data-testid={testId} {...rest}>
        {children}
      </div>
    );
  }
);
