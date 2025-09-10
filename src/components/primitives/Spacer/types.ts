export type SpacerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
export type SpacerDirection = 'vertical' | 'horizontal';

export interface BaseSpacerProps {
  size: SpacerSize;
  direction?: SpacerDirection;
  borderTop?: boolean;
  borderBottom?: boolean;
  // Compound spacer: SPACE-BORDER-SPACE pattern
  spaceBefore?: SpacerSize;
  spaceAfter?: SpacerSize;
  border?: boolean; // Creates middle border with spaceBefore/spaceAfter
  testId?: string;
}

// Web-specific props
export interface WebSpacerProps extends BaseSpacerProps {
  className?: string;
}

// Native-specific props
export interface NativeSpacerProps extends BaseSpacerProps {
  // React Native specific props can be added here if needed
}

export type SpacerProps = WebSpacerProps | NativeSpacerProps;