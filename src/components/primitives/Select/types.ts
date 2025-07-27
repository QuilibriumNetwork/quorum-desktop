export interface SelectOption {
  value: string;
  label: string;
  icon?: string; // Temporary: emoji or Unicode character, will be FontAwesome icon name later
  avatar?: string; // URL for user avatars (for conversation dropdowns)
  subtitle?: string; // Secondary text (like user addresses)
  disabled?: boolean;
}

export interface SelectOptionGroup {
  groupLabel: string;
  options: SelectOption[];
}

export interface BaseSelectProps {
  value?: string;
  options?: SelectOption[]; // Simple options (alternative to groups)
  groups?: SelectOptionGroup[]; // Grouped options (alternative to options)
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'bordered';
  fullWidth?: boolean;
  width?: string | number; // Custom width (CSS value for web, number for RN)
  dropdownPlacement?: 'top' | 'bottom' | 'auto'; // Dropdown positioning
}

export interface WebSelectProps extends BaseSelectProps {
  // Web-specific props
  name?: string;
  id?: string;
  autoFocus?: boolean;
}

export interface NativeSelectProps extends BaseSelectProps {
  // Native-specific props
  testID?: string;
}
