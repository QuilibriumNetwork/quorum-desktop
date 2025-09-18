import { IconName } from '../../primitives/Icon/types';

export type IconColor = 'default' | 'blue' | 'purple' | 'fuchsia' | 'orange' | 'green' | 'yellow';

export interface IconOption {
  name: IconName;
  tier: number;
  category: string;
}

export interface ColorOption {
  value: IconColor;
  label: string;
  class: string;
  hex: string;
}

export interface IconPickerProps {
  selectedIcon?: IconName;
  selectedIconColor?: IconColor;
  onIconSelect: (icon: IconName | null, iconColor: IconColor) => void;
  buttonVariant?: 'subtle' | 'primary' | 'secondary';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

// 35 icons as specified in the task, organized by tier
export const ICON_OPTIONS: IconOption[] = [
  // Tier 1: Essential & Most Common (Top Row)
  { name: 'bullhorn', tier: 1, category: 'Announcements' },
  { name: 'hashtag', tier: 1, category: 'General' },
  { name: 'home', tier: 1, category: 'Main' },
  { name: 'users', tier: 1, category: 'Team' },
  { name: 'comment-dots', tier: 1, category: 'Discussion' },
  { name: 'star', tier: 1, category: 'Important' },

  // Tier 2: Popular Categories (Second Row)
  { name: 'briefcase', tier: 2, category: 'Business' },
  { name: 'gamepad', tier: 2, category: 'Gaming' },
  { name: 'image', tier: 2, category: 'Media' },
  { name: 'video', tier: 2, category: 'Video' },
  { name: 'microphone', tier: 2, category: 'Audio' },
  { name: 'smile', tier: 2, category: 'Fun' },

  // Tier 3: Work & Organization
  { name: 'book', tier: 3, category: 'Documentation' },
  { name: 'tools', tier: 3, category: 'Development' },
  { name: 'code', tier: 3, category: 'Programming' },
  { name: 'clipboard-list', tier: 3, category: 'Tasks' },
  { name: 'cog', tier: 3, category: 'Settings' },
  { name: 'shield', tier: 3, category: 'Security' },

  // Tier 4: Communication & Events
  { name: 'bell', tier: 4, category: 'Notifications' },
  { name: 'calendar-alt', tier: 4, category: 'Events' },
  { name: 'celebration', tier: 4, category: 'Parties' },
  { name: 'gift', tier: 4, category: 'Rewards' },
  { name: 'heart', tier: 4, category: 'Community' },

  // Tier 5: Support & Information
  { name: 'info-circle', tier: 5, category: 'Information' },
  { name: 'life-ring', tier: 5, category: 'Support' },
  { name: 'question-circle', tier: 5, category: 'FAQ' },
  { name: 'search', tier: 5, category: 'Research' },
  { name: 'bookmark', tier: 5, category: 'Resources' },

  // Tier 6: Specialized Interests
  { name: 'money', tier: 6, category: 'Finance' },
  { name: 'food', tier: 6, category: 'Food' },
  { name: 'paw', tier: 6, category: 'Animals' },
  { name: 'leaf', tier: 6, category: 'Nature' },
  { name: 'sword', tier: 6, category: 'Combat' },
  { name: 'headset', tier: 6, category: 'Gaming Communication' },
  { name: 'chart-line', tier: 6, category: 'Analytics' },
];

// Icon colors based on AccentColorSwitcher
export const ICON_COLORS: ColorOption[] = [
  { value: 'default', label: 'Default', class: 'text-subtle', hex: '#9ca3af' },
  { value: 'blue', label: 'Blue', class: 'text-accent-blue', hex: '#3b82f6' },
  { value: 'purple', label: 'Purple', class: 'text-accent-purple', hex: '#8b5cf6' },
  { value: 'fuchsia', label: 'Fuchsia', class: 'text-accent-fuchsia', hex: '#d946ef' },
  { value: 'orange', label: 'Orange', class: 'text-accent-orange', hex: '#f97316' },
  { value: 'green', label: 'Green', class: 'text-accent-green', hex: '#22c55e' },
  { value: 'yellow', label: 'Yellow', class: 'text-accent-yellow', hex: '#eab308' },
];

// Helper function to get icon color hex value
export const getIconColorHex = (iconColor?: IconColor): string => {
  if (!iconColor || iconColor === 'default') {
    return '#9ca3af'; // default gray
  }

  const colorOption = ICON_COLORS.find(color => color.value === iconColor);
  if (!colorOption) {
    console.warn(`getIconColorHex: Unknown color '${iconColor}', using default`);
    return '#9ca3af'; // default gray
  }

  return colorOption.hex;
};

// Helper function to get icon color class (for fallback)
export const getIconColorClass = (iconColor?: IconColor): string => {
  if (!iconColor || iconColor === 'default') return 'text-subtle';
  return `text-accent-${iconColor}`;
};