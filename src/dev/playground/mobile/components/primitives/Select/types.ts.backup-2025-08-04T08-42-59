export interface SelectOption {
  value: string;
  label: string;
  icon?: string; // Temporary: emoji or Unicode character, will be FontAwesome icon name later
  disabled?: boolean;
}

export interface BaseSelectProps {
  value?: string;
  options: SelectOption[];
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
