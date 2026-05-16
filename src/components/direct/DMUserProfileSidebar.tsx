import React from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { UserAvatar } from '../user/UserAvatar';
import { ClickToCopyContent } from '../ui';
import { getAddressSuffix } from '../../utils';
import './DMUserProfileSidebar.scss';

interface DMUserProfileSidebarProps {
  user: {
    address: string;
    displayName?: string;
    userIcon?: string;
    bio?: string;
  };
}

export const DMUserProfileSidebar: React.FC<DMUserProfileSidebarProps> = ({ user }) => {
  return (
    <div className="dm-profile-sidebar">
      {/* Identity block */}
      <div className="dm-profile-identity">
        <UserAvatar
          userIcon={user.userIcon}
          displayName={user.displayName ?? user.address}
          address={user.address}
          size={96}
        />
        <span className="dm-profile-name truncate text-main font-semibold text-base">
          {user.displayName ?? user.address}
        </span>
        <div className="dm-profile-address">
          <ClickToCopyContent
            text={user.address}
            tooltipText={t`Copy address`}
            tooltipLocation="right"
            className="text-subtle"
            iconPosition="right"
            iconClassName="text-subtle hover:text-surface-7"
            iconSize="xs"
            textSize="xs"
          >
            {getAddressSuffix(user.address)}
          </ClickToCopyContent>
        </div>
      </div>

      {/* Bio section */}
      <div className="dm-profile-section">
        <div className="dm-profile-section-label text-subtle">
          <Trans>Bio</Trans>
        </div>
        {user.bio ? (
          <p className="text-sm text-main">{user.bio}</p>
        ) : (
          <p className="text-sm text-subtle">{t`No bio yet.`}</p>
        )}
      </div>

      {/* Notes placeholder — replaced when user-notes feature lands */}
      <div className="dm-profile-section">
        <div className="dm-profile-section-label text-subtle">
          <Trans>Notes</Trans>
        </div>
        <p className="text-sm text-subtle">{t`Coming soon`}</p>
      </div>
    </div>
  );
};
