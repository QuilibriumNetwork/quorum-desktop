import * as React from 'react';
import './SpaceIcon.scss';
import { Tooltip } from '../primitives';
import { useImageLoading } from '../../hooks';
import { useDragStateContext } from '../../context/DragStateContext';
import { formatMentionCount } from '../../utils/formatMentionCount';
import { UserInitials } from '../user/UserInitials';
import { getColorFromDisplayName } from '../../utils/avatar';
import { DefaultImages } from '../../utils';

type SpaceIconProps = {
  selected: boolean;
  iconUrl?: string;
  iconData?: Promise<ArrayBuffer>;
  spaceName: string;
  size: 'regular' | 'large';
  notifs: boolean;
  noTooltip?: boolean;
  noToggle?: boolean;
  spaceId?: string; // Add spaceId to make IDs unique
  highlightedTooltip?: boolean;
  mentionCount?: number;
};
const SpaceIcon: React.FunctionComponent<SpaceIconProps> = (props) => {
  const { backgroundImage } = useImageLoading({
    iconData: props.iconData,
    iconUrl: props.iconUrl,
  });

  // Check if we're in a drag context (will be undefined if not in DragStateProvider)
  let isDragging = false;
  try {
    const dragContext = useDragStateContext();
    isDragging = dragContext.isDragging;
  } catch {
    // Not in drag context, tooltips should work normally
    isDragging = false;
  }

  // Generate a unique ID for this space icon
  // Use spaceId if available, otherwise sanitize the space name
  const sanitizedName = props.spaceName
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '-') // Replace all non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen

  const uniqueId = props.spaceId || sanitizedName || 'default';

  // Use useMemo to ensure stable ID across renders
  const iconId = React.useMemo(() => {
    return `space-icon-${uniqueId}-${Math.random().toString(36).substr(2, 9)}`;
  }, [uniqueId]);

  // Check if there's a valid image
  const hasValidImage = backgroundImage &&
    props.iconUrl &&
    !props.iconUrl.includes(DefaultImages.UNKNOWN_USER);

  // Generate background color for initials
  const backgroundColor = React.useMemo(
    () => getColorFromDisplayName(props.spaceName),
    [props.spaceName]
  );

  // Match the CSS sizes: $nav-space-icon-size is 48px, large is 114px
  const size = props.size === 'large' ? 114 : 48;

  const iconElement = (
    <div className="relative z-[999]">
      {!props.noToggle && (
        <div
          className={`${props.selected ? 'space-icon-selected' : props.notifs ? 'space-icon-has-notifs' : 'space-icon'}-toggle`}
        />
      )}
      {hasValidImage ? (
        <div
          className={`${props.selected ? 'space-icon-selected' : 'space-icon'} space-icon-${props.size}`}
          style={{
            backgroundImage,
          }}
          {...(props.noTooltip ? {} : { id: `${iconId}-anchor` })}
        />
      ) : (
        <UserInitials
          name={props.spaceName}
          backgroundColor={backgroundColor}
          size={size}
          className={`${props.selected ? 'space-icon-selected' : 'space-icon'} space-icon-${props.size}`}
          {...(props.noTooltip ? {} : { id: `${iconId}-anchor` })}
        />
      )}
      {props.mentionCount && props.mentionCount > 0 && (
        <span className="space-icon-mention-bubble">
          {formatMentionCount(props.mentionCount, 9)}
        </span>
      )}
    </div>
  );

  return props.noTooltip || isDragging ? (
    iconElement
  ) : (
    <Tooltip
      id={iconId}
      content={props.spaceName}
      place="right"
      highlighted={props.highlightedTooltip}
      showOnTouch={false}
    >
      {iconElement}
    </Tooltip>
  );
};

export default SpaceIcon;
