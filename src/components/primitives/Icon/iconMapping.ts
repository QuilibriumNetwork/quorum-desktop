import { IconName } from './types';

/**
 * Icon Mapping - Maps semantic icon names to icon library component names
 *
 * Implementation: Currently using Tabler Icons
 * - PascalCase with "Icon" prefix
 * - kebab-case SVG names become PascalCase (e.g., "arrow-left" → "IconArrowLeft")
 * - Most icons use the "outline" style by default
 *
 * Reference: https://tabler.io/icons
 */
export const iconComponentMap: Record<IconName, string> = {
  // Essential icons
  check: 'IconCheck',
  'check-circle': 'IconCircleCheck',
  'check-square': 'IconSquareCheck',
  square: 'IconSquare',
  close: 'IconX',
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
  bars: 'IconMenu2',
  'compress-alt': 'IconArrowsMinimize',
  'door-open': 'IconDoorExit',
  sliders: 'IconAdjustments',

  // Actions & Communication
  reply: 'IconArrowBackUp',
  link: 'IconLink',
  trash: 'IconTrash',
  edit: 'IconEdit',
  copy: 'IconCopy',
  share: 'IconShare',
  download: 'IconDownload',
  upload: 'IconUpload',
  save: 'IconDeviceFloppy',
  clipboard: 'IconClipboard',
  envelope: 'IconMail',
  'comment-dots': 'IconMessage',
  send: 'IconSend',
  bullhorn: 'IconSpeakerphone',
  'dollar-sign': 'IconCurrencyDollar',
  'question-circle': 'IconHelpCircle',
  leaf: 'IconLeaf',
  paw: 'IconPaw',
  utensils: 'IconToolsKitchen2',
  video: 'IconVideo',
  microphone: 'IconMicrophone',
  gamepad: 'IconDeviceGamepad2',
  headset: 'IconHeadphones',
  sword: 'IconSword',
  support: 'IconLifebuoy',

  // User & Social
  user: 'IconUser',
  users: 'IconUsers',
  'user-plus': 'IconUserPlus',
  'user-x': 'IconUserX',
  'user-minus': 'IconUserMinus',
  party: 'IconConfetti',
  gift: 'IconGift',
  'hand-peace': 'IconHandStop',
  ban: 'IconBan',
  'cake': 'IconCake',
  'glass': 'IconGlassFull',
  smile: 'IconMoodSmile',
  'mood-happy': 'IconMoodHappy',
  heart: 'IconHeart',
  star: 'IconStar',
  eye: 'IconEye',
  'eye-off': 'IconEyeOff',

  // Settings & Security
  settings: 'IconSettings',
  shield: 'IconShield',
  'shield-check': 'IconShieldCheck',
  lock: 'IconLock',
  unlock: 'IconLockOpen',
  login: 'IconLogin',
  logout: 'IconLogout',
  palette: 'IconPalette',
  bell: 'IconBell',

  // Status & Alerts
  warning: 'IconAlertTriangle',
  error: 'IconAlertCircle',
  spinner: 'IconLoader',

  // Files & Media
  image: 'IconPhoto',
  tools: 'IconTools',
  briefcase: 'IconBriefcase',
  hashtag: 'IconHash',
  'calendar-alt': 'IconCalendar',
  history: 'IconHistory',
  paperclip: 'IconPaperclip',
  folder: 'IconFolder',
  'folder-minus': 'IconFolderMinus',

  // Common additions
  home: 'IconHome',
  menu: 'IconMenu2',
  dots: 'IconDots',
  'dots-vertical': 'IconDotsVertical',
  refresh: 'IconRefresh',
  'external-link': 'IconExternalLink',
  bookmark: 'IconBookmark',
  'bookmark-off': 'IconBookmarkOff',
  filter: 'IconFilter',
  sort: 'IconArrowsSort',
  print: 'IconPrinter',

  // Test screen icons for emoji replacements
  mobile: 'IconDeviceMobile',
  device: 'IconDevices',
  tablet: 'IconDeviceTablet',
  'dot-circle': 'IconCircleDot',
  circle: 'IconCircle',
  radio: 'IconCircleDot',
  target: 'IconTarget',
  pencil: 'IconPencil',
  memo: 'IconNote',

  // Pin-related icons
  pin: 'IconPin',
  'pin-off': 'IconPinnedOff',

  // Dev navigation icons
  book: 'IconBook',
  'clipboard-list': 'IconClipboardList',
  bug: 'IconBug',
  flask: 'IconFlask',
  'chart-line': 'IconChartLine',
  badge: 'IconBadge',
  'id-badge': 'IconId',
  certificate: 'IconRosetteDiscountCheck',

  // Code-related icons
  code: 'IconCode',
  terminal: 'IconTerminal2',
  'file-code': 'IconFileCode',

  // Text formatting icons
  bold: 'IconBold',
  italic: 'IconItalic',
  strikethrough: 'IconStrikethrough',
  heading: 'IconHeading',
  quote: 'IconQuote',

  // Nature & sci-fi icons
  tree: 'IconPlant2',
  seedling: 'IconSeedling',
  robot: 'IconRobot',
  ai: 'IconAi',
  fire: 'IconFlame',
  globe: 'IconWorld',
  plane: 'IconPlane',
};

/**
 * Helper function to check if a string is a valid icon name
 */
export function isValidIconName(name: string): name is IconName {
  return name in iconComponentMap;
}

/**
 * Get the icon component name for a semantic icon name
 * Returns null if the icon name is not found
 */
export function getIconComponentName(name: string): string | null {
  if (isValidIconName(name)) {
    return iconComponentMap[name];
  }
  return null;
}
