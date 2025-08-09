export type SpacerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
export type SpacerDirection = 'vertical' | 'horizontal';

export interface BaseSpacerProps {
  size: SpacerSize;
  direction?: SpacerDirection;
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