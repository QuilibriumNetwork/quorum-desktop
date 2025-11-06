import { ReactNode } from 'react';

export type IconName =
  // Essential icons (currently used in primitives)
  | 'check'
  | 'check-circle'
  | 'check-square'
  | 'square'
  | 'close'
  | 'sun'
  | 'moon'
  | 'desktop'
  | 'search'
  | 'info-circle'

  // Navigation & UI
  | 'plus'
  | 'minus'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'bars'
  | 'compress-alt'
  | 'door-open'
  | 'sliders'

  // Actions & Communication
  | 'reply'
  | 'link'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'share'
  | 'download'
  | 'upload'
  | 'save'
  | 'clipboard'
  | 'envelope'
  | 'comment-dots'
  | 'send'
  | 'bullhorn'
  | 'dollar-sign'
  | 'question-circle'
  | 'leaf'
  | 'paw'
  | 'utensils'
  | 'video'
  | 'microphone'
  | 'gamepad'
  | 'headset'
  | 'sword'
  | 'support'

  // User & Social
  | 'user'
  | 'users'
  | 'user-plus'
  | 'user-x'
  | 'user-minus'
  | 'party'
  | 'gift'
  | 'hand-peace'
  | 'ban'
  | 'cake'
  | 'glass'
  | 'smile'
  | 'mood-happy'
  | 'heart'
  | 'star'
  | 'eye'
  | 'eye-off'

  // Settings & Security
  | 'settings'
  | 'shield'
  | 'shield-check'
  | 'lock'
  | 'unlock'
  | 'login'
  | 'logout'
  | 'palette'
  | 'bell'

  // Status & Alerts
  | 'warning'
  | 'error'
  | 'spinner'

  // Files & Media
  | 'image'
  | 'tools'
  | 'briefcase'
  | 'hashtag'
  | 'calendar-alt'
  | 'history'

  // Common additions for future use
  | 'home'
  | 'menu'
  | 'dots'
  | 'dots-vertical'
  | 'refresh'
  | 'external-link'
  | 'bookmark'
  | 'filter'
  | 'sort'
  | 'print'
  // Test screen icons for emoji replacements
  | 'mobile'
  | 'device'
  | 'tablet'
  | 'dot-circle'
  | 'circle'
  | 'radio'
  | 'target'
  | 'pencil'
  | 'memo'
  | 'pin'
  | 'pin-off'
  | 'badge'
  | 'id-badge'
  | 'certificate'
  // Dev navigation icons
  | 'book'
  | 'clipboard-list'
  | 'bug'
  | 'flask'
  | 'chart-line'
  // Code-related icons
  | 'code'
  | 'terminal'
  | 'file-code'
  // Text formatting icons
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'heading'
  | 'quote'
  // Nature & sci-fi icons
  | 'tree'
  | 'robot'
  | 'fire'
  | 'globe'
  | 'plane';

export type IconSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | number;

export type IconVariant = 'outline' | 'filled';

export interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: string;
  className?: string;
  style?: any;
  disabled?: boolean;
  children?: ReactNode;
  id?: string;
  onClick?: () => void;
  /**
   * Icon variant style
   * - 'outline': Stroke-based icon (default)
   * - 'filled': Solid filled icon
   * Note: Not all icons have filled variants. If a filled variant doesn't exist,
   * the component will fall back to the outline version and log a warning.
   */
  variant?: IconVariant;
}

export interface IconWebProps extends IconProps {
  // Web-specific props can be added here if needed
}

export interface IconNativeProps extends IconProps {
  // Native-specific props can be added here if needed
}
