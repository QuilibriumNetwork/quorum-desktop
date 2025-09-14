import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { CalloutWebProps } from './types';
import { Icon } from '../Icon';
import { IconName } from '../Icon/types';
import './Callout.scss';

const variantIcons: Record<string, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'exclamation-triangle',
  error: 'exclamation-triangle',
};

const variantClasses = {
  base: {
    info: 'border-info/30 bg-info/10 text-info',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    error: 'border-danger/30 bg-danger/10 text-danger',
  },
  minimal: {
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-danger',
  },
};

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
};

const iconSizes = {
  xs: 'sm',
  sm: 'md',
  md: 'lg',
} as const;

const Callout: React.FC<CalloutWebProps> = ({
  variant,
  children,
  size = 'sm',
  layout = 'base',
  dismissible = false,
  autoClose,
  onClose,
  className,
  testID,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose && autoClose > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoClose * 1000);

      return () => clearTimeout(timer);
    }
  }, [autoClose]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  const isBase = layout === 'base';
  const baseClasses = isBase
    ? clsx(
        'rounded-lg border px-3 py-2',
        variantClasses.base[variant]
      )
    : '';

  return (
    <div
      data-testid={testID}
      className={clsx(
        'callout',
        'flex items-start gap-2 transition-all duration-200',
        `callout-${variant}`, // Add variant class for CSS overrides
        isBase ? 'callout-base' : 'callout-minimal', // Add layout class
        isBase && baseClasses,
        !isBase && variantClasses.minimal[variant],
        sizeClasses[size],
        className
      )}
    >
      <Icon
        name={variantIcons[variant]}
        size={iconSizes[size]}
        className={clsx(
          'flex-shrink-0',
          isBase ? 'mt-0.5' : 'mt-0.5'
        )}
        style={!isBase ? { marginTop: '2px' } : undefined}
      />
      <div className="flex-1">{children}</div>
      {dismissible && (
        <button
          onClick={handleClose}
          className={clsx(
            'flex-shrink-0 transition-opacity hover:opacity-70 focus:outline-none focus:ring-0 border-none',
            isBase ? '-mt-0.5 -mr-0.5' : ''
          )}
          aria-label="Dismiss"
        >
          <Icon name="times" size={iconSizes[size]} />
        </button>
      )}
    </div>
  );
};

export default Callout;