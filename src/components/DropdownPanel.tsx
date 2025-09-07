import React, { useEffect, useRef } from 'react';
import { Container, FlexRow, Text, Icon, Button } from './primitives';
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
  children: React.ReactNode;
  showCloseButton?: boolean;
  resultsCount?: number;
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
  children,
  showCloseButton = true,
  resultsCount,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle outside clicks and escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
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
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionClass = positionStyle === 'centered' 
    ? 'dropdown-panel--centered' 
    : positionStyle === 'right-aligned'
    ? 'dropdown-panel--right-aligned'
    : 'dropdown-panel--search-results';
  const positionStyleObject = positionStyle === 'search-results' 
    ? { 
        width: `min(${maxWidth}px, calc(100vw - 40px))`,
        maxWidth: `min(${maxWidth}px, calc(100vw - 40px))`,
        maxHeight: `${maxHeight}px`
      }
    : positionStyle === 'right-aligned'
    ? {
        width: `min(${maxWidth}px, calc(100vw - 40px))`,
        maxWidth: `min(${maxWidth}px, calc(100vw - 40px))`,
        maxHeight: `${maxHeight}px`
      }
    : {
        maxWidth: `min(${maxWidth}px, calc(100vw - 40px))`,
        maxHeight: `${maxHeight}px`
      };

  return (
    <Container
      ref={panelRef}
      className={`dropdown-panel ${positionClass} ${className}`}
      style={{ 
        position,
        ...positionStyleObject
      }}
    >
      {(title || resultsCount !== undefined) && (
        <Container className="dropdown-panel__header">
          <FlexRow className="items-center justify-between">
            <Text className="dropdown-panel__title">
              {title || (
                resultsCount === 1
                  ? `${resultsCount} result`
                  : `${resultsCount} results`
              )}
            </Text>
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
      
      <Container className="dropdown-panel__content">
        {children}
      </Container>
    </Container>
  );
};