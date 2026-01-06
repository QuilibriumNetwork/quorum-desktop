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
  // Essential & Status
  check: 'IconCheck',
  'check-circle': 'IconCircleCheck',
  'check-square': 'IconSquareCheck',
  square: 'IconSquare',
  close: 'IconX',
  sun: 'IconSun',
  moon: 'IconMoon',
  search: 'IconSearch',
  'info-circle': 'IconInfoCircle',
  warning: 'IconAlertTriangle',
  error: 'IconAlertCircle',
  spinner: 'IconLoader',
  clock: 'IconClock',
  circle: 'IconCircle',
  radio: 'IconCircleDot',
  target: 'IconTarget',

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
  'compress-alt': 'IconArrowsMinimize',
  sliders: 'IconAdjustments',
  'sidebar-left-expand': 'IconLayoutSidebarLeftExpand',
  'sidebar-left-collapse': 'IconLayoutSidebarLeftCollapse',
  home: 'IconHome',
  menu: 'IconMenu2',
  dots: 'IconDots',
  'dots-vertical': 'IconDotsVertical',
  refresh: 'IconRefresh',
  'external-link': 'IconExternalLink',
  filter: 'IconFilter',
  sort: 'IconArrowsSort',

  // Actions
  reply: 'IconArrowBackUp',
  link: 'IconLink',
  trash: 'IconTrash',
  edit: 'IconEdit',
  pencil: 'IconPencil',
  copy: 'IconCopy',
  share: 'IconShare',
  download: 'IconDownload',
  upload: 'IconUpload',
  save: 'IconDeviceFloppy',
  clipboard: 'IconClipboard',
  print: 'IconPrinter',
  pin: 'IconPin',
  'pin-off': 'IconPinnedOff',

  // Communication & Social
  envelope: 'IconMail',
  send: 'IconSend',
  bullhorn: 'IconSpeakerphone',
  message: 'IconMessage',
  'message-dots': 'IconMessageDots',
  'comment-dots': 'IconMessageDots', // Legacy alias
  messages: 'IconMessages',
  user: 'IconUser',
  users: 'IconUsers',
  'user-plus': 'IconUserPlus',
  'user-x': 'IconUserX',
  'user-minus': 'IconUserMinus',
  party: 'IconConfetti',
  gift: 'IconGift',
  'hand-peace': 'IconHandStop',
  ban: 'IconBan',
  cake: 'IconCake',
  glass: 'IconGlassFull',
  smile: 'IconMoodSmile',
  'mood-happy': 'IconMoodHappy',
  heart: 'IconHeart',
  star: 'IconStar',
  'star-off': 'IconStarOff',
  eye: 'IconEye',
  'eye-off': 'IconEyeOff',
  support: 'IconLifebuoy',
  volume: 'IconVolume',
  'volume-off': 'IconVolumeOff',

  // Settings & Security
  settings: 'IconSettings',
  shield: 'IconShield',
  'shield-check': 'IconShieldCheck',
  lock: 'IconLock',
  unlock: 'IconLockOpen',
  login: 'IconLogin',
  logout: 'IconLogout2',
  palette: 'IconPalette',
  bell: 'IconBell',
  'bell-off': 'IconBellOff',
  'bell-x': 'IconBellX',

  // Files & Media
  image: 'IconPhoto',
  folder: 'IconFolder',
  'folder-minus': 'IconFolderMinus',
  bookmark: 'IconBookmark',
  'bookmark-off': 'IconBookmarkOff',
  paperclip: 'IconPaperclip',
  hashtag: 'IconHash',
  'calendar-alt': 'IconCalendar',
  history: 'IconHistory',
  memo: 'IconNote',

  // Devices & Hardware
  desktop: 'IconDeviceDesktop',
  mobile: 'IconDeviceMobile',
  device: 'IconDevices',
  tablet: 'IconDeviceTablet',
  video: 'IconVideo',
  microphone: 'IconMicrophone',
  gamepad: 'IconDeviceGamepad2',
  headset: 'IconHeadphones',

  // Development & Code
  code: 'IconCode',
  terminal: 'IconTerminal2',
  'file-code': 'IconFileCode',
  book: 'IconBook',
  'clipboard-list': 'IconClipboardList',
  bug: 'IconBug',
  flask: 'IconFlask',
  'chart-line': 'IconChartLine',
  badge: 'IconBadge',
  'id-badge': 'IconId',
  certificate: 'IconRosetteDiscountCheck',
  tools: 'IconTools',
  briefcase: 'IconBriefcase',

  // Text formatting
  bold: 'IconBold',
  italic: 'IconItalic',
  strikethrough: 'IconStrikethrough',
  heading: 'IconHeading',
  quote: 'IconQuote',

  // Miscellaneous
  'dollar-sign': 'IconCurrencyDollar',
  'question-circle': 'IconHelpCircle',
  leaf: 'IconLeaf',
  paw: 'IconPaw',
  utensils: 'IconToolsKitchen2',
  sword: 'IconSword',
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
