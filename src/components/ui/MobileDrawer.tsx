// This is for mobile users using the web app, for the native app we have /primitives/Modal/Modal.native.tsx

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import './MobileDrawer.scss';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  enableSwipeToClose?: boolean;
  ariaLabel?: string;
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
  children,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

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

    // Only start swipe detection if touching near the top of the drawer
    const drawerRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const touch = e.touches[0];
    const relativeY = touch.clientY - drawerRect.top;

    // Only allow swipe from the top 60px of the drawer (handle + header area)
    if (relativeY > 60) return;

    setStartY(touch.clientY);
    setCurrentY(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableSwipeToClose || !isDragging || startY === null) return;

    const touch = e.touches[0];
    setCurrentY(touch.clientY);

    const deltaY = touch.clientY - startY;

    // Only allow downward swipes (positive deltaY)
    if (deltaY > 0) {
      // Add visual feedback by slightly moving the drawer
      const drawer = e.currentTarget as HTMLElement;
      const translateY = Math.min(deltaY * 0.5, 100); // Limit movement
      drawer.style.transform = `translateY(${translateY}px)`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      !enableSwipeToClose ||
      !isDragging ||
      startY === null ||
      currentY === null
    ) {
      setIsDragging(false);
      return;
    }

    const deltaY = currentY - startY;
    const swipeThreshold = 100; // Minimum distance for swipe to close

    // Reset transform
    const drawer = e.currentTarget as HTMLElement;
    drawer.style.transform = '';

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

  return (
    <div
      className={`mobile-drawer ${isOpen && !isClosing ? 'mobile-drawer--open' : ''} ${isClosing ? 'mobile-drawer--closing' : ''} ${isDragging ? 'mobile-drawer--dragging' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || t`Drawer`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe handle indicator */}
      {enableSwipeToClose && (
        <div className="mobile-drawer__handle" aria-hidden="true" />
      )}

      {/* Header */}
      {(title || showCloseButton) && (
        <div className="mobile-drawer__header">
          {title && <h2 className="mobile-drawer__title">{title}</h2>}
          {showCloseButton && (
            <button
              className="mobile-drawer__close"
              onClick={handleClose}
              aria-label={t`Close`}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div
        className={`mobile-drawer__content ${!(title || showCloseButton) ? 'mobile-drawer__content--no-header' : ''}`}
      >
        {children}
      </div>
    </div>
  );
};

export default MobileDrawer;
