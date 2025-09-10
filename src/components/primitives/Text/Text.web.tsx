import React from 'react';
import clsx from 'clsx';
import { WebTextProps } from './types';
import './Text.scss';

const variantMap = {
  default: 'text-main',
  strong: 'text-strong',
  subtle: 'text-subtle',
  muted: 'text-muted',
  error: 'text-red-600 dark:text-red-400',
  danger: 'text-danger',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  link: 'text-link-primitive',
};

const sizeMap = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
};

const weightMap = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const alignMap = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export const Text: React.FC<WebTextProps> = ({
  children,
  as: Component = 'span',
  variant = 'default',
  size = 'base',
  weight = 'normal',
  align = 'left',
  color,
  className,
  style,
  testId,
  onClick,
  href,
  target,
  rel,
  referrerPolicy,
  ...rest
}) => {
  // Auto-detect link variant when as="a" and no variant is specified
  const finalVariant =
    Component === 'a' && variant === 'default' ? 'link' : variant;

  const classes = clsx(
    variantMap[finalVariant],
    sizeMap[size],
    weightMap[weight],
    alignMap[align],
    className
  );

  const textStyle = {
    color,
    ...style,
  };

  return (
    <Component
      className={classes}
      style={textStyle}
      data-testid={testId}
      onClick={onClick}
      href={href}
      target={target}
      rel={rel}
      referrerPolicy={referrerPolicy}
      {...rest}
    >
      {children}
    </Component>
  );
};
