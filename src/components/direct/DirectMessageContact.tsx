import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatAddress } from '@quilibrium/quorum-shared';
import { UserAvatar } from '../user/UserAvatar';
import { useResolvedMemberName } from '../../identity';
import { realIconOrUndefined } from '../../utils/identityPlaceholder';
import { Icon } from '../primitives';
import { formatConversationTime } from '../../utils/dateFormatting';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { hapticLight, hapticMedium } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { isTouchDevice } from '../../utils/platform';

const DirectMessageContact: React.FunctionComponent<{
  unread: boolean;
  address: string;
  /** Raw stored field — used ONLY as an "is there any known identity at all"
   *  flag for the address-subtitle fallback below. The rendered NAME never
   *  reads this; it resolves through `useResolvedMemberName`. */
  displayName?: string;
  userIcon?: string;
  lastMessagePreview?: string;
  previewIcon?: string;
  timestamp?: number;
  isMuted?: boolean;
  isFavorite?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onOpenSettings?: () => void;
}> = (props) => {
  const navigate = useNavigate();
  const { address } = useParams<{ address: string }>();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const isTouch = isTouchDevice();

  const handleContactClick = () => {
    // Set navigating state to maintain accent color during transition
    setIsNavigating(true);
    navigate(`/messages/${props.address}`);
  };

  // Long press handlers for touch devices with scroll threshold detection
  const longPressHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    onLongPress: props.onOpenSettings
      ? () => {
          hapticMedium();
          props.onOpenSettings?.();
        }
      : undefined,
    onTap: () => {
      hapticLight();
      handleContactClick();
    },
    shouldPreventDefault: true,
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
  });

  // Context menu handler (desktop only)
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isTouch && props.onContextMenu) {
      e.preventDefault();
      props.onContextMenu(e);
    }
  };

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

  // Resolves through src/identity: DirectMessageContactsList mounts the
  // ambient <IdentityScopeProvider> (global scope — no spaceId, so a
  // per-space nickname is meaningless for a DM contact). `enrich`: a DM
  // partner is one person per row and the `.q` matters here, and the
  // contacts list already fetches a public profile per conversation today
  // (useConversationsWithProfileBackfill) — this enrich request shares the
  // same query key, so it costs no extra network round-trip.
  //
  // Computed ONCE and reused for both the avatar's bare name and the visible
  // label below, so the two cannot disagree.
  const resolved = useResolvedMemberName(props.address, { enrich: true });

  // Common content for both touch and desktop
  const contactContent = (
    <>
      {/* Avatar with optional unread dot, muted badge, favorite border */}
      <div className="relative flex-shrink-0">
        <UserAvatar
          // Placeholder name/icon must not reach the avatar: the literal
          // 'Unknown User' renders a "?" while the header shows address
          // initials for the same row. Feed it the RESOLVED name so the
          // initials match the label underneath.
          userIcon={realIconOrUndefined(props.userIcon)}
          displayName={resolved.name}
          address={props.address}
          size={44}
          className={
            'direct-message-contact-icon' +
            (props.isFavorite ? ' dm-favorite-avatar' : '')
          }
        />
        {props.unread && address !== props.address && (
          <div className="icon-unread-dot" title="Unread messages" />
        )}
        {props.isMuted && (
          <div
            className="dm-muted-badge"
            title="Muted"
          >
            <Icon name="bell-off" size="sm" />
          </div>
        )}
      </div>
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
            {resolved.name}
            {resolved.isQnsVerified && '.q'}
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
            {formatAddress(props.address)}
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
          'direct-messages-contact sidebar-row-chrome flex flex-row items-center py-3 px-4 cursor-pointer' +
          (isActive ? ' !bg-sidebar-active-accent direct-messages-contact--active' : '') +
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
        'direct-messages-contact sidebar-row-chrome flex flex-row items-center py-3 px-4 cursor-pointer' +
        (isActive || isPressed
          ? ' !bg-sidebar-active-accent direct-messages-contact--active'
          : '')
      }
      onClick={handleContactClick}
      onContextMenu={handleContextMenu}
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
