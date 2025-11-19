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
  const [isPressed, setIsPressed] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);

  const handleContactClick = () => {
    // Set navigating state to maintain accent color during transition
    setIsNavigating(true);
    if (isMobile || isTablet) {
      closeLeftSidebar();
    }
  };

  const handleMouseDown = () => {
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  const handleTouchStart = () => {
    setIsPressed(true);
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
  };

  // Reset navigating state when this contact becomes active
  React.useEffect(() => {
    if (address === props.address && isNavigating) {
      setIsNavigating(false);
    }
  }, [address, props.address, isNavigating]);

  return (
    <Link to={`/messages/${props.address}`} onClick={handleContactClick}>
      <div
        className={
          'relative flex flex-row items-center py-3 px-4' +
          (address === props.address || isPressed || isNavigating
            ? ' !bg-sidebar-active-accent'
            : ' hover:bg-sidebar-hover'
          )
        }
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
                'truncate-user-name flex-1 min-w-0 ' +
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
