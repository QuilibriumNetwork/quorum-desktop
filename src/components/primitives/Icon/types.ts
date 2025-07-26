import { ReactNode } from 'react';

export type IconName = 
  // Essential icons (currently used in primitives)
  | 'check'
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
  | 'clipboard'
  | 'envelope'
  | 'comment-dots'
  
  // User & Social
  | 'user'
  | 'users'
  | 'user-plus'
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
  | 'palette'
  | 'bell'
  
  // Status & Alerts
  | 'info'
  | 'warning'
  | 'error'
  | 'success'
  | 'exclamation-triangle'
  | 'circle-info'
  | 'spinner'
  
  // Files & Media
  | 'image'
  | 'file-image'
  | 'tools'
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
  | 'upload-alt';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: string;
  className?: string;
  style?: any;
  disabled?: boolean;
  children?: ReactNode;
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