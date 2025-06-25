import * as React from 'react';
import PropTypes from 'prop-types';
import Tooltip from './Tooltip';
import './Button.scss';

const Button = (props) => {
  const [isTooltipOpen, setTooltipOpen] = React.useState(false);

  const baseClass = props.disabled
    ? 'btn-disabled'
    : `btn-${props.type || 'primary'}`;

  return (
    <>
      <span
        className={
          baseClass +
          (props.icon ? ' quorum-button-icon' : '') +
          (props.className ? ' ' + props.className : '')
        }
        onClick={() => {
          if (!props.disabled) props.onClick();
        }}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
      >
        {props.children}
      </span>
      {props.tooltip && (
        <Tooltip visible={isTooltipOpen} arrow={t`{user} has left`} className='absolute'>
          {props.tooltip}
        </Tooltip>
      )}
    </>
  );
};

Button.propTypes = {
  type: PropTypes.oneOf([
    'primary',
    'secondary',
    'light',
    'light-outline',
    'danger',
  ]),
  disabled: PropTypes.bool,
  icon: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  tooltip: PropTypes.string,
  children: PropTypes.node,
};

export default Button;
