/**
 * Mock space generation for development and testing of the Discover Spaces UI.
 *
 * Activated via:
 *   - URL parameter: ?spaces=N (N spaces)
 *   - localStorage: debug_mock_spaces === 'true' (count from debug_mock_spaces_count or 30)
 *
 * Both gates require NODE_ENV === 'development'. Production builds tree-shake.
 */

import type { DirectoryEntry, Space, SpaceCategory } from '@quilibrium/quorum-shared';

const MOCK_SPACE_NAMES = [
  'Quilibrium Dev',
  'Cypherpunk Cafe',
  'Privacy Tools',
  'Mesh Network HQ',
  'Decentralized Coffee',
  'Indie Game Devs',
  'Pixel Art Pixels',
  'Speedrunners United',
  'Roguelike Builders',
  'Web3 Builders',
  'Rust Enthusiasts',
  'TypeScript Wizards',
  'Linux Tinkerers',
  'Self-Hosting Club',
  'Crypto Traders Hub',
  'DeFi Researchers',
  'NFT Curators',
  'Bitcoin Maximalists',
  'Book Club',
  'Movie Night',
  'Philosophy Sundays',
  'Daily Meditation',
  'Math Tutoring',
  'Language Exchange',
  'Open Source Weekly',
];

// Mix of lengths to stress-test the card layout — empty, single-line, two-line,
// and ~300-character (the ceiling enforced by SpaceSettingsModal / CreateSpaceModal).
const MOCK_SPACE_DESCRIPTIONS = [
  // empty
  '',
  // ~40 chars — single line
  'Daily group sits, all welcome.',
  // ~50 chars — single line
  'Math help and tutoring. Bring your problems.',
  // ~110 chars — roughly 2 lines on the squared card
  'A friendly book club. We meet weekly to discuss what we are reading. Currently on sci-fi classics.',
  // ~130 chars — roughly 2 lines
  'Discuss the latest in cryptography, privacy, and decentralized systems. New here? Lurk first, ask whenever.',
  // empty (second one to vary distribution)
  '',
  // ~220 chars — long, will be truncated with "More"
  'Un lieu pour les développeurs web3 et les passionnés de blockchain. Nous partageons des ressources, des projets en cours, et organisons des sessions de pair-programming chaque semaine. Bienvenue à tous les niveaux.',
  // ~300 chars — max length, will be truncated with "More" (Japanese)
  '自己ホスティングと分散型ネットワークについて話し合うコミュニティです。サーバーのセットアップ、バックアップ戦略、プライバシー保護のためのツールやサービスについて情報を交換しています。初心者から経験者まで、すべてのレベルの方を歓迎します。週に一度オンラインミーティングを開催しており、新しいメンバーは自由に参加できます。お気軽にどうぞ。',
  // ~45 chars — single line
  'Trade tips, charts, and analysis. Not advice.',
  // ~180 chars — long (Spanish)
  'Espacio para entusiastas de la criptografía y la privacidad. Compartimos artículos, herramientas, y experiencias sobre redes descentralizadas y autosoberanía digital.',
  // empty
  '',
  // ~95 chars — borderline 1-2 lines
  'A community for builders and tinkerers shipping interesting things together every week.',
];

const CATEGORY_CYCLE: SpaceCategory[] = [
  'tech',
  'crypto',
  'gaming',
  'community',
  'social',
  'education',
  'other',
];

function seededInt(seed: number, max: number): number {
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  return (((seed * a + c) % m) + m) % m % max;
}

export function generateMockSpaces(count: number): DirectoryEntry[] {
  const result: DirectoryEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const name = MOCK_SPACE_NAMES[i % MOCK_SPACE_NAMES.length];
    const description = MOCK_SPACE_DESCRIPTIONS[i % MOCK_SPACE_DESCRIPTIONS.length];
    const category = CATEGORY_CYCLE[i % CATEGORY_CYCLE.length];

    const memberCountSeed = seededInt(i + 7, 5000);
    const memberCount = memberCountSeed < 50 ? memberCountSeed + 5 : memberCountSeed;

    // Roughly two-thirds get a Dicebear "shapes" SVG seeded by name (colorful,
    // deterministic, no auth); the rest stay empty to exercise the initials fallback.
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const icon = i % 3 === 0
      ? ''
      : `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(slug)}`;

    result.push({
      space_address: `mock_space_${i.toString().padStart(4, '0')}`,
      name,
      description,
      icon,
      invite_link: `https://app.quorummessenger.com/invite/mock_${i}`,
      category,
      status: 'active',
      submitted_at: now - i * 24 * 60 * 60 * 1000,
      member_count: memberCount,
    });
  }

  return result;
}

export function isMockSpacesEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  if (typeof window === 'undefined') return false;
  return (
    localStorage?.getItem('debug_mock_spaces') === 'true' ||
    new URLSearchParams(window.location?.search || '').get('spaces') !== null
  );
}

export function getMockSpacesCount(): number {
  if (typeof window === 'undefined') return 30;
  const urlValue = new URLSearchParams(window.location?.search || '').get('spaces');
  const lsValue = localStorage?.getItem('debug_mock_spaces_count');
  const n = parseInt(urlValue || lsValue || '30', 10);
  return isNaN(n) || n <= 0 ? 30 : n;
}

/**
 * Mock joined-spaces generation for stress-testing the left-rail Spaces sidebar
 * ({@link ../../components/space/SpacesSidebar.tsx}).
 *
 * Shares the same gate as the Discover screen mock ({@link isMockSpacesEnabled}
 * / `?spaces=N` / `debug_mock_spaces`), so a single switch fills both surfaces.
 */
export function generateMockJoinedSpaces(count: number): Space[] {
  const result: Space[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const name = MOCK_SPACE_NAMES[i % MOCK_SPACE_NAMES.length];
    const description = MOCK_SPACE_DESCRIPTIONS[i % MOCK_SPACE_DESCRIPTIONS.length];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const iconUrl = i % 3 === 0
      ? ''
      : `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(slug)}`;

    result.push({
      spaceId: `mock_joined_space_${i.toString().padStart(4, '0')}`,
      spaceName: `${name} ${i + 1}`,
      description,
      vanityUrl: '',
      inviteUrl: '',
      iconUrl,
      bannerUrl: '',
      defaultChannelId: 'general',
      hubAddress: '',
      createdDate: now - i * 24 * 60 * 60 * 1000,
      modifiedDate: now - i * 24 * 60 * 60 * 1000,
      isRepudiable: false,
      isPublic: false,
      groups: [],
      roles: [],
      emojis: [],
      stickers: [],
    });
  }

  return result;
}
