import { IconName } from '../Icon/types';

export interface BaseButtonProps {
  id?: string;
  type?:
    | 'primary'
    | 'secondary'
    | 'light'
    | 'light-outline'
    | 'subtle'
    | 'subtle-outline'
    | 'danger'
    | 'primary-white'
    | 'secondary-white'
    | 'light-white'
    | 'light-outline-white'
    | 'disabled-onboarding'
    | 'unstyled';
  size?: 'compact' | 'small' | 'normal' | 'large';
  disabled?: boolean;
  fullWidth?: boolean; // If true, button takes full width of container
  icon?: boolean; // Legacy prop for existing compatibility
  iconName?: IconName; // FontAwesome icon to display (left of text or icon-only)
  iconOnly?: boolean; // If true, only show icon without text
  className?: string;
  onClick: (event?: React.MouseEvent) => void;
  tooltip?: string;
  highlightedTooltip?: boolean;
  children?: React.ReactNode;
}

export interface WebButtonProps extends BaseButtonProps {
  // Web-specific props if needed
}

export interface NativeButtonProps extends BaseButtonProps {
  // Native-specific props
  hapticFeedback?: boolean;
  accessibilityLabel?: string;
  fullWidthWithMargin?: boolean; // If true, button takes full width but with 40px left/right margins
}
