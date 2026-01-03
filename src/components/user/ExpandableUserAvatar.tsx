import * as React from 'react';
import { useState } from 'react';
import { t } from '@lingui/core/macro';
import { Icon } from '../primitives';
import { ClickToCopyContent } from '../ui';
import { getAddressSuffix } from '../../utils';
import { isTouchDevice } from '../../utils/platform';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { UserAvatar } from './UserAvatar';
import './ExpandableUserAvatar.scss';

type ExpandableUserAvatarProps = {
  userIcon?: string;
  displayName: string;
  address: string;
  size?: number;
  className?: string;
  onOpenSettings: () => void;
};

/**
 * ExpandableUserAvatar - A hover-expandable user avatar component
 *
 * On desktop (>= 1024px) non-touch devices:
 * - Shows avatar only by default
 * - Expands to full pill on hover showing display name, address (copyable), and settings icon
 *
 * On touch devices or smaller screens:
 * - Shows avatar only
 * - Click opens user settings modal
 */
export const ExpandableUserAvatar: React.FunctionComponent<
  ExpandableUserAvatarProps
> = ({ userIcon, displayName, address, size = 40, className = '', onOpenSettings }) => {
  const { isDesktop } = useResponsiveLayout();
  const [isHovered, setIsHovered] = useState(false);

  // Only enable hover expansion on desktop non-touch devices
  const shouldExpandOnHover = isDesktop && !isTouchDevice();
  const isExpanded = shouldExpandOnHover && isHovered;

  const handleMouseEnter = () => {
    if (shouldExpandOnHover) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleAvatarClick = () => {
    onOpenSettings();
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenSettings();
  };

  return (
    <>
      {/* Invisible hover trigger in nav menu */}
      <div
        className={`expandable-user-avatar-trigger ${className}`}
        onMouseEnter={handleMouseEnter}
      />
      {/* Fixed position pill that animates width */}
      <div
        className={`expandable-user-avatar ${isExpanded ? 'expanded' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <UserAvatar
          userIcon={userIcon}
          displayName={displayName}
          address={address}
          size={48}
          className="expandable-user-avatar-icon"
          onClick={handleAvatarClick}
        />
        <div className="expandable-user-avatar-content">
          <div className="expandable-user-avatar-text">
            <div className="expandable-user-avatar-username">
              <span>{displayName}</span>
            </div>
            <div className="expandable-user-avatar-info">
              <ClickToCopyContent
                text={address}
                tooltipText={t`Copy address`}
                tooltipLocation="top"
                iconClassName="text-surface-9 hover:text-surface-10 dark:text-surface-8 dark:hover:text-surface-9"
                textVariant="subtle"
                textSize="xs"
                iconSize="xs"
                iconPosition="right"
                copyOnContentClick={true}
                className="flex items-center w-fit"
              >
                {getAddressSuffix(address)}
              </ClickToCopyContent>
            </div>
          </div>
          <div className="expandable-user-avatar-settings">
            <Icon
              name="settings"
              variant="filled"
              onClick={handleSettingsClick}
              className="text-subtle hover:text-main cursor-pointer"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default ExpandableUserAvatar;
