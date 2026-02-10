import * as React from 'react';
import { WebButtonProps } from './types';
import { ReactTooltip } from '../../ui';
import { Icon } from '../Icon';
import './Button.scss';

const Button: React.FC<WebButtonProps> = (props) => {
  const isDisabledOnboarding =
    props.disabled && props.type === 'disabled-onboarding';

  const baseClass = props.disabled
    ? isDisabledOnboarding
      ? 'btn-disabled-onboarding'
      : 'btn-disabled'
    : `btn-${props.type || 'primary'}`;

  const buttonId =
    props.id || `button-${Math.random().toString(36).substring(2, 11)}`;

  return (
    <>
      <button
        type="button"
        id={buttonId}
        className={
          baseClass +
          (props.size === 'compact' ? ' btn-compact' : '') +
          (props.size === 'small' ? ' btn-small' : '') +
          (props.size === 'large' ? ' btn-large' : '') +
          (props.icon ? ' quorum-button-icon' : '') +
          (props.iconName && props.iconOnly ? ' quorum-button-icon-only' : '') +
          (props.iconName && !props.iconOnly
            ? ' quorum-button-with-icon'
            : '') +
          (props.fullWidth ? ' btn-full-width' : '') +
          (props.className ? ' ' + props.className : '')
        }
        disabled={props.disabled && !isDisabledOnboarding}
        aria-disabled={isDisabledOnboarding ? 'true' : undefined}
        aria-label={props.ariaLabel}
        onClick={(e) => {
          if (isDisabledOnboarding) return;
          props.onClick(e);
        }}
      >
        {props.iconName && (
          <Icon
            name={props.iconName}
            size={
              props.iconSize ||
              (props.size === 'small'
                ? 'sm'
                : props.size === 'large'
                  ? 'lg'
                  : 'md')
            }
            variant={props.iconVariant}
            className="quorum-button-icon-element"
            style={{ color: 'inherit' }}
          />
        )}
        {!props.iconOnly && props.children}
      </button>
      {props.tooltip && (
        <ReactTooltip
          id={`${buttonId}-tooltip`}
          content={props.tooltip}
          place="right"
          anchorSelect={`#${buttonId}`}
        />
      )}
    </>
  );
};

export default Button;
