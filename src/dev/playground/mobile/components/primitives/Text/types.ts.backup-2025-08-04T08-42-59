import React from 'react';

export interface BaseTextProps {
  children: React.ReactNode;
  variant?:
    | 'default'
    | 'strong'
    | 'subtle'
    | 'muted'
    | 'error'
    | 'success'
    | 'warning';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: string;
  className?: string;
  testId?: string;
}

// Web-specific props
export interface WebTextProps extends BaseTextProps {
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div';
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent) => void;
}

// Native-specific props
export interface NativeTextProps extends BaseTextProps {
  numberOfLines?: number;
  onPress?: () => void;
  selectable?: boolean;
  accessible?: boolean;
  accessibilityLabel?: string;
}

export type TextProps = WebTextProps | NativeTextProps;
