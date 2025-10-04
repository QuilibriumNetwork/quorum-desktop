export interface UserInitialsProps {
  // Common props for both platforms
  name: string; // Display name (for initials)
  backgroundColor: string; // Pre-calculated background color (for privacy)
  size?: number; // Size in dp/px

  // Web-specific props (ignored on mobile)
  className?: string;
  id?: string;
  onClick?: (event: React.MouseEvent) => void;

  // Mobile-specific props (ignored on web)
  testID?: string;
  onPress?: () => void;
}
