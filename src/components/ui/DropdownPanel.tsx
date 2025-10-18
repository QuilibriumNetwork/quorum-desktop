import React, { useEffect, useRef } from 'react';
import { Container, FlexRow, Icon, Button } from '../primitives';
import { isTouchDevice } from '../../utils/platform';
import MobileDrawer from './MobileDrawer';
import './DropdownPanel.scss';

export interface DropdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: 'absolute' | 'fixed';
  positionStyle?: 'search-results' | 'centered' | 'right-aligned';
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  showCloseButton?: boolean;
  resultsCount?: number;
  useMobileBottomSheet?: boolean; // Default: true (use bottom sheet on touch devices)
}

export const DropdownPanel: React.FC<DropdownPanelProps> = ({
  isOpen,
  onClose,
  title,
  position = 'absolute',
  positionStyle = 'search-results',
  maxWidth = 500,
  maxHeight = 400,
  className = '',
  style,
  children,
  showCloseButton = true,
  resultsCount,
  useMobileBottomSheet = true, // Default to mobile bottom sheet
}) => {
  const isTouch = isTouchDevice();

  // Mobile bottom sheet mode (touch devices with useMobileBottomSheet=true)
  if (isTouch && useMobileBottomSheet) {
    return (
      <MobileDrawer
        isOpen={isOpen}
        onClose={onClose}
        title={
          title ||
          (resultsCount !== undefined
            ? resultsCount === 1
              ? `${resultsCount} result`
              : `${resultsCount} results`
            : undefined)
        }
        showCloseButton={false} // No close button on mobile - use swipe or backdrop tap
        enableSwipeToClose={true}
      >
        {children}
      </MobileDrawer>
    );
  }

  // Desktop dropdown mode (existing implementation)
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle outside clicks and escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && event.target) {
        const isInside = panelRef.current.contains(event.target as Node);

        // Check if it's a tooltip-related element (they render outside the panel)
        const targetElement = event.target as Element;

        // Check current element and parents for button-related classes/ids
        let currentElement = targetElement;
        let isTooltipElement = false;

        // Walk up the DOM tree to find button-related elements or Select dropdown
        for (let i = 0; i < 5 && currentElement && !isTooltipElement; i++) {
          const elementId = currentElement.id || '';
          const elementClassName =
            typeof currentElement.className === 'string'
              ? currentElement.className
              : currentElement.className?.baseVal || '';

          isTooltipElement =
            elementId.includes('jump-') ||
            elementId.includes('unpin-') ||
            elementClassName.includes('jump-button') ||
            elementClassName.includes('unpin-button') ||
            elementClassName.includes('btn-unstyled') ||
            elementClassName.includes('quorum-select__dropdown') || // Exclude Select dropdowns (rendered as portals)
            elementClassName.includes('quorum-select__') || // Exclude all Select-related elements
            currentElement.tagName === 'BUTTON' ||
            currentElement.tagName === 'A';

          currentElement = currentElement.parentElement;
        }

        if (!isInside && !isTooltipElement) {
          onClose();
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionClass =
    positionStyle === 'centered'
      ? 'dropdown-panel--centered'
      : positionStyle === 'right-aligned'
        ? 'dropdown-panel--right-aligned'
        : 'dropdown-panel--search-results';

  // Check if screen is below 640px (sm breakpoint) for responsive width
  const isSmallScreen =
    typeof window !== 'undefined' && window.innerWidth < 640;
  const responsiveMaxWidth = isSmallScreen ? 280 : maxWidth;

  const positionStyleObject =
    positionStyle === 'search-results'
      ? {
          width: `min(${responsiveMaxWidth}px, calc(100vw - 40px))`,
          maxWidth: `min(${responsiveMaxWidth}px, calc(100vw - 40px))`,
          maxHeight: `${maxHeight}px`,
        }
      : positionStyle === 'right-aligned'
        ? {
            width: `min(${responsiveMaxWidth}px, calc(100vw - 40px))`,
            maxWidth: `min(${responsiveMaxWidth}px, calc(100vw - 40px))`,
            maxHeight: `${maxHeight}px`,
          }
        : {
            maxWidth: `min(${responsiveMaxWidth}px, calc(100vw - 40px))`,
            maxHeight: `${maxHeight}px`,
          };

  // Use fixed positioning for right-aligned panels to escape relative containers
  const finalPosition = positionStyle === 'right-aligned' ? 'fixed' : position;

  return (
    <Container
      ref={panelRef}
      className={`dropdown-panel ${positionClass} ${className}`}
      style={{
        position: finalPosition,
        ...positionStyleObject,
        ...style, // Apply custom style prop last to allow overrides
      }}
    >
      {(title || resultsCount !== undefined) && (
        <Container className="dropdown-panel__header">
          <FlexRow className="items-center justify-between">
            <span className="dropdown-panel__title">
              {title ||
                (resultsCount === 1
                  ? `${resultsCount} result`
                  : `${resultsCount} results`)}
            </span>
            {showCloseButton && (
              <Button
                type="unstyled"
                onClick={onClose}
                className="dropdown-panel__close"
              >
                <Icon name="times" size="sm" />
              </Button>
            )}
          </FlexRow>
        </Container>
      )}

      <Container className="dropdown-panel__content">{children}</Container>
    </Container>
  );
};

export default DropdownPanel;
