/**
 * Mock space generation for development and testing of the Discover Spaces UI.
 *
 * Activated via:
 *   - URL parameter: ?spaces=N (N spaces)
 *   - localStorage: debug_mock_spaces === 'true' (count from debug_mock_spaces_count or 30)
 *
 * Both gates require NODE_ENV === 'development'. Production builds tree-shake.
 */

import type { DirectoryEntry, SpaceCategory } from '@quilibrium/quorum-shared';

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

const MOCK_SPACE_DESCRIPTIONS = [
  'A community for builders and tinkerers shipping things together.',
  'Discuss the latest in cryptography, privacy, and decentralized systems.',
  'Share your favorite indie games and find people to play with.',
  'Espacio para entusiastas de la criptografía y la privacidad.',
  'Un lieu pour les développeurs web3 et les passionnés de blockchain.',
  'Treffpunkt für selbst-gehostete Dienste und Open-Source-Software.',
  '自己ホスティングと分散型ネットワークについて話し合うコミュニティ',
  'A friendly book club. We meet weekly to discuss what we are reading.',
  'Math help and tutoring. Bring your problems, we will help solve them.',
  'Trade tips, charts, and analysis. Not financial advice.',
  'Build the web you want to live in. Open source, decentralized, free.',
  'Quiet meditation space. Daily group sits, all traditions welcome.',
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

    result.push({
      space_address: `mock_space_${i.toString().padStart(4, '0')}`,
      name,
      description,
      icon: '',
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
