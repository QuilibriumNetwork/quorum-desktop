import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { ModalContainerProps } from './types';
import { OverlayBackdrop } from '../OverlayBackdrop';

export const ModalContainer: React.FC<ModalContainerProps> = ({
  visible,
  onClose,
  children,
  closeOnBackdropClick = true,
  showBackdrop = true,
  backdropBlur = true,
  zIndex = 'z-[10100]', // Higher than MobileDrawer (10000) and DropdownPanel (10001)
  className,
  animationDuration = 300,
  closeOnEscape = true,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(visible);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    } else if (!isClosing) {
      // If visible becomes false but we're not in a closing animation,
      // immediately hide the modal
      setShouldRender(false);
    }
  }, [visible, isClosing]);

  // Handle escape key
  useEffect(() => {
    if (!visible || !closeOnEscape || !onClose) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible, closeOnEscape, onClose]);

  const handleClose = () => {
    if (!onClose) return;

    setIsClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
    }, animationDuration);
  };

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      handleClose();
    }
  };

  if (!shouldRender) return null;

  const contentClasses = clsx(
    'pointer-events-auto',
    isClosing && 'opacity-0 scale-95',
    !isClosing && 'animate-modalOpen',
    'transition-all duration-300',
    className
  );

  if (!showBackdrop) {
    return (
      <div
        ref={containerRef}
        className={contentClasses}
        style={{ animationDuration: `${animationDuration}ms` }}
      >
        {children}
      </div>
    );
  }

  return (
    <OverlayBackdrop
      visible={true}
      onBackdropClick={handleBackdropClick}
      zIndex={zIndex}
      blur={backdropBlur}
      closeOnBackdropClick={closeOnBackdropClick}
    >
      <div
        ref={containerRef}
        className={contentClasses}
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: `${animationDuration}ms` }}
      >
        {children}
      </div>
    </OverlayBackdrop>
  );
};
