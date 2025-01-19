import * as React from 'react';
import PropTypes from 'prop-types';
import Tooltip from './Tooltip';

const Button = (props) => {
  const [isTooltipOpen, setTooltipOpen] = React.useState(false);

  return (
    <>
      <span
        className={
          'p-2 rounded-full shadow-lg font-medium text-sm text-center select-none text-[#301f21] transition duration-300 ' +
          (!props.disabled
            ? props.type === 'primary' || !props.type
              ? 'cursor-pointer border border-[#ffce82] bg-[#f8c271] hover:border-[#ffd79a] hover:bg-[#ffce82]'
              : props.type === 'danger'
                ? 'cursor-pointer border border-[#FF3242] bg-[#FF2232] text-white hover:border-[#FF5462] hover:bg-[#FF4452]'
                : 'cursor-pointer border border-[#FFEEBC] bg-[#FFDEAC] hover:border-[#FFFECC] hover:bg-[#FFEEBC]'
            : 'border border-[#eedfee] bg-[#e0d4e0] cursor-arrow') +
          (props.icon ? ' quorum-button-icon' : '') +
          (props.className ? ' ' + props.className : '')
        }
        onClick={() => {
          if (!props.disabled) {
            props.onClick();
          }
        }}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
      >
        {props.children}
      </span>
      {props.tooltip ? (
        <Tooltip visible={isTooltipOpen} arrow="left">
          {props.tooltip}
        </Tooltip>
      ) : (
        <></>
      )}
    </>
  );
};

Button.propTypes = {
  type: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  icon: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  tooltip: PropTypes.string,
  children: PropTypes.node,
};

export default Button;
