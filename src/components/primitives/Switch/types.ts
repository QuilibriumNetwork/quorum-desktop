export interface BaseSwitchProps {
  /** Whether the switch is currently on/off */
  value: boolean;
  /** Callback when switch value changes */
  onChange: (value: boolean) => void;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Accessible label for the switch */
  accessibilityLabel?: string;
  /** Additional CSS classes (web only) */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties | object;
  /** Test ID for testing purposes */
  testID?: string;
}

export interface WebSwitchProps extends BaseSwitchProps {
  /** Size variant for web implementation */
  size?: 'small' | 'medium' | 'large';
  /** Color variant - currently only default (accent) is supported */
  variant?: 'default';
}

export interface NativeSwitchProps extends BaseSwitchProps {
  /** Enable haptic feedback on iOS (if available) */
  hapticFeedback?: boolean;
  /** Track color when switch is off (Android) */
  trackColorFalse?: string;
  /** Track color when switch is on (Android) */
  trackColorTrue?: string;
  /** Thumb color (both platforms) */
  thumbColor?: string;
}