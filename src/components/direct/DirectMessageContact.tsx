import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import './DirectMessageContact.scss';
import { truncateAddress } from '../../utils';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { UserAvatar } from '../user/UserAvatar';

const DirectMessageContact: React.FunctionComponent<{
  unread: boolean;
  address: string;
  displayName?: string;
  userIcon?: string;
}> = (props) => {
  let { address } = useParams<{ address: string }>();
  const { isMobile, isTablet, closeLeftSidebar } = useResponsiveLayoutContext();

  const handleContactClick = () => {
    if (isMobile || isTablet) {
      closeLeftSidebar();
    }
  };

  return (
    <Link to={`/messages/${props.address}`} onClick={handleContactClick}>
      <div
        className={
          'relative direct-message-contact flex flex-row rounded-lg hover:bg-sidebar-hover' +
          (address === props.address ? ' bg-sidebar-active' : '')
        }
      >
        {props.unread && address !== props.address && (
          <div className="dm-unread-dot" title="Unread messages" />
        )}
        <UserAvatar
          userIcon={props.userIcon}
          displayName={props.displayName || truncateAddress(props.address)}
          address={props.address}
          size={38}
          className="direct-message-contact-icon"
        />
        <div className="flex flex-col justify-around">
          <div
            className={
              'direct-message-contact-name text-main opacity-90 pl-2 w-[180px] truncate ' +
              (props.unread && address !== props.address
                ? '!font-extrabold'
                : ' ')
            }
          >
            {props.displayName ?? truncateAddress(props.address)}
          </div>
          {props.displayName && (
            <div className="text-muted pl-2 text-xs w-[180px] truncate">
              {truncateAddress(props.address)}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default DirectMessageContact;
