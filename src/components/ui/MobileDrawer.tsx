// This is for mobile users using the web app, for the native app we have /primitives/Modal/Modal.native.tsx

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@lingui/core/macro';
import { Text, Button, OverlayBackdrop } from '../primitives';
import './MobileDrawer.scss';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  enableSwipeToClose?: boolean;
  ariaLabel?: string;
  headerContent?: React.ReactNode; // Optional content to render in header area (e.g., emoji reactions)
  children: React.ReactNode;
}

/**
 * Common mobile drawer component with slide animations.
 * Provides consistent behavior for all mobile drawer interfaces.
 */
const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  title,
  showCloseButton = true,
  enableSwipeToClose = true,
  ariaLabel,
  headerContent,
  children,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Ref for the drawer element to apply transform from header touch handlers
  const drawerRef = React.useRef<HTMLDivElement>(null);

  // Swipe gesture state
  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle visibility changes with animation
  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      // Wait for animation to complete before hiding
      setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300); // Match CSS animation duration
    }
  }, [isOpen, shouldRender]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableSwipeToClose) return;

    const touch = e.touches[0];
    setStartY(touch.clientY);
    setCurrentY(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableSwipeToClose || !isDragging || startY === null || !drawerRef.current) return;

    const touch = e.touches[0];
    setCurrentY(touch.clientY);

    const deltaY = touch.clientY - startY;

    // Only allow downward swipes (positive deltaY)
    if (deltaY > 0) {
      // Add visual feedback by slightly moving the drawer
      const translateY = deltaY * 0.5; // Allow full drag range with damping
      drawerRef.current.style.transform = `translateY(${translateY}px)`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      !enableSwipeToClose ||
      !isDragging ||
      startY === null ||
      currentY === null ||
      !drawerRef.current
    ) {
      setIsDragging(false);
      return;
    }

    const deltaY = currentY - startY;
    const swipeThreshold = 100; // Minimum distance for swipe to close

    // Reset transform
    drawerRef.current.style.transform = '';

    if (deltaY > swipeThreshold) {
      // Swipe down detected - close drawer
      handleClose();
    }

    // Reset swipe state
    setStartY(null);
    setCurrentY(null);
    setIsDragging(false);
  };

  if (!shouldRender) return null;

  // Render to document.body using portal to escape stacking context issues
  return createPortal(
    <OverlayBackdrop
      visible={shouldRender}
      onBackdropClick={handleClose}
      zIndex="z-[10000]"
      blur={false}
      opacity={0.5}
      closeOnBackdropClick={true}
      className={`${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 !items-end !justify-center`}
    >
      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`mobile-drawer ${isOpen && !isClosing ? 'mobile-drawer--open' : ''} ${isClosing ? 'mobile-drawer--closing' : ''} ${isDragging ? 'mobile-drawer--dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || t`Drawer`}
      >
        {/* Header area with handle and close button - touch handlers here for drag-to-close */}
        <div
          className="mobile-drawer__header-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
        {/* Swipe handle indicator */}
        {enableSwipeToClose && (
          <div className="mobile-drawer__handle" aria-hidden="true" />
        )}

        {/* Header row with title and close button */}
        <div className="mobile-drawer__header-row">
          <div className="mobile-drawer__title-area">
            {title && (
              <Text
                size="sm"
                className="mobile-drawer__title"
              >
                {title}
              </Text>
            )}
          </div>

          {showCloseButton && (
            <Button
              type="unstyled"
              onClick={handleClose}
              iconName="times"
              iconOnly
              className="mobile-drawer__close-btn"
            />
          )}
        </div>

        {/* Optional custom header content (e.g., emoji reactions) */}
        {headerContent && (
          <div className="mobile-drawer__header-content">
            {headerContent}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className={`mobile-drawer__content ${!title ? 'mobile-drawer__content--no-header' : ''}`}
      >
        {children}
      </div>
    </div>
    </OverlayBackdrop>,
    document.body
  );
};

export default MobileDrawer;
