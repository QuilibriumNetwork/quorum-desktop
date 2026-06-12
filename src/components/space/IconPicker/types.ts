import type { IconName, IconVariant } from '../../primitives';

// Icon-picker vocabulary now lives in @quilibrium/quorum-shared (single source of
// truth shared with mobile). Re-exported here so existing imports from './types'
// and from the IconPicker barrel keep working unchanged.
export {
  ICON_OPTIONS,
  ICON_COLORS,
  FOLDER_COLORS,
  FILLED_ICONS,
  getIconColorHex,
  getFolderColorHex,
  getIconColorClass,
} from '@quilibrium/quorum-shared';
export type { IconColor, IconOption, ColorOption } from '@quilibrium/quorum-shared';

// Local re-import of IconColor for the props interface below.
import type { IconColor } from '@quilibrium/quorum-shared';

// Component props stay local — only the vocabulary/helpers moved to shared.
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
