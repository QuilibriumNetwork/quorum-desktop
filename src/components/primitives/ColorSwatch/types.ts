import { ViewStyle } from 'react-native';

// Shared props between web and native
export interface ColorSwatchProps {
  color: string;
  isActive?: boolean;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  showCheckmark?: boolean;
  disabled?: boolean;
  testID?: string;
  /** If true, adds accent-{color} class to override app accent CSS vars (used in theme picker) */
  applyAccentTheme?: boolean;
}

// Web-specific props
export interface ColorSwatchWebProps extends ColorSwatchProps {
  className?: string;
  style?: React.CSSProperties;
}

// Native-specific props
export interface ColorSwatchNativeProps extends ColorSwatchProps {
  style?: ViewStyle;
}
