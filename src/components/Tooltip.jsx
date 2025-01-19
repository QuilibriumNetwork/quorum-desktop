import PropTypes from 'prop-types';

const Tooltip = (props) => (
  <div className={'z-[2000] w-0 ' + props.className}>
    <span
      className={
        'quorum-tooltip quorum-tooltip-arrow-' +
        props.arrow +
        (!props.visible ? ' quorum-tooltip-invisible ' : ' ') +
        props.className
      }
    >
      {props.children}
    </span>
  </div>
);

Tooltip.propTypes = {
  arrow: PropTypes.string.isRequired,
  visible: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Tooltip;
