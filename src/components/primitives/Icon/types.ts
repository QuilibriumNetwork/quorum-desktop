import { ReactNode } from 'react';

export type IconName =
  // Essential icons (currently used in primitives)
  | 'check'
  | 'check-circle'
  | 'check-square'
  | 'square'
  | 'times'
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
  | 'x'
  | 'compress-alt'
  | 'door-open'
  | 'sliders'

  // Actions & Communication
  | 'reply'
  | 'link'
  | 'trash'
  | 'edit'
  | 'delete'
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
  | 'money'
  | 'question-circle'
  | 'leaf'
  | 'nature'
  | 'paw'
  | 'animals'
  | 'utensils'
  | 'food'
  | 'video'
  | 'microphone'
  | 'mic'
  | 'audio'
  | 'gamepad'
  | 'games'
  | 'headset'
  | 'khanda'
  | 'sword'
  | 'life-ring'
  | 'support'
  | 'help'

  // User & Social
  | 'user'
  | 'users'
  | 'user-plus'
  | 'user-xmark'
  | 'user-kick'
  | 'user-join'
  | 'user-leave'
  | 'party'
  | 'gift'
  | 'hand-peace'
  | 'hand-wave'
  | 'ban'
  | 'cake-candles'
  | 'birthday-cake'
  | 'champagne-glasses'
  | 'celebration'
  | 'smile'
  | 'face-smile-beam'
  | 'heart'
  | 'star'
  | 'eye'
  | 'eye-slash'

  // Settings & Security
  | 'cog'
  | 'gear'
  | 'settings'
  | 'shield'
  | 'shield-alt'
  | 'lock'
  | 'unlock'
  | 'sign-in'
  | 'palette'
  | 'bell'

  // Status & Alerts
  | 'info'
  | 'warning'
  | 'warning-outline'
  | 'error'
  | 'success'
  | 'exclamation-triangle'
  | 'circle-info'
  | 'spinner'

  // Files & Media
  | 'image'
  | 'file-image'
  | 'tools'
  | 'briefcase'
  | 'hashtag'
  | 'calendar-alt'

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
  | 'download-alt'
  | 'upload-alt'
  // Test screen icons for emoji replacements
  | 'mobile'
  | 'device'
  | 'tablet'
  | 'dot-circle'
  | 'circle'
  | 'radio'
  | 'target'
  | 'bullseye'
  | 'pencil'
  | 'memo'
  | 'thumbtack'
  | 'thumbtack-slash'
  | 'pin'
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
  | 'file-code';

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
}

export interface IconWebProps extends IconProps {
  // Web-specific props (FontAwesome features)
  rotation?: number;
  flip?: 'horizontal' | 'vertical' | 'both';
  spin?: boolean;
  pulse?: boolean;
  fixedWidth?: boolean;
}

export interface IconNativeProps extends IconProps {
  // Native-specific props (react-native-vector-icons features)
  allowFontScaling?: boolean;
}
