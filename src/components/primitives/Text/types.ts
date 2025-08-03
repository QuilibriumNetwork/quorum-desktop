import React from 'react';

export interface BaseTextProps {
  children: React.ReactNode;
  variant?: 'default' | 'strong' | 'subtle' | 'muted' | 'error' | 'success' | 'warning' | 'link';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: string;
  className?: string;
  testId?: string;
}

// Web-specific props
export interface WebTextProps extends BaseTextProps {
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'a';
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent) => void;
  // Link-specific props (when as="a")
  href?: string;
  target?: string;
  rel?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

// Native-specific props
export interface NativeTextProps extends BaseTextProps {
  numberOfLines?: number;
  onPress?: () => void;
  selectable?: boolean;
  accessible?: boolean;
  accessibilityLabel?: string;
  // Link-specific props (for React Native)
  href?: string;
}

export type TextProps = WebTextProps | NativeTextProps;