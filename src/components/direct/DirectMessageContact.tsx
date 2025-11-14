import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { truncateAddress } from '../../utils';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { UserAvatar } from '../user/UserAvatar';
import { Icon } from '../primitives';
import { formatConversationTime } from '../../utils/dateFormatting';

const DirectMessageContact: React.FunctionComponent<{
  unread: boolean;
  address: string;
  displayName?: string;
  userIcon?: string;
  lastMessagePreview?: string;
  previewIcon?: string;
  timestamp?: number;
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
          'relative flex flex-row items-center py-3 px-4 hover:bg-sidebar-hover' +
          (address === props.address ? ' bg-sidebar-active-strong' : '')
        }
      >
        {props.unread && address !== props.address && (
          <div className="dm-unread-dot" title="Unread messages" />
        )}
        <UserAvatar
          userIcon={props.userIcon}
          displayName={props.displayName || truncateAddress(props.address)}
          address={props.address}
          size={44}
          className="direct-message-contact-icon flex-shrink-0"
        />
        <div className="flex flex-col flex-1 min-w-0 pl-2">
          {/* Line 1: Name + Time */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={
                'truncate flex-1 min-w-0 ' +
                (props.unread && address !== props.address
                  ? 'font-extrabold'
                  : 'font-semibold')
              }
            >
              {props.displayName ?? truncateAddress(props.address)}
            </span>
            {props.timestamp && (
              <span
                className={
                  'text-xs flex-shrink-0 ' +
                  (address === props.address ? 'text-subtle' : 'text-muted')
                }
              >
                {formatConversationTime(props.timestamp)}
              </span>
            )}
          </div>

          {/* Line 2-3: Preview (2 lines max) */}
          {props.lastMessagePreview ? (
            <div
              className={
                'text-sm flex items-start gap-1 ' +
                (address === props.address ? 'text-subtle' : 'text-muted')
              }
            >
              {props.previewIcon && (
                <Icon
                  name={props.previewIcon as any}
                  size="sm"
                  className="flex-shrink-0 mt-0.5"
                />
              )}
              <span className="line-clamp-2 min-w-0">
                {props.lastMessagePreview}
              </span>
            </div>
          ) : props.displayName ? (
            <div
              className={
                'text-xs truncate ' +
                (address === props.address ? 'text-subtle' : 'text-muted')
              }
            >
              {truncateAddress(props.address)}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
};

export default DirectMessageContact;
