import { IconName, IconVariant } from '../../primitives/Icon/types';

export type IconColor = 'default' | 'blue' | 'purple' | 'fuchsia' | 'green' | 'orange' | 'yellow' | 'red';

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
  selectedIconVariant?: IconVariant;
  onIconSelect: (icon: IconName | null, iconColor: IconColor, iconVariant: IconVariant) => void;
  buttonVariant?: 'subtle' | 'primary' | 'secondary';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  testID?: string;
  defaultIcon?: IconName; // Icon to use when clearing (for channels that always need an icon)
  /**
   * Display mode for the IconPicker
   * - 'icon-color' (default): Icons are colored, swatches show icon preview
   * - 'background-color': Icons always white, swatches show as colored backgrounds (for folder icons)
   */
  mode?: 'icon-color' | 'background-color';
}

// Icons that have filled variants in Tabler Icons library
// These icons will be shown when "Filled" variant is selected
export const FILLED_ICONS: Set<IconName> = new Set([
  'star',
  'heart',
  'home',
  'bell',
  'shield',
  'lock',
  'eye',
  'bookmark',
  'circle',
  'comment-dots', // IconMessageFilled
  'smile', // IconMoodSmileFilled
  'info-circle', // IconInfoCircleFilled
  'question-circle', // IconHelpCircleFilled
  'check-circle', // IconCircleCheckFilled
  'warning', // IconAlertTriangleFilled
  'gift', // IconGiftFilled
  'pin', // IconPinFilled
  'briefcase', // IconBriefcaseFilled
  'image', // IconPhotoFilled
  'video', // IconVideoFilled
  'microphone', // IconMicrophoneFilled
  'settings', // IconSettingsFilled
  'bug', // IconBugFilled
  'calendar-alt', // IconCalendarFilled
  'book', // IconBookFilled
  'paw', // IconPawFilled
  'headset', // IconHeadphonesFilled
  'palette', // IconPaletteFilled
  'flask', // IconFlaskFilled
  'fire', // IconFlameFilled
  'certificate', // IconRosetteDiscountCheckFilled (new mapping)
  'seedling', // IconSeedlingFilled
  'folder', // IconFolderFilled
]);

// 50 icons organized by tier and category
export const ICON_OPTIONS: IconOption[] = [
  // Tier 1: Essential & Most Common (Top Row)
  { name: 'bullhorn', tier: 1, category: 'Announcements' },
  { name: 'hashtag', tier: 1, category: 'General' },
  { name: 'home', tier: 1, category: 'Main' },
  { name: 'users', tier: 1, category: 'Team' },
  { name: 'comment-dots', tier: 1, category: 'Discussion' },
  { name: 'star', tier: 1, category: 'Important' },
  { name: 'folder', tier: 1, category: 'Organization' },

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
  { name: 'settings', tier: 3, category: 'Settings' },
  { name: 'shield', tier: 3, category: 'Security' },
  { name: 'bug', tier: 3, category: 'Issues' },

  // Tier 4: Communication & Events
  { name: 'bell', tier: 4, category: 'Notifications' },
  { name: 'calendar-alt', tier: 4, category: 'Events' },
  { name: 'gift', tier: 4, category: 'Rewards' },
  { name: 'heart', tier: 4, category: 'Community' },

  // Tier 5: Support & Information
  { name: 'info-circle', tier: 5, category: 'Information' },
  { name: 'support', tier: 5, category: 'Support' },
  { name: 'question-circle', tier: 5, category: 'FAQ' },
  { name: 'check-circle', tier: 5, category: 'Success' },
  { name: 'warning', tier: 5, category: 'Alerts' },
  { name: 'search', tier: 5, category: 'Research' },
  { name: 'bookmark', tier: 5, category: 'Resources' },
  { name: 'pin', tier: 5, category: 'Pinned' },

  // Tier 6: Specialized Interests
  { name: 'dollar-sign', tier: 6, category: 'Finance' },
  { name: 'utensils', tier: 6, category: 'Food' },
  { name: 'paw', tier: 6, category: 'Animals' },
  { name: 'leaf', tier: 6, category: 'Nature' },
  { name: 'seedling', tier: 6, category: 'Nature' },
  { name: 'headset', tier: 6, category: 'Gaming Communication' },
  { name: 'chart-line', tier: 6, category: 'Analytics' },

  // Tier 7: Communication & Status (Common)
  { name: 'globe', tier: 7, category: 'Network' },
  { name: 'plane', tier: 7, category: 'Travel' },
  { name: 'link', tier: 7, category: 'Links' },
  { name: 'lock', tier: 7, category: 'Privacy' },
  { name: 'eye', tier: 7, category: 'Visibility' },

  // Tier 8: Actions & Features (Moderate Priority)
  { name: 'target', tier: 8, category: 'Goals' },
  { name: 'certificate', tier: 8, category: 'Official' },

  // Tier 9: Creative & Special Purpose
  { name: 'palette', tier: 8, category: 'Art' },
  { name: 'flask', tier: 9, category: 'Experiments' },
  { name: 'robot', tier: 9, category: 'Sci-Fi' },
  { name: 'fire', tier: 9, category: 'Hot' },

];

