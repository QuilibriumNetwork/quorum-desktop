import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faCompressAlt,
  faPlus,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import Button from '../Button';
import './ExpandableNavMenu.scss';
import { getConfig } from '../../config/config';
import { t } from '@lingui/core/macro';

type ExpandableNavMenuProps = {
  showCreateSpaceModal: () => void;
  showJoinSpaceModal: () => void;
};

const ExpandableNavMenu: React.FunctionComponent<ExpandableNavMenuProps> = (
  props
) => {
  const [isExpanded, setExpanded] = useState(false);

  return isExpanded ? (
    <div className="expanded-nav-menu">
      <div className="invisible-dismissal" onClick={() => setExpanded(false)} />
      {/* <Button className="expanded-nav-search-spaces" icon type="primary" onClick={(e) => history.push("/spaces/search")} tooltip={localizations["TOOLTIP_SEARCH_SPACES"]([])}><FontAwesomeIcon icon={faSearch}/></Button> */}
      <Button
        className="expanded-nav-add-spaces w-10 h-10 ml-3 leading-6 mb-4 inline-block"
        icon
        type="primary"
        onClick={(e) => {
          setExpanded(false);
          props.showCreateSpaceModal();
        }}
        tooltip={t`Add Space`}
      >
        <FontAwesomeIcon icon={faPlus} />
      </Button>
      {/* <Button className="expanded-nav-join-spaces w-10 h-10 ml-3 leading-6 mb-4 inline-block" icon type="primary" onClick={(e) => { setExpanded(false); props.showJoinSpaceModal(); }} tooltip={localizations.localizations["TOOLTIP_JOIN_SPACE"]([])}><FontAwesomeIcon icon={faCompressAlt}/></Button> */}
    </div>
  ) : (
    <div className="expand-button cursor-pointer" onClick={() => setExpanded(true)}>
      <FontAwesomeIcon icon={faBars} />
    </div>
  );
};

export default ExpandableNavMenu;
