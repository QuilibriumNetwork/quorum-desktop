import * as React from 'react';
import './ToggleSwitch.scss';

type ToggleSwitchProps = {
  active: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

const ToggleSwitch: React.FunctionComponent<ToggleSwitchProps> = (props) => {
  return (
    <div
      onClick={props.onClick}
      className={
        'quorum-toggle-switch' +
        (props.active
          ? ' quorum-toggle-switch-active'
          : ' quorum-toggle-switch-inactive')
      }
    >
      <div className="quorum-toggle-switch-flipper" />
    </div>
  );
};

export default ToggleSwitch;
