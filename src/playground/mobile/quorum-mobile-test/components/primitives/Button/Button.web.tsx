import * as React from 'react';
import { WebButtonProps } from './types';
import ReactTooltip from '../../ReactTooltip';
import './Button.scss';

const Button: React.FC<WebButtonProps> = (props) => {
  const baseClass = props.disabled
    ? (props.type === 'disabled-onboarding' ? 'btn-disabled-onboarding' : 'btn-disabled')
    : `btn-${props.type || 'primary'}`;

  const buttonId =
    props.id || `button-${Math.random().toString(36).substring(2, 11)}`;

  return (
    <>
      <span
        id={buttonId}
        className={
          baseClass +
          (props.size === 'small' ? ' btn-small' : '') +
          (props.icon ? ' quorum-button-icon' : '') +
          (props.className ? ' ' + props.className : '')
        }
        onClick={() => {
          if (!props.disabled) props.onClick();
        }}
      >
        {props.children}
      </span>
      {props.tooltip && (
        <ReactTooltip
          id={`${buttonId}-tooltip`}
          content={props.tooltip}
          place="right"
          anchorSelect={`#${buttonId}`}
          highlighted={props.highlightedTooltip}
        />
      )}
    </>
  );
};

export default Button;