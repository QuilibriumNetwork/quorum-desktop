import React from 'react';
import { View, ViewStyle } from 'react-native';
import { FlexCenterProps } from './types';

export const FlexCenter: React.FC<FlexCenterProps> = ({
  children,
  direction = 'both',
  minHeight,
  wrap = false,
  style,
  ...rest
}) => {
  const justifyContent = direction === 'vertical' ? undefined : 'center';
  const alignItems = direction === 'horizontal' ? undefined : 'center';
  
  const viewStyle: ViewStyle = {
    display: 'flex',
    justifyContent,
    alignItems,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    minHeight: typeof minHeight === 'number' ? minHeight : undefined,
    ...style,
  };

  return (
    <View style={viewStyle} {...rest}>
      {children}
    </View>
  );
};