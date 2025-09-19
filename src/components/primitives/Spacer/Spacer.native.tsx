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
  borderTop,
  borderBottom,
  borderColor = '#e5e7eb', // Default border color
  spaceBefore,
  spaceAfter,
  border,
  testId,
}) => {
  // Compound spacer mode: SPACE-BORDER-SPACE
  if ((spaceBefore || spaceAfter) && border) {
    const beforeValue = spaceBefore
      ? typeof spaceBefore === 'number'
        ? spaceBefore
        : SPACING_MAP[spaceBefore]
      : 0;
    const afterValue = spaceAfter
      ? typeof spaceAfter === 'number'
        ? spaceAfter
        : SPACING_MAP[spaceAfter]
      : 0;

    const isVertical = direction === 'vertical';

    return (
      <View {...(testId ? { testID: testId } : {})}>
        {/* Space before */}
        {spaceBefore && (
          <View
            style={
              isVertical ? { height: beforeValue } : { width: beforeValue }
            }
          />
        )}

        {/* Border */}
        <View
          style={{
            ...(isVertical
              ? {
                  height: 0,
                  width: '100%',
                  borderTopWidth: 1,
                  borderTopColor: borderColor,
                }
              : {
                  width: 0,
                  height: '100%',
                  borderLeftWidth: 1,
                  borderLeftColor: borderColor,
                }),
          }}
        />

        {/* Space after */}
        {spaceAfter && (
          <View
            style={isVertical ? { height: afterValue } : { width: afterValue }}
          />
        )}
      </View>
    );
  }

  // Regular spacer mode
  const spacingValue = typeof size === 'number' ? size : SPACING_MAP[size];

  const baseStyle: any =
    direction === 'vertical'
      ? { height: spacingValue, width: borderTop || borderBottom ? '100%' : 0 }
      : { width: spacingValue, height: borderTop || borderBottom ? '100%' : 0 };

  const borderStyle: any = {
    ...(borderTop && {
      borderTopWidth: 1,
      borderTopColor: borderColor,
    }),
    ...(borderBottom && {
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    }),
  };

  const style = { ...baseStyle, ...borderStyle };

  return <View style={style} {...(testId ? { testID: testId } : {})} />;
};
