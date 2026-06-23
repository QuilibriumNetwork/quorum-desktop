import React, { useMemo } from 'react';
import { Icon } from '../primitives';
import { FloatingPopover, rectAnchor, type VirtualElement } from '../ui';
import { getRoleColorHex } from '@quilibrium/quorum-shared';
import { UserAvatar } from '../user/UserAvatar';
import { t } from '@lingui/core/macro';
import type { MentionOption } from '../../hooks/business/mentions';
import { getAddressSuffix } from '../../utils';
import { ResolvedName } from '../user/ResolvedName';
import { resolveSpaceMemberName } from '../../utils/resolveMemberName';
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
  portalTargetRef?: React.RefObject<HTMLElement | null>;
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
  // Portal mode: anchor to the caret as a floating-ui virtual element. The
  // dropdown opens above the caret (top-start) and flip()/shift() move it
  // below or clamp it horizontally near the edges — the placement math that
  // used to live in updatePosition()/scroll+resize listeners. Falls back to
  // the target element's rect when the caret position isn't known yet.
  const portalAnchor = useMemo<VirtualElement | null>(() => {
    if (!usePortal) return null;
    if (caretPosition) {
      const { x, y, height } = caretPosition;
      return rectAnchor({ x, y, height });
    }
    const target = portalTargetRef?.current;
    if (target) {
      return { getBoundingClientRect: () => target.getBoundingClientRect() };
    }
    return null;
  }, [usePortal, caretPosition, portalTargetRef]);

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

    // Selected state for keyboard navigation
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
              <ResolvedName
                resolved={resolveSpaceMemberName({
                  address: option.data.address,
                  displayName: option.data.displayName,
                  primaryUsername: option.data.primaryUsername,
                  globalDisplayName: option.data.globalDisplayName,
                })}
                className="mention-dropdown__name"
              />
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
              style={{ backgroundColor: getRoleColorHex(option.data.color) }}
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

  const optionsList = (
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
  );

  // Portal mode: caret-anchored via FloatingPopover (top-start + flip/shift).
  if (usePortal) {
    return (
      <FloatingPopover
        open={isOpen}
        onClose={() => {}}
        anchor={portalAnchor}
        placement="top-start"
        gap={8}
        viewportPadding={8}
        zIndex={1000}
        role="listbox"
        // The composer owns open/close (typing, selection, escape); the
        // dropdown follows the caret while open and shouldn't self-dismiss on
        // outside interactions or close itself when the caret stays visible.
        // dismissable=false so useDismiss doesn't swallow the composer's Escape
        // (which selects the highlighted mention / closes the dropdown).
        manageFocus={false}
        dismissable={false}
        closeWhenAnchorHidden={false}
        className={dropdownClassName}
      >
        {optionsList}
      </FloatingPopover>
    );
  }

  // Inline mode: CSS-positioned by the parent container (not trigger-anchored).
  return (
    <div className={dropdownClassName}>{optionsList}</div>
  );
};

export default MentionDropdown;
