import React from 'react';
import clsx from 'clsx';
import { OverlayBackdropProps } from './types';

export const OverlayBackdrop: React.FC<OverlayBackdropProps> = ({
  visible = true,
  onBackdropClick,
  zIndex = 'z-[9999]',
  blur = true,
  opacity,
  children,
  className,
  closeOnBackdropClick = true,
}) => {
  if (!visible) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only trigger if clicking the backdrop itself, not children
    if (e.target === e.currentTarget && closeOnBackdropClick && onBackdropClick) {
      onBackdropClick();
    }
  };

  const backdropClasses = clsx(
    'fixed inset-0',
    zIndex,
    'flex items-center justify-center',
    'bg-overlay',
    blur && 'backdrop-blur',
    className
  );

  const style = opacity !== undefined ? { backgroundColor: `rgba(0, 0, 0, ${opacity})` } : undefined;

  return (
    <div 
      className={backdropClasses} 
      onClick={handleBackdropClick}
      style={style}
    >
      {children}
    </div>
  );
};