import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCompressAlt,
  faPlus,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import Button from '../Button';
import './ExpandableNavMenu.scss';
import { getConfig } from '../../config/config';
import { t } from '@lingui/core/macro';
import { useModalContext } from '../AppWithSearch';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../utils';
import ReactTooltip from '../ReactTooltip';
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
      <>
        <div className="nav-buttons-centered-container">
          <div
            className="expanded-nav-button-primary"
            onClick={() => props.showCreateSpaceModal()}
            data-tooltip-id="create-space-tooltip-desktop"
          >
            <FontAwesomeIcon icon={faPlus} />
          </div>
        </div>
        <ReactTooltip
          id="create-space-tooltip-desktop"
          content={t`Create a new Space`}
          place="right"
          anchorSelect="[data-tooltip-id='create-space-tooltip-desktop']"
          highlighted={true}
        />
      </>
    );
  }

  // Mobile/Tablet: Show both buttons directly (no tooltips to avoid tap conflicts)
  return (
    <div className="nav-buttons-centered-container">
      <div
        className="expanded-nav-button-primary"
        onClick={() => props.showCreateSpaceModal()}
      >
        <FontAwesomeIcon icon={faPlus} />
      </div>
      <div
        className="expanded-nav-button-avatar"
        onClick={() => openUserSettings()}
        style={{
          backgroundImage:
            user?.currentPasskeyInfo?.pfpUrl &&
            !user.currentPasskeyInfo.pfpUrl.includes(
              DefaultImages.UNKNOWN_USER
            )
              ? `url(${user.currentPasskeyInfo.pfpUrl})`
              : 'var(--unknown-icon)',
        }}
      />
    </div>
  );
};

export default ExpandableNavMenu;
