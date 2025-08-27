import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface ActionMenuItemProps {
  icon: IconDefinition;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

/**
 * Component for action menu items in the mobile drawer.
 * Provides consistent styling and behavior for action buttons.
 */
const ActionMenuItem: React.FC<ActionMenuItemProps> = ({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
}) => {
  return (
    <button
      className={`action-menu-item action-menu-item--${variant} ${disabled ? 'action-menu-item--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      type="button"
    >
      <div className="action-menu-item__icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <span className="action-menu-item__label">{label}</span>
    </button>
  );
};

export default ActionMenuItem;