import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import './TooltipButton.scss';

type TooltipButtonProps = {
  icon: IconDefinition;
  text: string;
  type?: 'primary' | 'danger';
  variant?: 'light' | 'dark'; // Updated to match new Tooltip variants
  onClick: React.MouseEventHandler<HTMLDivElement>;
};

const TooltipButton: React.FunctionComponent<TooltipButtonProps> = ({
  icon,
  text,
  type = 'primary',
  variant = 'light', // Changed default to 'light' to match Tooltip default
  onClick,
}) => {
  return (
    <div
      className={`
        quorum-tooltip-button
        quorum-tooltip-button-${variant}
        quorum-tooltip-button-${type}
      `}
      onClick={onClick}
    >
      <span>{text}</span>
      <span className="float-right">
        <FontAwesomeIcon icon={icon} />
      </span>
    </div>
  );
};

export default TooltipButton;
