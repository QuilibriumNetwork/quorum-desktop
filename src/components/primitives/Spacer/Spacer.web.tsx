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
  borderTop,
  borderBottom,
  spaceBefore,
  spaceAfter,
  border,
  className,
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
      <div className={className} data-testid={testId}>
        {/* Space before */}
        {spaceBefore && (
          <div
            style={
              isVertical
                ? { height: `${beforeValue}px` }
                : { width: `${beforeValue}px` }
            }
          />
        )}

        {/* Border */}
        <div
          className={isVertical ? 'border-t w-full' : 'border-l h-full'}
          style={isVertical ? { height: 0 } : { width: 0 }}
        />

        {/* Space after */}
        {spaceAfter && (
          <div
            style={
              isVertical
                ? { height: `${afterValue}px` }
                : { width: `${afterValue}px` }
            }
          />
        )}
      </div>
    );
  }

  // Regular spacer mode
  const spacingValue = typeof size === 'number' ? size : SPACING_MAP[size];

  const style =
    direction === 'vertical'
      ? {
          height: `${spacingValue}px`,
          width: borderTop || borderBottom ? '100%' : 0,
        }
      : {
          width: `${spacingValue}px`,
          height: borderTop || borderBottom ? '100%' : 0,
        };

  const borderClasses = [borderTop && 'border-t', borderBottom && 'border-b']
    .filter(Boolean)
    .join(' ');

  const combinedClassName = [borderClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div style={style} className={combinedClassName} data-testid={testId} />
  );
};
