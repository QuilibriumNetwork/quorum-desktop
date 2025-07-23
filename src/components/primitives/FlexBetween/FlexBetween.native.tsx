import React from 'react';
import { FlexRow } from '../FlexRow';
import { FlexBetweenProps } from './types';

export const FlexBetween: React.FC<FlexBetweenProps> = ({
  children,
  align = 'center',
  wrap = false,
  style,
  ...rest
}) => {
  return (
    <FlexRow
      justify="between"
      align={align}
      wrap={wrap}
      style={style}
      {...rest}
    >
      {children}
    </FlexRow>
  );
};