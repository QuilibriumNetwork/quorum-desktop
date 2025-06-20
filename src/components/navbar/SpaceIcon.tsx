import * as React from 'react';
import './SpaceIcon.scss';
import Tooltip from '../Tooltip';

type SpaceIconProps = {
  selected: boolean;
  iconUrl?: string;
  iconData?: Promise<ArrayBuffer>;
  spaceName: string;
  size: 'regular' | 'large';
  notifs: boolean;
  noTooltip?: boolean;
  noToggle?: boolean;
};
const SpaceIcon: React.FunctionComponent<SpaceIconProps> = (props) => {
  const [isTooltipOpen, setTooltipOpen] = React.useState<
    [number, number] | undefined
  >(undefined);
  const [data, setData] = React.useState<ArrayBuffer>();

  React.useEffect(() => {
    if (!data && props.iconData) {
      props.iconData.then((data) => {
        setData(data);
      });
    }
  }, [data]);
  return (
    <>
      <div className="relative z-[999]">
        {!props.noToggle && (
          <div
            className={`${props.selected ? 'space-icon-selected' : props.notifs ? 'space-icon-has-notifs' : 'space-icon'}-toggle`}
          />
        )}
        <div
          className={`${props.selected ? 'space-icon-selected' : 'space-icon'} space-icon-${props.size}`}
          style={{
            backgroundImage: props.iconUrl
              ? `url(${props.iconUrl})`
              : data
                ? `url(data:image/png;base64,${Buffer.from(data).toString('base64')})`
                : '',
          }}
          onMouseEnter={(e) =>
            setTooltipOpen([
              78,
              e.currentTarget.getBoundingClientRect().top + 5,
            ])
          }
          onMouseLeave={() => setTooltipOpen(undefined)}
        ></div>
      </div>
      {!props.noTooltip && (
        <div
          className="absolute z-[2000] ml-[3rem]"
          style={{ top: '' + (isTooltipOpen ?? [0, 0])[1] + 'px' }}
        >
          <Tooltip
            visible={isTooltipOpen !== undefined}
            className="absolute whitespace-nowrap"
            arrow="{user} has left"
          >
            {props.spaceName}
          </Tooltip>
        </div>
      )}
    </>
  );
};

export default SpaceIcon;
