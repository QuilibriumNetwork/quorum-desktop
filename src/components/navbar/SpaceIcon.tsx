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
  size: 'small' | 'regular' | 'large';
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

  // Check if there's a valid image
  const hasValidImage = backgroundImage &&
    props.iconUrl &&
    !props.iconUrl.includes(DefaultImages.UNKNOWN_USER);

  // Generate background color for initials
  const backgroundColor = React.useMemo(
    () => getColorFromDisplayName(props.spaceName),
    [props.spaceName]
  );

  // Generate unique ID for tooltip
  const iconId = React.useMemo(
    () => `space-icon-${props.spaceId || 'unknown'}-${Math.random().toString(36).slice(2, 7)}`,
    [props.spaceId]
  );

  // Match the CSS sizes: small is 40px, regular is 48px, large is 114px
  const size = props.size === 'large' ? 114 : props.size === 'small' ? 40 : 48;

  const iconElement = (
    <div className="relative z-[999]">
      {!props.noToggle && !isDragging && (
        <div
          className={`space-icon-toggle ${
            props.selected
              ? 'space-icon-toggle--selected'
              : props.notifs
                ? 'space-icon-toggle--unread'
                : ''
          }`}
        />
      )}
      {hasValidImage ? (
        <div
          className={`${props.selected ? 'space-icon-selected' : 'space-icon'} space-icon-${props.size}`}
          style={{
            backgroundImage,
          }}
        />
      ) : (
        <UserInitials
          name={props.spaceName}
          backgroundColor={backgroundColor}
          size={size}
          className={`${props.selected ? 'space-icon-selected' : 'space-icon'} space-icon-${props.size}`}
        />
      )}
      {props.mentionCount != null && props.mentionCount > 0 && (
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
