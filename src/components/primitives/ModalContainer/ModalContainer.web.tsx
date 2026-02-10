import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { ModalContainerProps } from './types';
import { OverlayBackdrop } from '../OverlayBackdrop';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const previousFocusRef = useRef<Element | null>(null);

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

  // Save previous focus and focus first element on open
  useEffect(() => {
    if (!visible || !shouldRender) return;

    // Save the element that had focus before the modal opened
    previousFocusRef.current = document.activeElement;

    // Focus first focusable element after render
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [visible, shouldRender]);

  // Focus trap: cycle Tab within containerRef
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;

    const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

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

      // Restore focus to the element that was focused before modal opened
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
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
        onKeyDown={handleKeyDown}
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
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </OverlayBackdrop>
  );
};
