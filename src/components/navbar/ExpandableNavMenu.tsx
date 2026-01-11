import * as React from 'react';
import { Icon, Tooltip, FlexColumn, Container } from '../primitives';
import './ExpandableNavMenu.scss';
import { t } from '@lingui/core/macro';
import { useModalContext } from '../context/ModalProvider';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { ExpandableUserAvatar } from '../user/ExpandableUserAvatar';

type ExpandableNavMenuProps = {
  showCreateSpaceModal: () => void;
  showJoinSpaceModal: () => void;
};

const ExpandableNavMenu: React.FunctionComponent<ExpandableNavMenuProps> = (
  props
) => {
  const { openUserSettings } = useModalContext();
  const user = usePasskeysContext();
  const { isDesktop } = useResponsiveLayout();

  // All screen sizes: Show + button and ExpandableUserAvatar
  // On desktop non-touch devices, avatar expands on hover to show user status
  // On touch devices / smaller screens, avatar click opens settings
  return (
    <FlexColumn className="nav-buttons-centered-container">
      {isDesktop ? (
        <Tooltip
          id="create-space-desktop"
          content={t`Add a Space`}
          place="right"
          className="tooltip-text-large"
        >
          <Container
            className="expanded-nav-button-primary"
            onClick={() => props.showCreateSpaceModal()}
          >
            <Icon name="plus" />
          </Container>
        </Tooltip>
      ) : (
        <Container
          className="expanded-nav-button-primary"
          onClick={() => props.showCreateSpaceModal()}
        >
          <Icon name="plus" />
        </Container>
      )}
      <ExpandableUserAvatar
        userIcon={user?.currentPasskeyInfo?.pfpUrl}
        displayName={user?.currentPasskeyInfo?.displayName || 'User'}
        address={user?.currentPasskeyInfo?.address || ''}
        size={40}
        className="expanded-nav-button-avatar"
        onOpenSettings={openUserSettings}
      />
    </FlexColumn>
  );
};

export default ExpandableNavMenu;
