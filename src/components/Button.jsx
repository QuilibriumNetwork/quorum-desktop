import * as React from 'react';
import PropTypes from 'prop-types';
import ReactTooltip from './ReactTooltip';
import './Button.scss';

const Button = (props) => {
  const baseClass = props.disabled
    ? 'btn-disabled'
    : `btn-${props.type || 'primary'}`;

  const buttonId =
    props.id || `button-${Math.random().toString(36).substr(2, 9)}`;

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

Button.propTypes = {
  id: PropTypes.string,
  type: PropTypes.oneOf([
    'primary',
    'secondary',
    'light',
    'light-outline',
    'danger',
    'primary-white',
    'secondary-white',
    'light-white',
    'light-outline-white',
  ]),
  size: PropTypes.oneOf(['normal', 'small']),
  disabled: PropTypes.bool,
  icon: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  tooltip: PropTypes.string,
  highlightedTooltip: PropTypes.bool,
  children: PropTypes.node,
};

export default Button;
