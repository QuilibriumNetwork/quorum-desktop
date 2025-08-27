import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import './DirectMessageContact.scss';
import { DefaultImages } from '../../utils';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

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
          <div className="w-1 h-1 mt-4 absolute ml-[-6pt] bg-accent rounded-full"></div>
        )}
        <div
          className="direct-message-contact-icon flex flex-col justify-around w-[38px] bg-cover bg-center rounded-full"
          style={{
            backgroundImage:
              props.userIcon &&
              !props.userIcon.includes(DefaultImages.UNKNOWN_USER)
                ? `url(${props.userIcon})`
                : 'var(--unknown-icon)',
          }}
        ></div>
        <div className="flex flex-col justify-around">
          <div
            className={
              'direct-message-contact-name text-main opacity-90 pl-2 w-[180px] truncate ' +
              (props.unread && address !== props.address
                ? '!font-extrabold'
                : ' ')
            }
          >
            {props.displayName ?? props.address}
          </div>
          {props.displayName && (
            <div className="text-muted pl-2 text-xs w-[180px] truncate">
              {props.address}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default DirectMessageContact;
