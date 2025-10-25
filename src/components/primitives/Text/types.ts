import React from 'react';

export interface BaseTextProps {
  children: React.ReactNode;
  // NEW: Semantic typography prop for cross-platform consistency
  // When used, this takes precedence over variant/size/weight
  typography?:
    | 'title-large'
    | 'title'
    | 'subtitle'
    | 'subtitle-2'
    | 'body'
    | 'label'
    | 'label-strong'
    | 'small'
    | 'small-desktop';
  variant?:
    | 'default'
    | 'strong'
    | 'subtle'
    | 'muted'
    | 'error'
    | 'danger'
    | 'success'
    | 'warning'
    | 'link';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: string;
  className?: string;
  testId?: string;
  // Spacing props for better mobile experience
  marginBottom?: number;
  marginTop?: number;
  lineHeight?: number;
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
  accessibilityRole?: string;
  // Link-specific props (for React Native)
  href?: string;
  // Link styling options
  linkStyle?: 'default' | 'simple'; // 'default' = accent color + medium weight, 'simple' = inherit color + underline
  underline?: boolean;
  style?: any;
}

export type TextProps = WebTextProps | NativeTextProps;
