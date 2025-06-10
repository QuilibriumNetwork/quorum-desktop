import PropTypes from 'prop-types';
import './Tooltip.scss';

const Tooltip = ({ arrow, visible = true, variant = 'light', className = '', children }) => (
  <div className={`z-[2000] w-0 ${className}`}>
    <span
      className={`
        ${variant === 'dark' ? 'quorum-tooltip-dark' : 'quorum-tooltip'}
        ${variant === 'dark' ? `quorum-tooltip-dark-arrow-${arrow}` : `quorum-tooltip-arrow-${arrow}`}
        ${!visible ? `${variant === 'dark' ? 'quorum-tooltip-dark-invisible' : 'quorum-tooltip-invisible'}` : ''}
        ${className}
      `}
    >
      {children}
    </span>
  </div>
);

Tooltip.propTypes = {
  arrow: PropTypes.oneOf(['left', 'right', 'up', 'down', 'none']).isRequired,
  visible: PropTypes.bool,
  variant: PropTypes.oneOf(['light', 'dark']), // Updated to reflect new default
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Tooltip;