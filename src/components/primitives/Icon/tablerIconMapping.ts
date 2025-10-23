import { IconName } from './types';

/**
 * Maps semantic icon names to Tabler Icons component names
 *
 * Tabler Icons naming convention:
 * - PascalCase with "Icon" prefix
 * - kebab-case SVG names become PascalCase (e.g., "arrow-left" → "IconArrowLeft")
 * - Most icons use the "outline" style by default
 *
 * Reference: https://tabler.io/icons
 */
export const tablerIconNames: Record<IconName, string> = {
  // Essential icons
  check: 'IconCheck',
  'check-circle': 'IconCircleCheck',
  'check-square': 'IconSquareCheck',
  square: 'IconSquare',
  times: 'IconX',
  close: 'IconX', // alias
  sun: 'IconSun',
  moon: 'IconMoon',
  desktop: 'IconDeviceDesktop',
  search: 'IconSearch',
  'info-circle': 'IconInfoCircle',

  // Navigation & UI
  plus: 'IconPlus',
  minus: 'IconMinus',
  'arrow-left': 'IconArrowLeft',
  'arrow-right': 'IconArrowRight',
  'arrow-up': 'IconArrowUp',
  'arrow-down': 'IconArrowDown',
  'chevron-left': 'IconChevronLeft',
  'chevron-right': 'IconChevronRight',
  'chevron-up': 'IconChevronUp',
  'chevron-down': 'IconChevronDown',
  bars: 'IconMenu2', // Menu with hamburger icon
  x: 'IconX',
  'compress-alt': 'IconArrowsMinimize', // Closest match
  'door-open': 'IconDoorExit', // Closest match
  sliders: 'IconAdjustments', // Slider controls

  // Actions & Communication
  reply: 'IconArrowBackUp', // Reply arrow
  link: 'IconLink',
  trash: 'IconTrash',
  edit: 'IconEdit',
  delete: 'IconTrash', // alias
  copy: 'IconCopy',
  share: 'IconShare',
  download: 'IconDownload',
  upload: 'IconUpload',
  save: 'IconDeviceFloppy', // Save/floppy disk icon
  clipboard: 'IconClipboard',
  envelope: 'IconMail',
  'comment-dots': 'IconMessage', // Message/comment bubble
  send: 'IconSend',
  bullhorn: 'IconSpeakerphone', // Announcement/megaphone
  'dollar-sign': 'IconCurrencyDollar',
  money: 'IconCurrencyDollar', // alias
  'question-circle': 'IconHelpCircle',
  leaf: 'IconLeaf',
  nature: 'IconLeaf', // alias
  paw: 'IconPaw',
  animals: 'IconPaw', // alias
  utensils: 'IconToolsKitchen2', // Cooking/food utensils
  food: 'IconToolsKitchen2', // alias
  video: 'IconVideo',
  microphone: 'IconMicrophone',
  mic: 'IconMicrophone', // alias
  audio: 'IconMicrophone', // alias
  gamepad: 'IconDeviceGamepad',
  games: 'IconDeviceGamepad', // alias
  headset: 'IconHeadphones',
  khanda: 'IconSword', // Weapon/sword (closest match for Sikh symbol)
  sword: 'IconSword', // alias
  'life-ring': 'IconLifebuoy',
  support: 'IconLifebuoy', // alias
  help: 'IconHelpCircle', // alias

  // User & Social
  user: 'IconUser',
  users: 'IconUsers',
  'user-plus': 'IconUserPlus',
  'user-xmark': 'IconUserX', // User with X
  'user-kick': 'IconUserMinus', // Remove user
  'user-join': 'IconUserPlus', // alias for user-plus
  'user-leave': 'IconUserMinus', // alias for user-minus
  party: 'IconConfetti', // Party/celebration
  gift: 'IconGift',
  'hand-peace': 'IconHandStop', // Hand gesture (closest match)
  'hand-wave': 'IconHandStop', // alias (using same icon)
  ban: 'IconBan',
  'cake-candles': 'IconCake', // Birthday cake
  'birthday-cake': 'IconCake', // alias
  'champagne-glasses': 'IconGlassFull', // Drinking glass (closest match)
  celebration: 'IconConfetti', // alias
  smile: 'IconMoodSmile',
  'face-smile-beam': 'IconMoodHappy',
  heart: 'IconHeart',
  star: 'IconStar',
  eye: 'IconEye',
  'eye-slash': 'IconEyeOff',

  // Settings & Security
  cog: 'IconSettings',
  gear: 'IconSettings', // alias
  settings: 'IconSettings', // alias
  shield: 'IconShield',
  'shield-alt': 'IconShieldCheck', // Shield with checkmark
  lock: 'IconLock',
  unlock: 'IconLockOpen',
  'sign-in': 'IconLogin',
  palette: 'IconPalette',
  bell: 'IconBell',

  // Status & Alerts
  info: 'IconInfoCircle', // alias
  warning: 'IconAlertTriangle',
  'warning-outline': 'IconAlertTriangle', // alias
  error: 'IconAlertCircle', // Error alert
  success: 'IconCircleCheck', // alias
  'exclamation-triangle': 'IconAlertTriangle', // alias
  'circle-info': 'IconInfoCircle', // alias
  spinner: 'IconLoader', // Loading spinner (should be animated)

  // Files & Media
  image: 'IconPhoto',
  'file-image': 'IconFileTypePng', // Image file
  tools: 'IconTools',
  briefcase: 'IconBriefcase',
  hashtag: 'IconHash',
  'calendar-alt': 'IconCalendar',

  // Common additions
  home: 'IconHome',
  menu: 'IconMenu2', // alias for bars
  dots: 'IconDots', // Horizontal dots
  'dots-vertical': 'IconDotsVertical',
  refresh: 'IconRefresh',
  'external-link': 'IconExternalLink',
  bookmark: 'IconBookmark',
  filter: 'IconFilter',
  sort: 'IconArrowsSort', // Sort arrows
  print: 'IconPrinter',
  'download-alt': 'IconDownload', // alias
  'upload-alt': 'IconUpload', // alias

  // Test screen icons for emoji replacements
  mobile: 'IconDeviceMobile',
  device: 'IconDevices', // Multiple devices
  tablet: 'IconDeviceTablet',
  'dot-circle': 'IconCircleDot', // Circle with dot
  circle: 'IconCircle',
  radio: 'IconCircleDot', // alias (radio button)
  target: 'IconTarget',
  bullseye: 'IconTarget', // alias
  pencil: 'IconPencil',
  memo: 'IconNote', // Note/memo

  // Pin-related icons
  thumbtack: 'IconPin',
  pin: 'IconPin', // alias
  'thumbtack-slash': 'IconPinOff', // Unpinned

  // Dev navigation icons
  book: 'IconBook',
  'clipboard-list': 'IconClipboardList',
  bug: 'IconBug',
  flask: 'IconFlask',
  'chart-line': 'IconChartLine',
  badge: 'IconBadge',
  'id-badge': 'IconId',
  certificate: 'IconCertificate',

  // Code-related icons
  code: 'IconCode',
  terminal: 'IconTerminal2',
  'file-code': 'IconFileCode',

  // Nature & sci-fi icons
  tree: 'IconTree',
  robot: 'IconRobot',
  fire: 'IconFlame',
  globe: 'IconWorld',
  plane: 'IconPlane',
};

/**
 * Helper function to check if a string is a valid icon name
 */
export function isValidIconName(name: string): name is IconName {
  return name in tablerIconNames;
}

/**
 * Get the Tabler icon component name for a semantic icon name
 * Returns null if the icon name is not found
 */
export function getTablerIconName(name: string): string | null {
  if (isValidIconName(name)) {
    return tablerIconNames[name];
  }
  return null;
}
