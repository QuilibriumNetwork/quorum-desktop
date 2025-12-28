import { ViewStyle } from 'react-native';

export interface RadioOption<T = string> {
  value: T;
  label: string;
  icon?: string; // Emoji or FontAwesome icon (web only)
  disabled?: boolean;
  tooltip?: string; // Tooltip text (web only)
  tooltipPlace?: 'top' | 'bottom' | 'left' | 'right'; // Tooltip position (web only)
}

// Shared props between web and native
export interface RadioGroupProps<T = string> {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  direction?: 'horizontal' | 'vertical';
  disabled?: boolean;
  iconOnly?: boolean; // Show only icons, hide text labels
  variant?: 'default' | 'bordered'; // Default has no border, bordered has border
  testID?: string;
}

// Web-specific props
export interface RadioGroupWebProps<T = string> extends RadioGroupProps<T> {
  className?: string;
  style?: React.CSSProperties;
  name?: string; // For form integration
}

// Native-specific props
export interface RadioGroupNativeProps<T = string> extends RadioGroupProps<T> {
  style?: ViewStyle;
}
