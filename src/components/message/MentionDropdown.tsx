import React, { useMemo } from 'react';
import { Icon, type IconName } from '../primitives';
import { FloatingPopover, rectAnchor, type VirtualElement } from '../ui';
import { getRoleColorHex, formatAddress } from '@quilibrium/quorum-shared';
import { UserAvatar } from '../user/UserAvatar';
import { t } from '@lingui/core/macro';
import type { MentionOption } from '../../hooks/business/mentions';
import { MemberName, useNameResolver } from '../../identity';
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

  // Bulk imperative resolver: rows are built inside a `.map()` over
  // filteredOptions below, so a hook cannot be called per row (rules of
  // hooks) — called once here, before the early return, and reused as a
  // plain function per row. Only used for the AVATAR's bare-name input (see
  // rule 4: avatar and name must agree); the label itself renders via
  // <MemberName enrich>, the SAME identityFromMaps + resolveIdentity read.
  // `resolve()` never requests on its own — the label's own `enrich` mount
  // effect is what issues the fetch this reads back.
  const { resolve } = useNameResolver();

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

      case 'user': {
        // `enrich`: this list is BOUNDED — maxDisplayResults caps it at 50,
        // and after a character or two it's a handful — so it opted into
        // the same rule as bookmarks/notifications/message headers (design
        // decision 3, revised 2026-08-11). Without this, a candidate you
        // pick here could render plain while the message you just posted
        // renders their verified ".q" for the same person. The member
        // sidebar keeps its no-enrich policy (genuinely unbounded
        // cardinality) — this surface's fetch count is bounded by DISTINCT
        // candidates rendered, never per keystroke or render, see
        // src/dev/tests/identity/mentionDropdownFetch.test.tsx.
        //
        // `resolve()` here and <MemberName enrich> below read the SAME
        // identityFromMaps + resolveIdentity, so the avatar's initials and
        // the label can never disagree (rule 4) even though they're two
        // separate elements — <MemberName>'s own mount effect is what
        // issues the request; `resolve()` only ever reads.
        const resolvedBareName = resolve(option.data.address).name;
        return (
          <>
            <UserAvatar
              userIcon={option.data.userIcon}
              displayName={resolvedBareName}
              address={option.data.address}
              size={32}
              className="mention-dropdown__avatar"
            />
            <div className="mention-dropdown__info">
              <MemberName
                address={option.data.address}
                enrich
                className="mention-dropdown__name"
              />
              <span className="mention-dropdown__subtitle">
                {formatAddress(option.data.address)}
              </span>
            </div>
          </>
        );
      }

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
              <Icon name={(option.data.icon as IconName) || 'hashtag'} size="sm" />
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
