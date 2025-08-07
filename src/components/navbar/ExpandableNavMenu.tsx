import * as React from 'react';
import { Icon, Tooltip, FlexColumn, Container } from '../primitives';
import './ExpandableNavMenu.scss';
import { getConfig } from '../../config/config';
import { t } from '@lingui/core/macro';
import { useModalContext } from '../context/ModalProvider';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../utils';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

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

  // Desktop: Show only + button for creating spaces
  if (isDesktop) {
    return (
      <FlexColumn className="nav-buttons-centered-container">
        <Tooltip
          id="create-space-desktop"
          content={t`Create a new Space`}
          place="right"
          highlighted={true}
        >
          <Container
            className="expanded-nav-button-primary"
            onClick={() => props.showCreateSpaceModal()}
          >
            <Icon name="plus" />
          </Container>
        </Tooltip>
      </FlexColumn>
    );
  }

  // Mobile/Tablet: Show both buttons directly (no tooltips to avoid tap conflicts)
  // Inverted order: Plus button at top, Avatar at bottom
  return (
    <FlexColumn className="nav-buttons-centered-container">
      <Container
        className="expanded-nav-button-primary"
        onClick={() => props.showCreateSpaceModal()}
      >
        <Icon name="plus" />
      </Container>
      <Container
        className="expanded-nav-button-avatar"
        onClick={() => openUserSettings()}
        style={{
          backgroundImage:
            user?.currentPasskeyInfo?.pfpUrl &&
            !user.currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER)
              ? `url(${user.currentPasskeyInfo.pfpUrl})`
              : 'var(--unknown-icon)',
        }}
      />
    </FlexColumn>
  );
};

export default ExpandableNavMenu;
