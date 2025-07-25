import React from 'react';
import { FlexRow } from '../FlexRow';
import { FlexBetweenProps } from './types';

export const FlexBetween: React.FC<FlexBetweenProps> = ({
  children,
  align = 'center',
  wrap = false,
  className,
  style,
  ...rest
}) => {
  return (
    <FlexRow
      justify="between"
      align={align}
      wrap={wrap}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </FlexRow>
  );
};