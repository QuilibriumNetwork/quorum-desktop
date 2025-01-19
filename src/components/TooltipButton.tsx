import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';

import './TooltipButton.scss';

type TooltipButtonProps = {
  icon: IconDefinition;
  text: string;
  type?: 'primary' | 'danger';
  onClick: React.MouseEventHandler<HTMLDivElement>;
};

const TooltipButton: React.FunctionComponent<TooltipButtonProps> = (props) => {
  return (
    <div
      className={
        'quorum-tooltip-button quorum-tooltip-button-' +
        (props.type || 'primary')
      }
      onClick={props.onClick}
    >
      <span>{props.text}</span>
      <span className="float-right">
        <FontAwesomeIcon icon={props.icon} />
      </span>
    </div>
  );
};

export default TooltipButton;
