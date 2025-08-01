import * as React from 'react';
import './SpaceIcon.scss';
import { Tooltip } from '../primitives';
import { useImageLoading } from '../../hooks';
import { useDragStateContext } from '../../context/DragStateContext';

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
  const iconElement = (
    <div className="relative z-[999]">
      {!props.noToggle && (
        <div
          className={`${props.selected ? 'space-icon-selected' : props.notifs ? 'space-icon-has-notifs' : 'space-icon'}-toggle`}
        />
      )}
      <div
        className={`${props.selected ? 'space-icon-selected' : 'space-icon'} space-icon-${props.size}`}
        style={{
          backgroundImage,
        }}
        {...(props.noTooltip ? {} : { id: `${iconId}-anchor` })}
      />
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
