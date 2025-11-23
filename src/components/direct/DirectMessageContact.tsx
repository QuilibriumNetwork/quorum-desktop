import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { truncateAddress } from '../../utils';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { UserAvatar } from '../user/UserAvatar';
import { Icon } from '../primitives';
import { formatConversationTime } from '../../utils/dateFormatting';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { hapticLight } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { isTouchDevice } from '../../utils/platform';

const DirectMessageContact: React.FunctionComponent<{
  unread: boolean;
  address: string;
  displayName?: string;
  userIcon?: string;
  lastMessagePreview?: string;
  previewIcon?: string;
  timestamp?: number;
}> = (props) => {
  const navigate = useNavigate();
  let { address } = useParams<{ address: string }>();
  const { isMobile, isTablet, closeLeftSidebar } = useResponsiveLayoutContext();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const isTouch = isTouchDevice();

  const handleContactClick = () => {
    // Set navigating state to maintain accent color during transition
    setIsNavigating(true);
    if (isMobile || isTablet) {
      closeLeftSidebar();
    }
    navigate(`/messages/${props.address}`);
  };

  // Long press handlers for touch devices with scroll threshold detection
  const longPressHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    onLongPress: undefined, // No long press action for DM contacts
    onTap: () => {
      hapticLight();
      handleContactClick();
    },
    shouldPreventDefault: true,
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
  });

  // Mouse handlers for desktop - only track pressed state
  const [isPressed, setIsPressed] = React.useState(false);
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  // Reset navigating state when this contact becomes active
  React.useEffect(() => {
    if (address === props.address && isNavigating) {
      setIsNavigating(false);
    }
  }, [address, props.address, isNavigating]);

  const isActive = address === props.address || isNavigating;

  // Common content for both touch and desktop
  const contactContent = (
    <>
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
                'text-xs flex-shrink-0 min-w-15 whitespace-nowrap ' +
                (isActive ? 'text-subtle' : 'text-muted')
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
              (isActive ? 'text-subtle' : 'text-muted')
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
              (isActive ? 'text-subtle' : 'text-muted')
            }
          >
            {truncateAddress(props.address)}
          </div>
        ) : null}
      </div>
    </>
  );

  // Touch device: use long press handlers with scroll threshold detection
  if (isTouch) {
    return (
      <div
        {...longPressHandlers}
        className={
          'relative flex flex-row items-center py-3 px-4 cursor-pointer' +
          (isActive ? ' !bg-sidebar-active-accent' : '') +
          (longPressHandlers.className ? ` ${longPressHandlers.className}` : '')
        }
        style={longPressHandlers.style}
      >
        {contactContent}
      </div>
    );
  }

  // Desktop: use standard click handlers with hover state
  return (
    <div
      role="link"
      tabIndex={0}
      className={
        'relative flex flex-row items-center py-3 px-4 cursor-pointer' +
        (isActive || isPressed
          ? ' !bg-sidebar-active-accent'
          : ' hover:bg-sidebar-hover')
      }
      onClick={handleContactClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleContactClick();
        }
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {contactContent}
    </div>
  );
};

export default DirectMessageContact;
