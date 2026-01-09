import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { Icon } from '../primitives';
import { Portal } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { t } from '@lingui/core/macro';
import type { MentionOption } from '../../hooks/business/mentions';
import { getAddressSuffix } from '../../utils';
import './MentionDropdown.scss';

interface CaretPosition {
  x: number;
  y: number;
  height: number;
}

interface MentionDropdownProps {
  isOpen: boolean;
  filteredOptions: MentionOption[];
  selectedIndex: number;
  onSelectOption: (option: MentionOption) => void;
  /** Render via Portal with fixed positioning (for use in MessageEditTextarea) */
  usePortal?: boolean;
  /** Element to position relative to when usePortal is true */
  portalTargetRef?: React.RefObject<HTMLElement>;
  /** Caret position for positioning dropdown near where user is typing */
  caretPosition?: CaretPosition | null;
  /** Show "Notify all members" subtitle for @everyone (default: true) */
  showEveryoneDescription?: boolean;
  className?: string;
}

/** Mention autocomplete dropdown for @user, @role, #channel, and @everyone */
export const MentionDropdown: React.FC<MentionDropdownProps> = ({
  isOpen,
  filteredOptions,
  selectedIndex,
  onSelectOption,
  usePortal = false,
  portalTargetRef,
  caretPosition,
  showEveryoneDescription = true,
  className,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalPosition, setPortalPosition] = useState<{ top: number; left: number } | null>(null);

  // Calculate position when using portal mode
  const updatePosition = useCallback(() => {
    if (!usePortal || !portalTargetRef?.current || !dropdownRef.current) return;

    const targetRect = portalTargetRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current.offsetHeight;
    const dropdownWidth = dropdownRef.current.offsetWidth;

    // Only set position if we have actual height (dropdown is rendered)
    if (dropdownHeight > 0) {
      let top: number;
      let left: number;

      if (caretPosition) {
        // Position relative to caret (Slack-style)
        top = caretPosition.y - dropdownHeight - 8; // 8px gap above caret
        left = caretPosition.x;
      } else {
        // Fallback: position relative to target element
        top = targetRect.top - dropdownHeight - 8;
        left = targetRect.left;
      }

      // Clamp left position to prevent overflow
      const viewportWidth = window.innerWidth;
      const minLeft = 8; // 8px margin from left edge
      const maxLeft = viewportWidth - dropdownWidth - 8; // 8px margin from right edge

      left = Math.max(minLeft, Math.min(left, maxLeft));

      // Clamp top position - if not enough space above, show below caret
      if (top < 8) {
        if (caretPosition) {
          top = caretPosition.y + caretPosition.height + 8; // Below caret
        } else {
          top = targetRect.bottom + 8; // Below target
        }
      }

      setPortalPosition({ top, left });
    }
  }, [usePortal, portalTargetRef, caretPosition]);

  // Reset position when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setPortalPosition(null);
    }
  }, [isOpen]);

  // Scroll/resize listeners
  useEffect(() => {
    if (!usePortal || !isOpen) return;

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [usePortal, isOpen, updatePosition]);

  // Calculate position after dropdown renders
  useLayoutEffect(() => {
    if (usePortal && isOpen && dropdownRef.current) {
      // Use requestAnimationFrame to ensure DOM has painted
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  }, [usePortal, isOpen, filteredOptions, caretPosition, updatePosition]);

  if (!isOpen || filteredOptions.length === 0) {
    return null;
  }

  // Generate unique key for each option
  const getOptionKey = (option: MentionOption): string => {
    switch (option.type) {
      case 'user':
        return option.data.address;
      case 'role':
        return option.data.roleId;
      case 'channel':
        return option.data.channelId;
      case 'group-header':
        return `group-${option.data.groupName}`;
      case 'everyone':
        return 'everyone';
    }
  };

  // Generate CSS class names for option
  const getOptionClassName = (
    option: MentionOption,
    index: number
  ): string => {
    if (option.type === 'group-header') {
      return 'mention-dropdown__group-header';
    }

    const classes = ['mention-dropdown__item'];

    if (index === selectedIndex) {
      classes.push('mention-dropdown__item--selected');
    }
    if (index === 0) {
      classes.push('mention-dropdown__item--first');
    }
    if (index === filteredOptions.length - 1) {
      classes.push('mention-dropdown__item--last');
    }

    return classes.join(' ');
  };

  // Render option content based on type
  const renderOptionContent = (option: MentionOption) => {
    switch (option.type) {
      case 'group-header':
        return (
          <>
            {option.data.icon && (
              <div
                className="mention-dropdown__group-icon"
                style={{ color: option.data.iconColor }}
              >
                <Icon name={option.data.icon as any} size="sm" />
              </div>
            )}
            <span className="mention-dropdown__group-name">
              {option.data.groupName}
            </span>
          </>
        );

      case 'user':
        return (
          <>
            <UserAvatar
              userIcon={option.data.userIcon}
              displayName={option.data.displayName || t`Unknown User`}
              address={option.data.address}
              size={32}
              className="mention-dropdown__avatar"
            />
            <div className="mention-dropdown__info">
              <span className="mention-dropdown__name">
                {option.data.displayName || t`Unknown User`}
              </span>
              <span className="mention-dropdown__subtitle">
                {getAddressSuffix(option.data.address)}
              </span>
            </div>
          </>
        );

      case 'role':
        return (
          <>
            <div
              className="mention-dropdown__badge mention-dropdown__badge--role"
              style={{ backgroundColor: option.data.color }}
            >
              <Icon name="users" size="sm" />
            </div>
            <div className="mention-dropdown__info">
              <span className="mention-dropdown__name">
                {option.data.displayName}
              </span>
              <span className="mention-dropdown__role-tag">
                @{option.data.roleTag}
              </span>
            </div>
          </>
        );

      case 'channel':
        return (
          <>
            <div
              className="mention-dropdown__badge mention-dropdown__badge--channel"
              style={
                option.data.icon && option.data.iconColor
                  ? { color: option.data.iconColor }
                  : undefined
              }
            >
              <Icon name={option.data.icon || 'hashtag'} size="sm" />
            </div>
            <div className="mention-dropdown__info">
              <span className="mention-dropdown__name">
                {option.data.channelName}
              </span>
            </div>
          </>
        );

      case 'everyone':
        return (
          <>
            <div className="mention-dropdown__badge mention-dropdown__badge--everyone">
              <Icon name="globe" size="sm" />
            </div>
            <div className="mention-dropdown__info">
              <span className="mention-dropdown__name">@everyone</span>
              {showEveryoneDescription && (
                <span className="mention-dropdown__subtitle">
                  {t`Notify all members`}
                </span>
              )}
            </div>
          </>
        );
    }
  };

  const dropdownClassName = [
    'mention-dropdown',
    usePortal ? 'mention-dropdown--portal' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={dropdownClassName}
      style={
        usePortal && portalPosition
          ? {
              position: 'fixed',
              top: portalPosition.top,
              left: portalPosition.left,
              zIndex: 1000,
            }
          : usePortal
            ? {
                // Render off-screen while measuring height
                position: 'fixed',
                top: -100000,
                left: -100000,
                zIndex: 1000,
              }
            : undefined
      }
    >
      <div className="mention-dropdown__container">
        {filteredOptions.map((option, index) => (
          <div
            key={getOptionKey(option)}
            className={getOptionClassName(option, index)}
            onMouseDown={(e) => {
              // Prevent focus loss from contentEditable when clicking dropdown
              e.preventDefault();
            }}
            onClick={() => {
              if (option.type !== 'group-header') {
                onSelectOption(option);
              }
            }}
          >
            {renderOptionContent(option)}
          </div>
        ))}
      </div>
    </div>
  );

  // Render with or without portal
  if (usePortal) {
    return <Portal>{dropdownContent}</Portal>;
  }

  return dropdownContent;
};

export default MentionDropdown;
