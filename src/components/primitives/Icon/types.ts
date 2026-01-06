import { ReactNode } from 'react';

export type IconName =
  // Essential & Status
  | 'check'
  | 'check-circle'
  | 'check-square'
  | 'square'
  | 'close'
  | 'sun'
  | 'moon'
  | 'search'
  | 'info-circle'
  | 'warning'
  | 'error'
  | 'spinner'
  | 'clock'
  | 'circle'
  | 'radio'
  | 'target'

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
  | 'compress-alt'
  | 'sliders'
  | 'sidebar-left-expand'
  | 'sidebar-left-collapse'
  | 'home'
  | 'menu'
  | 'dots'
  | 'dots-vertical'
  | 'refresh'
  | 'external-link'
  | 'filter'
  | 'sort'

  // Actions
  | 'reply'
  | 'link'
  | 'trash'
  | 'edit'
  | 'pencil'
  | 'copy'
  | 'share'
  | 'download'
  | 'upload'
  | 'save'
  | 'clipboard'
  | 'print'
  | 'pin'
  | 'pin-off'

  // Communication & Social
  | 'envelope'
  | 'send'
  | 'bullhorn'
  | 'message'
  | 'message-dots'
  | 'comment-dots' // Legacy alias (FontAwesome name)
  | 'messages'
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
  | 'star-off'
  | 'eye'
  | 'eye-off'
  | 'support'
  | 'volume'
  | 'volume-off'

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
  | 'bell-off'
  | 'bell-x'

  // Files & Media
  | 'image'
  | 'folder'
  | 'folder-minus'
  | 'bookmark'
  | 'bookmark-off'
  | 'paperclip'
  | 'hashtag'
  | 'calendar-alt'
  | 'history'
  | 'memo'

  // Devices & Hardware
  | 'desktop'
  | 'mobile'
  | 'device'
  | 'tablet'
  | 'video'
  | 'microphone'
  | 'gamepad'
  | 'headset'

  // Development & Code
  | 'code'
  | 'terminal'
  | 'file-code'
  | 'book'
  | 'clipboard-list'
  | 'bug'
  | 'flask'
  | 'chart-line'
  | 'badge'
  | 'id-badge'
  | 'certificate'
  | 'tools'
  | 'briefcase'

  // Text formatting
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'heading'
  | 'quote'

  // Miscellaneous
  | 'dollar-sign'
  | 'question-circle'
  | 'leaf'
  | 'paw'
  | 'utensils'
  | 'sword'
  | 'tree'
  | 'seedling'
  | 'robot'
  | 'ai'
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
