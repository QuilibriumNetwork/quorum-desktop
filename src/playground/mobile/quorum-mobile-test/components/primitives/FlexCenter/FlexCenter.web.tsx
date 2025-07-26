import React from 'react';
import clsx from 'clsx';
import { FlexCenterProps } from './types';

export const FlexCenter: React.FC<FlexCenterProps> = ({
  children,
  direction = 'both',
  minHeight,
  wrap = false,
  className,
  style,
  ...rest
}) => {
  const justifyClass = direction === 'vertical' ? '' : 'justify-center';
  const alignClass = direction === 'horizontal' ? '' : 'items-center';

  const classes = clsx(
    'flex',
    justifyClass,
    alignClass,
    wrap && 'flex-wrap',
    className
  );

  const computedStyle = {
    minHeight: minHeight,
    ...style,
  };

  return (
    <div className={classes} style={computedStyle} {...rest}>
      {children}
    </div>
  );
};