// Icon colors in rainbow order: app-default, blue, purple, fuchsia, green, orange, yellow, red
export const ICON_COLORS: ColorOption[] = [
  { value: 'default', label: 'Default', class: 'text-subtle', hex: '#9ca3af' },
  { value: 'blue', label: 'Blue', class: 'text-accent-blue', hex: '#3b82f6' },
  { value: 'purple', label: 'Purple', class: 'text-accent-purple', hex: '#8b5cf6' },
  { value: 'fuchsia', label: 'Fuchsia', class: 'text-accent-fuchsia', hex: '#d946ef' },
  { value: 'green', label: 'Green', class: 'text-accent-green', hex: '#22c55e' },
  { value: 'orange', label: 'Orange', class: 'text-accent-orange', hex: '#f97316' },
  { value: 'yellow', label: 'Yellow', class: 'text-accent-yellow', hex: '#ca8a04' },
  { value: 'red', label: 'Red', class: 'text-accent-red', hex: '#ef4444' },
];

// Dimmed colors for folder backgrounds (25% less saturation, similar to UserInitials)
export const FOLDER_COLORS: ColorOption[] = [
  { value: 'default', label: 'Default', class: 'text-subtle', hex: '#6b7280' },
  { value: 'blue', label: 'Blue', class: 'text-accent-blue', hex: '#5f8eeb' },
  { value: 'purple', label: 'Purple', class: 'text-accent-purple', hex: '#9673ea' },
  { value: 'fuchsia', label: 'Fuchsia', class: 'text-accent-fuchsia', hex: '#c54cc7' },
  { value: 'green', label: 'Green', class: 'text-accent-green', hex: '#40b589' },
  { value: 'orange', label: 'Orange', class: 'text-accent-orange', hex: '#ec814a' },
  { value: 'yellow', label: 'Yellow', class: 'text-accent-yellow', hex: '#d4a017' },
  { value: 'red', label: 'Red', class: 'text-accent-red', hex: '#e7615d' },
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

// Theme-specific default gray for folders
const FOLDER_DEFAULT_LIGHT = '#9ca3af'; // lighter gray for light theme (subtle)
const FOLDER_DEFAULT_DARK = '#52525b';  // darker gray for dark theme (subtle)

// Helper function to get folder color hex value (dimmed palette)
// Pass isDarkTheme for theme-specific default gray
export const getFolderColorHex = (iconColor?: IconColor, isDarkTheme?: boolean): string => {
  if (!iconColor || iconColor === 'default') {
    return isDarkTheme ? FOLDER_DEFAULT_DARK : FOLDER_DEFAULT_LIGHT;
  }

  const colorOption = FOLDER_COLORS.find(color => color.value === iconColor);
  return colorOption?.hex ?? (isDarkTheme ? FOLDER_DEFAULT_DARK : FOLDER_DEFAULT_LIGHT);
};

// Helper function to get icon color class (for fallback)
export const getIconColorClass = (iconColor?: IconColor): string => {
  if (!iconColor || iconColor === 'default') return 'text-subtle';
  return `text-accent-${iconColor}`;
};