import { ViewStyle } from 'react-native';

export interface SpaceAvatarProps {
  // Common props for both platforms
  iconUrl?: string; // URL to space icon (optional)
  iconData?: string | null; // Base64 icon data or null for initials fallback
  spaceName: string; // Space name (for generating initials)
  size?: number; // Size in dp/px (default: 40)

  // Web-specific props (ignored on mobile)
  className?: string;
  id?: string;
  onClick?: (event: React.MouseEvent) => void;

  // Mobile-specific props (ignored on web)
  testID?: string;
  style?: ViewStyle;
  onPress?: () => void;
}
