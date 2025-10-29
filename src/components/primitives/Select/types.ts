export interface SelectOption {
  value: string;
  label: string;
  icon?: string; // Temporary: emoji or Unicode character, will be FontAwesome icon name later
  avatar?: string; // URL for user avatars (for conversation dropdowns)
  displayName?: string; // Display name for user initials fallback (when avatar is invalid)
  userAddress?: string; // User address for deterministic color generation in initials
  subtitle?: string; // Secondary text (like user addresses)
  disabled?: boolean;
}

export interface SelectOptionGroup {
  groupLabel: string;
  options: SelectOption[];
}

export interface BaseSelectProps {
  value?: string | string[]; // Support both single and multiple values
  options?: SelectOption[]; // Simple options (alternative to groups)
  groups?: SelectOptionGroup[]; // Grouped options (alternative to options)
  onChange?: (value: string | string[]) => void; // Handle both single and multiple values
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

  // Multiselect specific props
  multiple?: boolean; // Enable multiselect mode
  renderSelectedValue?: (
    selected: string[],
    options: SelectOption[]
  ) => React.ReactNode; // Custom display for selected values
  selectAllLabel?: string; // Label for "Select All" option (default: "Select All")
  clearAllLabel?: string; // Label for "Clear All" option (default: "Clear All")
  maxHeight?: string | number; // Maximum height for dropdown
  showSelectAllOption?: boolean; // Show select all/clear all options (default: true when multiple)
  maxDisplayedChips?: number; // Maximum number of chips to display before showing count (default: 3)

  // Compact mode props
  compactMode?: boolean; // Show only icon button, hide selected values
  compactIcon?: string; // Icon to display in compact mode (default: 'filter')
  showSelectionCount?: boolean; // Show badge with selection count in compact mode (default: false)
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
