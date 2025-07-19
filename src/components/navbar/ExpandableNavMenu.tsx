import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faCompressAlt,
  faPlus,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import Button from '../Button';
import './ExpandableNavMenu.scss';
import { getConfig } from '../../config/config';
import { t } from '@lingui/core/macro';
import { useModalContext } from '../AppWithSearch';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../utils';
import ReactTooltip from '../ReactTooltip';

type ExpandableNavMenuProps = {
  showCreateSpaceModal: () => void;
  showJoinSpaceModal: () => void;
};

const ExpandableNavMenu: React.FunctionComponent<ExpandableNavMenuProps> = (
  props
) => {
  const [isExpanded, setExpanded] = useState(false);
  const { openUserSettings } = useModalContext();
  const user = usePasskeysContext();

  return (
    <>
      {isExpanded ? (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-overlay backdrop-blur"
            onClick={() => setExpanded(false)}
          />
          <div className="expanded-nav-menu relative z-[9999]">
            <div className="expanded-nav-buttons-container">
              <div
                className="expanded-nav-button-primary"
                onClick={(e) => {
                  setExpanded(false);
                  props.showCreateSpaceModal();
                }}
                data-tooltip-id="create-space-tooltip"
              >
                <FontAwesomeIcon icon={faPlus} />
              </div>
              <div
                className="expanded-nav-button-avatar"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(false);
                  openUserSettings();
                }}
                style={{
                  backgroundImage:
                    user?.currentPasskeyInfo?.pfpUrl &&
                    !user.currentPasskeyInfo.pfpUrl.includes(
                      DefaultImages.UNKNOWN_USER
                    )
                      ? `url(${user.currentPasskeyInfo.pfpUrl})`
                      : 'var(--unknown-icon)',
                }}
                data-tooltip-id="user-avatar-tooltip"
              />
            </div>
          </div>
        </>
      ) : (
        <div
          className="expand-button cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <FontAwesomeIcon icon={faGear} />
        </div>
      )}
      {isExpanded && (
        <>
          <ReactTooltip
            key="create-space-tooltip-expanded"
            id="create-space-tooltip"
            content={t`Create a new Space`}
            place="top"
            anchorSelect="[data-tooltip-id='create-space-tooltip']"
            highlighted={true}
            className="z-[10000]"
            showOnTouch={true}
            alwaysVisible={true}
          />
          <ReactTooltip
            key="user-avatar-tooltip-expanded"
            id="user-avatar-tooltip"
            content={t`Account Settings`}
            place="top"
            anchorSelect="[data-tooltip-id='user-avatar-tooltip']"
            highlighted={true}
            className="z-[10000]"
            showOnTouch={true}
            alwaysVisible={true}
          />
        </>
      )}
    </>
  );
};

export default ExpandableNavMenu;
