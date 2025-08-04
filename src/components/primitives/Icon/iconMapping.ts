import {
  faCheck,
  faTimes,
  faXmark,
  faSun,
  faMoon,
  faDesktop,
  faSearch,
  faInfoCircle,
  faPlus,
  faMinus,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faArrowDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faChevronDown,
  faBars,
  faX,
  faCompressAlt,
  faDoorOpen,
  faSliders,
  faReply,
  faLink,
  faTrash,
  faEdit,
  faCopy,
  faShare,
  faDownload,
  faUpload,
  faClipboard,
  faEnvelope,
  faCommentDots,
  faUser,
  faUsers,
  faUserPlus,
  faSmile,
  faFaceSmileBeam,
  faHeart,
  faStar,
  faEye,
  faEyeSlash,
  faCog,
  faGear,
  faShield,
  faShieldAlt,
  faLock,
  faUnlock,
  faPalette,
  faBell,
  faInfo,
  faExclamationTriangle,
  faCircleInfo,
  faSpinner,
  faImage,
  faFileImage,
  faTools,
  faHashtag,
  faCalendarAlt,
  faHome,
  faEllipsisH,
  faEllipsisV,
  faSync,
  faExternalLinkAlt,
  faBookmark,
  faFilter,
  faSort,
  faPrint,
  faSave,
  faMobile,
  faTablet,
  faCircle,
  faBullseye,
  faPencil,
} from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { IconName } from './types';

// Map our semantic icon names to FontAwesome icons
export const fontAwesomeIconMap: Record<IconName, IconDefinition> = {
  // Essential icons
  check: faCheck,
  times: faTimes,
  close: faTimes, // alias for times
  sun: faSun,
  moon: faMoon,
  desktop: faDesktop,
  search: faSearch,
  'info-circle': faInfoCircle,

  // Navigation & UI
  plus: faPlus,
  minus: faMinus,
  'arrow-left': faArrowLeft,
  'arrow-right': faArrowRight,
  'arrow-up': faArrowUp,
  'arrow-down': faArrowDown,
  'chevron-left': faChevronLeft,
  'chevron-right': faChevronRight,
  'chevron-up': faChevronUp,
  'chevron-down': faChevronDown,
  bars: faBars,
  x: faX,
  'compress-alt': faCompressAlt,
  'door-open': faDoorOpen,
  sliders: faSliders,

  // Actions & Communication
  reply: faReply,
  link: faLink,
  trash: faTrash,
  edit: faEdit,
  delete: faTrash, // alias for trash
  copy: faCopy,
  share: faShare,
  download: faDownload,
  upload: faUpload,
  save: faSave,
  clipboard: faClipboard,
  envelope: faEnvelope,
  'comment-dots': faCommentDots,

  // User & Social
  user: faUser,
  users: faUsers,
  'user-plus': faUserPlus,
  smile: faSmile,
  'face-smile-beam': faFaceSmileBeam,
  heart: faHeart,
  star: faStar,
  eye: faEye,
  'eye-slash': faEyeSlash,

  // Settings & Security
  cog: faCog,
  gear: faGear,
  settings: faCog, // alias for cog
  shield: faShield,
  'shield-alt': faShieldAlt,
  lock: faLock,
  unlock: faUnlock,
  palette: faPalette,
  bell: faBell,

  // Status & Alerts
  info: faInfoCircle, // alias for info-circle
  warning: faExclamationTriangle,
  error: faExclamationTriangle, // alias for warning
  success: faCheck, // alias for check
  'exclamation-triangle': faExclamationTriangle,
  'circle-info': faCircleInfo,
  spinner: faSpinner,

  // Files & Media
  image: faImage,
  'file-image': faFileImage,
  tools: faTools,
  hashtag: faHashtag,
  'calendar-alt': faCalendarAlt,

  // Common additions
  home: faHome,
  menu: faBars, // alias for bars
  dots: faEllipsisH,
  'dots-vertical': faEllipsisV,
  refresh: faSync,
  'external-link': faExternalLinkAlt,
  bookmark: faBookmark,
  filter: faFilter,
  sort: faSort,
  print: faPrint,
  'download-alt': faDownload, // alias for download
  'upload-alt': faUpload, // alias for upload
  
  // Test screen icons for emoji replacements
  mobile: faMobile,
  device: faMobile, // alias for mobile
  tablet: faTablet,
  'dot-circle': faCircle,
  circle: faCircle, // alias for dot-circle
  radio: faCircle, // alias for dot-circle (radio button)
  target: faBullseye,
  bullseye: faBullseye,
  pencil: faPencil,
  memo: faPencil, // alias for pencil (memo/note)
};

// React Native vector icon names (using FontAwesome family from react-native-vector-icons)
export const reactNativeIconMap: Record<IconName, string> = {
  // Essential icons
  check: 'check',
  times: 'times',
  close: 'times',
  sun: 'sun-o',
  moon: 'moon-o',
  desktop: 'desktop',
  search: 'search',
  'info-circle': 'info-circle',

  // Navigation & UI
  plus: 'plus',
  minus: 'minus',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'arrow-up': 'arrow-up',
  'arrow-down': 'arrow-down',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  bars: 'bars',
  x: 'close',
  'compress-alt': 'compress',
  'door-open': 'sign-out',
  sliders: 'sliders',

  // Actions & Communication
  reply: 'reply',
  link: 'link',
  trash: 'trash',
  edit: 'edit',
  delete: 'trash',
  copy: 'copy',
  share: 'share',
  download: 'download',
  upload: 'upload',
  save: 'save',
  clipboard: 'clipboard',
  envelope: 'envelope',
  'comment-dots': 'comment',

  // User & Social
  user: 'user',
  users: 'users',
  'user-plus': 'user-plus',
  smile: 'smile-o',
  'face-smile-beam': 'smile-o',
  heart: 'heart',
  star: 'star',
  eye: 'eye',
  'eye-slash': 'eye-slash',

  // Settings & Security
  cog: 'cog',
  gear: 'cog',
  settings: 'cog',
  shield: 'shield',
  'shield-alt': 'shield',
  lock: 'lock',
  unlock: 'unlock',
  palette: 'palette',
  bell: 'bell',

  // Status & Alerts
  info: 'info-circle',
  warning: 'exclamation-triangle',
  error: 'exclamation-triangle',
  success: 'check',
  'exclamation-triangle': 'exclamation-triangle',
  'circle-info': 'info-circle',
  spinner: 'spinner',

  // Files & Media
  image: 'image',
  'file-image': 'file-image-o',
  tools: 'wrench',
  hashtag: 'hashtag',
  'calendar-alt': 'calendar',

  // Common additions
  home: 'home',
  menu: 'bars',
  dots: 'ellipsis-h',
  'dots-vertical': 'ellipsis-v',
  refresh: 'refresh',
  'external-link': 'external-link',
  bookmark: 'bookmark',
  filter: 'filter',
  sort: 'sort',
  print: 'print',
  'download-alt': 'download',
  'upload-alt': 'upload',
  
  // Test screen icons for emoji replacements
  mobile: 'mobile',
  device: 'mobile',
  tablet: 'tablet',
  'dot-circle': 'circle',
  circle: 'circle',
  radio: 'circle',
  target: 'bullseye',
  bullseye: 'bullseye',
  pencil: 'pencil',
  memo: 'pencil',
};

// Helper function to check if a string is a valid icon name
export function isValidIconName(name: string): name is IconName {
  return name in fontAwesomeIconMap;
}
