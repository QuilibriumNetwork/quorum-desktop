import * as React from 'react';
import './SpaceIcon.scss';
import ReactTooltip from '../ReactTooltip';

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
  const [data, setData] = React.useState<ArrayBuffer>();

  React.useEffect(() => {
    if (!data && props.iconData) {
      props.iconData.then((data) => {
        setData(data);
      });
    }
  }, [data]);

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
  return (
    <>
      <div className="relative z-[999]">
        {!props.noToggle && (
          <div
            className={`${props.selected ? 'space-icon-selected' : props.notifs ? 'space-icon-has-notifs' : 'space-icon'}-toggle`}
          />
        )}
        <div
          id={iconId}
          className={`${props.selected ? 'space-icon-selected' : 'space-icon'} space-icon-${props.size}`}
          style={{
            backgroundImage: props.iconUrl
              ? `url(${props.iconUrl})`
              : data
                ? `url(data:image/png;base64,${Buffer.from(data).toString('base64')})`
                : '',
          }}
        ></div>
      </div>
      {!props.noTooltip && (
        <ReactTooltip
          id={`${iconId}-tooltip`}
          content={props.spaceName}
          place="right"
          anchorSelect={`#${iconId}`}
          highlighted={props.highlightedTooltip}
        />
      )}
    </>
  );
};

export default SpaceIcon;
