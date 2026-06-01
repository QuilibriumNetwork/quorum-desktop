# Unified `/spaces` Page (PR 1 of 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `/spaces` top-level route on `quorum-desktop` with two browsing tabs (My Spaces + Discover), a navbar entry point, mock data for dev testing, and a "Hide muted Spaces from sidebar" toggle that filters the navbar.

**Architecture:** Add new wire-shape types (`DirectoryEntry`, `DirectoryResponse`, `SpaceCategory`) and a new `UserConfig.hideMutedSpacesFromSidebar` field to `@quilibrium/quorum-shared` as an additive PR. Add a new method to desktop's `QuorumApiClient` for the `/directory` endpoint. Add a new React Query hook (`useExploreSpaces`) that supports a dev-only mock mode. Build a page component with a 2-tab shell (My Spaces + Discover), each tab using the same search-input + Select-filter chrome but with different card layouts (3-col compact vs 2-col side-by-side with descriptions). Wire the navbar `icon-layout-grid-add` entry point and filter the navbar space list by `!isSpaceMuted(spaceId)` when the new UserConfig field is true.

**Tech Stack:** React 18, TypeScript, react-router v6, TanStack React Query v5, `@lingui/core` for i18n, SCSS with `_variables.scss` tokens, existing primitives from `@quilibrium/quorum-shared`, Vitest for tests.

---

## Reference Findings (from 2026-06-01 pre-flight investigation)

These are the verified facts the plan is built on. **Do not re-investigate during execution — these have been confirmed.**

### Shared `UserConfig` location
- File: `quorum-shared/src/types/user.ts`
- The `UserConfig` type is defined at line 37
- The `showMutedChannels?: boolean` field at line 87 is the precedent pattern for `hideMutedSpacesFromSidebar?: boolean` (both are device-synced UI prefs)

### Desktop `UserConfig` mirror
- File: `quorum-desktop/src/db/messages.ts`
- The local mirror is defined at line 50
- Comment at line 48-49: "Any field added here MUST also be added to the shared type, or it won't sync to other devices."
- The mirror's `showMutedChannels?: boolean` is at line 89

### Shared types barrel
- File: `quorum-shared/src/types/index.ts`
- Pattern: named exports per type. User types block at lines 60-70.
- Top-level barrel: `quorum-shared/src/index.ts` uses `export * from './types'`

### `UserConfig` write pattern (5-step dance, from `useChannelMute.ts:264-264`)
1. Read current config: `await messageDB.getUserConfig({ address: userAddress })`
2. Build updated config object (shallow merge)
3. Optimistic write to React Query: `queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig)`
4. Enqueue persistent save: `await actionQueueService.enqueue('save-user-config', { config: updatedConfig }, \`config:${userAddress}\`)`
5. Invalidate dependent queries (skip if not applicable)

### Hooks needed
- `useConfig({ userAddress })` from `src/hooks/queries/config/useConfig.ts` — returns `{ data: UserConfig | undefined }`
- `buildConfigKey({ userAddress })` from `src/hooks/queries/config/buildConfigKey.ts` — returns `['Config', userAddress]`
- `useSpaces({})` from `src/hooks/queries/spaces/useSpaces.ts` — `useSuspenseQuery`, returns `{ data: Space[] }`
- `useMessageDB()` from `src/components/context/useMessageDB.ts` — returns `{ messageDB, actionQueueService, keyset }`
- `usePasskeysContext()` from `@quilibrium/quilibrium-js-sdk-channels` — returns `{ currentPasskeyInfo: { address } }`
- `useChannelMute({ spaceId })` from `src/hooks/business/channels/useChannelMute.ts` — returns `isSpaceMuted` derived value AND `muteSpace`/`unmuteSpace`/`toggleSpaceMute`
- `useSpaceOwner({ spaceId })` from `src/hooks/queries/spaceOwner` — for owner badge (verify exact export path during Task 19)
- `useSpaceMembers({ spaceId })` from `src/hooks/queries/spaceMembers/useSpaceMembers.ts` — returns `{ data: SpaceMember[] }`, use `.length` for member count
- `useNavItems(spaces, config)` from `src/hooks/business/folders/useNavItems.ts` — returns `{ navItems, allSpaces }`. **Key insight:** the navbar filter is implemented by filtering `spaces` BEFORE passing to `useNavItems` — empty-folder cascade is already handled at `useNavItems.ts:69`.
- `useFolderManagement` exists but for editing; we need the raw folder list from `config.items?.filter(item => item.type === 'folder')` for the dropdown

### Primitives confirmed
Available from `src/components/primitives`: `Modal`, `Input`, `Switch`, `Select`, `Button`, `Icon`, `Text`, `Tooltip`, `Callout`, `Flex`, `Spacer`. **No `Tabs` primitive exists** — render tabs inline as two styled buttons toggling local state.

### API client pattern
- File: `src/api/baseTypes.ts` lines 344-460
- Class: `QuorumApiClient extends AbstractQuorumApiClient`
- Method shape: `async getX(...args, { headers, timeout } = {}): return this.get<ResponseType>(getXUrl(...), { headers, timeout })`
- URL builders: `src/api/quorumApi.ts` — pattern `export const getXUrl: (args) => \`/${string}\` = (args) => \`/path/${args}\``

### Mock-data pattern (from `DirectMessageContactsList.tsx:25-86`)
- Module-level constant gates: `const ENABLE_MOCK_X = process.env.NODE_ENV === 'development' && (localStorage.getItem('debug_mock_x') === 'true' || URL has param)`
- Lazy dynamic import via `React.useEffect(() => { if (ENABLE_MOCK_X) import('../../utils/mock').then(setMockUtils) }, [])`
- Generators export: `generateMockX(count)`, `isMockXEnabled()`, `getMockXCount()` — see `src/utils/mock/mockConversations.ts` for the template

### Router setup
- File: `src/components/Router/Router.web.tsx`
- Pattern: `<Route path="/spaces" element={<ModalProvider user={...} setUser={...}><MobileProvider><SidebarProvider><Layout><SpacesPage /></Layout></SidebarProvider></MobileProvider></ModalProvider>} />`
- **Existing route `/spaces/:spaceId/:channelId` is more specific and won't conflict** (react-router v6 picks the more specific match)
- Place the new route ABOVE `/spaces/:spaceId/:channelId` for clarity (line order doesn't matter for matching but matters for readability)

### Navbar render structure (`NavMenu.tsx`)
- Line 486-570: existing `<div className="nav-menu-logo">` renders the DM icon at top — this is the pattern to mirror for the new `icon-layout-grid-add` button
- Line 393: `const { navItems, allSpaces } = useNavItems(spaces, config)` — the integration point for the mute filter (filter `spaces` BEFORE passing in)
- Line 571: `<nav className="nav-menu-spaces grow">` renders the space list (sortable context inside)

### Modal/Layout integration
- File: `src/components/Layout.tsx`
- `useModalManagement()` provides `showAddSpaceModal`/`hideAddSpaceModal`/`addSpaceVisible`/`createSpaceVisible`/etc.
- Existing modals stay rendered in `Layout.tsx` (lines 130-146); PR 1 does NOT touch this.

### Lingui i18n pattern
- All user-facing strings: `t\`...\`` from `@lingui/core/macro` (already imported widely)
- For multi-element JSX: `<Trans>...</Trans>` from `@lingui/react/macro`
- After adding new strings: run `yarn lingui:extract` (or whatever the project's extract command is — verify in `package.json` if unfamiliar)

---

## Pre-flight (run once before starting Task 1)

```bash
git -C "D:/GitHub/Quilibrium/quorum-desktop" pull --ff-only
git -C "D:/GitHub/Quilibrium/quorum-mobile" pull --ff-only
git -C "D:/GitHub/Quilibrium/quorum-shared" pull --ff-only
git -C "D:/GitHub/Quilibrium/quorum-desktop" checkout -b feat/port-discover-spaces
```

Expected: all three pulls report "Already up to date." or fast-forward. New branch `feat/port-discover-spaces` created from current main.

---

## Task 1: Add `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` types to shared

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-shared/src/types/directory.ts`
- Modify: `D:/GitHub/Quilibrium/quorum-shared/src/types/index.ts`

- [ ] **Step 1: Create `directory.ts` with the three types**

Create `D:/GitHub/Quilibrium/quorum-shared/src/types/directory.ts` with this exact content:

```typescript
/**
 * Public space directory types.
 *
 * Wire shapes returned by GET /directory. Used by both desktop and mobile
 * to render the "Discover Spaces" surface — a curated/server-side list of
 * public spaces a user can browse and join without a private invite link.
 */

export type SpaceCategory =
  | 'community'
  | 'gaming'
  | 'tech'
  | 'crypto'
  | 'social'
  | 'education'
  | 'other';

export interface DirectoryEntry {
  space_address: string;
  name: string;
  description: string;
  icon: string;
  invite_link: string;
  category: string;
  status: string;
  submitted_at: number;
  reviewed_at?: number;
  member_count?: number;
}

export interface DirectoryResponse {
  entries: DirectoryEntry[];
  total: number;
  has_more: boolean;
}
```

- [ ] **Step 2: Add barrel export to `types/index.ts`**

Open `D:/GitHub/Quilibrium/quorum-shared/src/types/index.ts`. After the existing typing-types export block (last block in the file), append:

```typescript
// Directory types (public space discovery)
export type {
  SpaceCategory,
  DirectoryEntry,
  DirectoryResponse,
} from './directory';
```

- [ ] **Step 3: Build shared and verify exports**

```bash
cd "D:/GitHub/Quilibrium/quorum-shared"
yarn build
```

Expected: build succeeds. Then verify the new types are emitted:

```bash
grep -l "DirectoryEntry\|SpaceCategory" dist/types/*.d.ts
```

Expected: at least one file (likely `dist/types/directory.d.ts` or `dist/index.d.ts`) matches.

- [ ] **Step 4: Commit the directory types**

```bash
cd "D:/GitHub/Quilibrium/quorum-shared"
git add src/types/directory.ts src/types/index.ts
git commit -m "feat(types): add DirectoryEntry, DirectoryResponse, SpaceCategory"
```

---

## Task 2: Add `hideMutedSpacesFromSidebar` field to shared `UserConfig`

**Files:**
- Modify: `D:/GitHub/Quilibrium/quorum-shared/src/types/user.ts:87`

- [ ] **Step 1: Add the optional field**

Open `D:/GitHub/Quilibrium/quorum-shared/src/types/user.ts`. Find the `UserConfig` type at line 37. After line 87 (`showMutedChannels?: boolean;`), insert this line:

```typescript
  /** When true, the navbar hides spaces where notificationSettings[spaceId].isMuted === true. Default false (show all spaces). */
  hideMutedSpacesFromSidebar?: boolean;
```

So lines 85-89 should now read:

```typescript
  mutedChannels?: {
    [spaceId: string]: string[];
  };
  showMutedChannels?: boolean;
  /** When true, the navbar hides spaces where notificationSettings[spaceId].isMuted === true. Default false (show all spaces). */
  hideMutedSpacesFromSidebar?: boolean;
```

- [ ] **Step 2: Build shared and verify**

```bash
cd "D:/GitHub/Quilibrium/quorum-shared"
yarn build
```

Expected: build succeeds.

```bash
grep "hideMutedSpacesFromSidebar" dist/types/user.d.ts
```

Expected: one match showing the field in the emitted declaration.

- [ ] **Step 3: Commit the UserConfig extension**

```bash
cd "D:/GitHub/Quilibrium/quorum-shared"
git add src/types/user.ts
git commit -m "feat(types): add UserConfig.hideMutedSpacesFromSidebar"
```

---

## Task 3: Bump shared version + open shared PR + self-merge

**Files:**
- Modify: `D:/GitHub/Quilibrium/quorum-shared/package.json` (version field)

- [ ] **Step 1: Identify current version**

```bash
cd "D:/GitHub/Quilibrium/quorum-shared"
grep '"version"' package.json
```

Expected: a line like `"version": "2.1.0-21",`

- [ ] **Step 2: Bump version to next `2.1.0-NN`**

In `D:/GitHub/Quilibrium/quorum-shared/package.json`, replace the version string. If current is `2.1.0-21`, change to `2.1.0-22`. (Generally: increment the trailing number by 1.)

- [ ] **Step 3: Commit version bump**

```bash
cd "D:/GitHub/Quilibrium/quorum-shared"
git add package.json
git commit -m "chore: bump to 2.1.0-22"
```

- [ ] **Step 4: Push + open PR**

```bash
cd "D:/GitHub/Quilibrium/quorum-shared"
git push -u origin HEAD:feat/directory-types-and-user-config
gh pr create --title "feat(types): DirectoryEntry + UserConfig.hideMutedSpacesFromSidebar" --body "$(cat <<'EOF'
## What
Add additive type exports for the upcoming desktop unified `/spaces` page:

- `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` — wire shapes for the `/directory` server endpoint
- `UserConfig.hideMutedSpacesFromSidebar?: boolean` — new optional UI preference field, mirrors the existing `showMutedChannels?: boolean` pattern at line 87

## Cross-repo migration
- **quorum-shared**: THIS PR (version 2.1.0-22)
- **quorum-desktop**: open Org/Repo#TBD (consumes the new types)
- **quorum-mobile**: task drop logged — mobile's local `DirectoryEntry`/`DirectoryResponse` in `services/api/quorumClient.ts:67-84` can swap to shared types whenever the lead picks it up. Mobile keeps working unchanged on the old version.

## Why
Desktop is shipping a public space directory ("Discover Spaces"). The wire types are identical to mobile's local definitions, so they belong in shared. Additive: zero breaking change to mobile.

## Why this is safe to merge whenever
Purely additive exports + a new optional field. No consumers in shared or mobile change behavior. Desktop will consume on its own schedule.

## Verification
- [x] `yarn build` succeeds
- [x] New types present in `dist/types/`
EOF
)"
```

- [ ] **Step 5: Self-merge the shared PR**

```bash
gh pr merge --squash --delete-branch
```

Expected: PR merged. Then sync local main:

```bash
git checkout master && git pull
```

---

## Task 4: Verify desktop picks up new shared exports via link

**Files:**
- None modified; verification only.

- [ ] **Step 1: Confirm `link:` symlink is working**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
node -e "console.log(require('@quilibrium/quorum-shared/package.json').version)"
```

Expected: prints `2.1.0-22` (the new version from Task 3).

- [ ] **Step 2: Confirm new types are importable**

Create temporary test file `D:/GitHub/Quilibrium/quorum-desktop/test-shared-types.ts`:

```typescript
import type { DirectoryEntry, DirectoryResponse, SpaceCategory, UserConfig } from '@quilibrium/quorum-shared';

const entry: DirectoryEntry = {
  space_address: 'test',
  name: 'test',
  description: 'test',
  icon: '',
  invite_link: '',
  category: 'tech',
  status: 'active',
  submitted_at: 0,
};

const cat: SpaceCategory = 'gaming';
const config: UserConfig = { address: '', spaceIds: [], hideMutedSpacesFromSidebar: true };

console.log(entry, cat, config);
```

Run typecheck:

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck test-shared-types.ts
```

Expected: no errors.

- [ ] **Step 3: Clean up test file**

```bash
rm test-shared-types.ts
```

---

## Task 5: Mirror `hideMutedSpacesFromSidebar` on desktop's local `UserConfig`

**Files:**
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/db/messages.ts:89`

- [ ] **Step 1: Add the mirror field**

Open `D:/GitHub/Quilibrium/quorum-desktop/src/db/messages.ts`. Find the local `UserConfig` type at line 50. After line 89 (`showMutedChannels?: boolean;`), insert:

```typescript
  // When true, the navbar hides spaces where notificationSettings[spaceId].isMuted === true.
  // Default false (show all spaces). Synced via UserConfig.
  hideMutedSpacesFromSidebar?: boolean;
```

- [ ] **Step 2: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 3: Commit the mirror**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
git add src/db/messages.ts
git commit -m "feat(db): mirror UserConfig.hideMutedSpacesFromSidebar"
```

---

## Task 6: Add `getDirectoryUrl` URL builder + `DirectoryEntry` query param type

**Files:**
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/api/quorumApi.ts`

- [ ] **Step 1: Add the URL builder + query param interface**

Open `D:/GitHub/Quilibrium/quorum-desktop/src/api/quorumApi.ts`. After the existing URL builders (after the `getSpaceInviteEvalUrl` export), append:

```typescript
// Directory endpoint params (matches mobile's QuorumMobileClient.exploreSpaces signature)
export type ExploreSpacesParams = {
  search?: string;
  category?: string;
  offset?: number;
  limit?: number;
};

/**
 * Build a GET /directory URL with optional search/category/pagination params.
 * Used by QuorumApiClient.exploreSpaces. Mirrors mobile's URL assembly in
 * services/api/quorumClient.ts lines 871-884.
 */
export const getDirectoryUrl = (params?: ExploreSpacesParams): `/${string}` => {
  if (!params) return `/directory`;
  const queryParts: string[] = [];
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
  if (params.offset !== undefined) queryParts.push(`offset=${params.offset}`);
  if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
  return queryParts.length > 0 ? `/directory?${queryParts.join('&')}` as `/${string}` : `/directory`;
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/quorumApi.ts
git commit -m "feat(api): add getDirectoryUrl + ExploreSpacesParams"
```

---

## Task 7: Add `exploreSpaces` method to `QuorumApiClient`

**Files:**
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/api/baseTypes.ts` (imports block lines 3-16 + method addition after line 458)

- [ ] **Step 1: Update imports**

Open `D:/GitHub/Quilibrium/quorum-desktop/src/api/baseTypes.ts`. In the import block at lines 3-16, add `getDirectoryUrl` to the existing import and add a new import for the shared types. After the modification, the imports should look like:

```typescript
import qs from 'qs';
import { getConfig } from '../config/config';
import {
  getDirectoryUrl,
  getHubAddUrl,
  getHubDeleteUrl,
  getHubUrl,
  getInboxDeleteUrl,
  getInboxFetchUrl,
  getInboxUrl,
  getSpaceInviteEvalsUrl,
  getSpaceInviteEvalUrl,
  getSpaceManifestUrl,
  getSpaceUrl,
  getUserRegistrationUrl,
  getUserSettingsUrl,
} from './quorumApi';
import type { ExploreSpacesParams } from './quorumApi';
import type { DirectoryResponse } from '@quilibrium/quorum-shared';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
```

- [ ] **Step 2: Add `exploreSpaces` method to `QuorumApiClient`**

Locate the `QuorumApiClient extends AbstractQuorumApiClient` class (starts at line 344). After the last existing method (after the `getSpaceManifest` closing brace at approximately line 458), and BEFORE the class's closing brace, add:

```typescript
  /**
   * Fetch entries from the public space directory. Server-side filtered by
   * optional search query and category. Paginated via offset/limit.
   *
   * Mirrors mobile's QuorumMobileClient.exploreSpaces (services/api/quorumClient.ts:871-884).
   */
  exploreSpaces(
    params?: ExploreSpacesParams,
    { headers, timeout }: { headers?: RequestHeaders; timeout?: number } = {}
  ) {
    return this.get<DirectoryResponse>(getDirectoryUrl(params), {
      headers,
      timeout,
    });
  }
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/baseTypes.ts
git commit -m "feat(api): add QuorumApiClient.exploreSpaces method"
```

---

## Task 8: Create mock space-name and description arrays + generator

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/utils/mock/mockSpaces.ts`
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/utils/mock/index.ts`

- [ ] **Step 1: Create `mockSpaces.ts` with cycling arrays + generator**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/utils/mock/mockSpaces.ts`:

```typescript
/**
 * Mock space generation for development and testing of the Discover Spaces UI.
 *
 * Activated via:
 *   - URL parameter: ?spaces=N (N spaces)
 *   - localStorage: debug_mock_spaces === 'true' (count from debug_mock_spaces_count or 30)
 *
 * Both gates require NODE_ENV === 'development'. Production builds tree-shake.
 *
 * Returns DirectoryEntry[] (the wire shape from @quilibrium/quorum-shared) so
 * useExploreSpaces can swap mock data in for the real fetch transparently.
 *
 * Generation strategy mirrors mockConversations.ts: cycling arrays + deterministic
 * per-index assignment. Predictable for visual checking; realistic-looking.
 */

import type { DirectoryEntry, SpaceCategory } from '@quilibrium/quorum-shared';

// Realistic space names spanning categories. Cycled by index modulo length.
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

// Multi-language descriptions (matches MOCK_PREVIEWS pattern from mockConversations.ts).
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

// All 7 categories cycled to ensure each is represented in the mock set.
const CATEGORY_CYCLE: SpaceCategory[] = [
  'tech',
  'crypto',
  'gaming',
  'community',
  'social',
  'education',
  'other',
];

/**
 * Cheap pseudo-random number derived from a seed. Deterministic per-index so
 * a card looks the same across re-renders. Returns a value in [0, max).
 */
function seededInt(seed: number, max: number): number {
  // LCG constants from Numerical Recipes
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  return ((seed * a + c) % m + m) % m % max;
}

/**
 * Generate mock directory entries for visual testing.
 * Each entry is deterministic per-index (no randomness between renders).
 */
export function generateMockSpaces(count: number): DirectoryEntry[] {
  const result: DirectoryEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const name = MOCK_SPACE_NAMES[i % MOCK_SPACE_NAMES.length];
    const description = MOCK_SPACE_DESCRIPTIONS[i % MOCK_SPACE_DESCRIPTIONS.length];
    const category = CATEGORY_CYCLE[i % CATEGORY_CYCLE.length];

    // Member counts cycle through realistic ranges: small / medium / large
    const memberCountSeed = seededInt(i + 7, 5000);
    const memberCount = memberCountSeed < 50 ? memberCountSeed + 5 : memberCountSeed;

    result.push({
      space_address: `mock_space_${i.toString().padStart(4, '0')}`,
      name,
      description,
      icon: '', // Empty triggers initials fallback in SpaceIcon
      invite_link: `https://app.quorummessenger.com/invite/mock_${i}`,
      category,
      status: 'active',
      submitted_at: now - (i * 24 * 60 * 60 * 1000), // Spread submissions over recent days
      member_count: memberCount,
    });
  }

  return result;
}

/**
 * Check whether mock spaces are enabled in this session.
 * Returns false in production builds regardless of localStorage/URL.
 */
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

/**
 * Read the mock space count from URL parameter or localStorage. Default 30.
 */
export function getMockSpacesCount(): number {
  if (typeof window === 'undefined') return 30;
  const urlValue = new URLSearchParams(window.location?.search || '').get('spaces');
  const lsValue = localStorage?.getItem('debug_mock_spaces_count');
  return parseInt(urlValue || lsValue || '30', 10);
}
```

- [ ] **Step 2: Add to mock barrel**

Open `D:/GitHub/Quilibrium/quorum-desktop/src/utils/mock/index.ts`. After the existing exports, append:

```typescript

export {
  generateMockSpaces,
  isMockSpacesEnabled,
  getMockSpacesCount,
} from './mockSpaces';
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 4: Write a unit test for `generateMockSpaces`**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/dev/tests/utils/mockSpaces.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateMockSpaces } from '../../../utils/mock/mockSpaces';

describe('generateMockSpaces', () => {
  it('returns the requested number of entries', () => {
    const result = generateMockSpaces(15);
    expect(result).toHaveLength(15);
  });

  it('returns DirectoryEntry-shaped objects', () => {
    const [entry] = generateMockSpaces(1);
    expect(entry).toMatchObject({
      space_address: expect.stringMatching(/^mock_space_\d{4}$/),
      name: expect.any(String),
      description: expect.any(String),
      icon: '',
      invite_link: expect.stringContaining('mock_'),
      category: expect.any(String),
      status: 'active',
      submitted_at: expect.any(Number),
      member_count: expect.any(Number),
    });
  });

  it('cycles through all 7 categories', () => {
    const entries = generateMockSpaces(14); // 2x the 7 categories
    const categories = new Set(entries.map((e) => e.category));
    expect(categories.size).toBe(7);
  });

  it('produces deterministic output for the same index', () => {
    const a = generateMockSpaces(5);
    const b = generateMockSpaces(5);
    expect(a).toEqual(b);
  });

  it('returns empty array when count is 0', () => {
    expect(generateMockSpaces(0)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the test**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
yarn vitest run src/dev/tests/utils/mockSpaces.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/mock/mockSpaces.ts src/utils/mock/index.ts src/dev/tests/utils/mockSpaces.test.ts
git commit -m "feat(mock): add generateMockSpaces dev fixture"
```

---

## Task 9: Create `useExploreSpaces` hook (real fetch + mock-mode swap)

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/spaces/useExploreSpaces.ts`
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/spaces/index.ts`

- [ ] **Step 1: Create the hook file**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/spaces/useExploreSpaces.ts`:

```typescript
/**
 * useExploreSpaces — Hook for browsing the public space directory.
 *
 * Wraps QuorumApiClient.exploreSpaces with React Query. Provides debounced
 * search, category filter, and offset-based pagination state.
 *
 * Ported from quorum-mobile's hooks/chat/useExploreSpaces.ts; adapted to
 * desktop's API client and dev-mode mock fixture.
 *
 * Mock mode: when isMockSpacesEnabled() is true (dev only), the network
 * fetch is skipped entirely and generateMockSpaces(N) drives the UI. Search
 * + category filtering applies client-side over the mock set. This lets us
 * test the Discover UI before the server has real public spaces seeded.
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DirectoryEntry, DirectoryResponse, SpaceCategory } from '@quilibrium/quorum-shared';
import { QuorumApiClient } from '../../../api/baseTypes';
import { getConfig } from '../../../config/config';
import {
  generateMockSpaces,
  isMockSpacesEnabled,
  getMockSpacesCount,
} from '../../../utils/mock/mockSpaces';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

export const SPACE_CATEGORIES: { label: string; value: SpaceCategory | null }[] = [
  { label: 'All', value: null },
  { label: 'Community', value: 'community' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Tech', value: 'tech' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Social', value: 'social' },
  { label: 'Education', value: 'education' },
  { label: 'Other', value: 'other' },
];

interface UseExploreSpacesReturn {
  entries: DirectoryEntry[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
  search: string;
  setSearch: (value: string) => void;
  category: SpaceCategory | null;
  setCategory: (value: SpaceCategory | null) => void;
  loadMore: () => void;
  refetch: () => void;
  offset: number;
}

/**
 * Apply mock-mode filtering: search by name substring + category equality.
 * Mirrors the server-side filter contract so the mock UI behaves identically.
 */
function filterMockEntries(
  all: DirectoryEntry[],
  search: string,
  category: SpaceCategory | null
): DirectoryEntry[] {
  let result = all;
  if (category) {
    result = result.filter((e) => e.category === category);
  }
  if (search.trim()) {
    const needle = search.toLowerCase().trim();
    result = result.filter((e) => e.name.toLowerCase().includes(needle));
  }
  return result;
}

export function useExploreSpaces(): UseExploreSpacesReturn {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<SpaceCategory | null>(null);
  const [offset, setOffset] = useState(0);

  // Debounce search input — matches mobile's 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0); // Reset pagination on new search
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset pagination on category change
  useEffect(() => {
    setOffset(0);
  }, [category]);

  // Cache the mock-mode flag once per session
  const mockEnabled = useMemo(() => isMockSpacesEnabled(), []);
  const mockCount = useMemo(() => (mockEnabled ? getMockSpacesCount() : 0), [mockEnabled]);
  const mockAll = useMemo(
    () => (mockEnabled ? generateMockSpaces(mockCount) : []),
    [mockEnabled, mockCount]
  );

  // Build the React Query — disabled in mock mode (mocks bypass network entirely)
  const queryKey = useMemo(
    () => ['exploreSpaces', debouncedSearch, category, offset, mockEnabled],
    [debouncedSearch, category, offset, mockEnabled]
  );

  const { data, isLoading, error, refetch } = useQuery<DirectoryResponse>({
    queryKey,
    enabled: !mockEnabled,
    queryFn: async () => {
      const apiClient = new QuorumApiClient({ baseUrl: getConfig().apiBaseUrl });
      return apiClient.exploreSpaces({
        search: debouncedSearch || undefined,
        category: category || undefined,
        offset,
        limit: PAGE_SIZE,
      });
    },
    staleTime: 60_000, // 60s — matches mobile
  });

  // Resolve final values from either mock-mode or real-fetch path
  const result = useMemo<{ entries: DirectoryEntry[]; total: number; has_more: boolean }>(() => {
    if (mockEnabled) {
      const filtered = filterMockEntries(mockAll, debouncedSearch, category);
      const page = filtered.slice(0, offset + PAGE_SIZE);
      return {
        entries: page,
        total: filtered.length,
        has_more: page.length < filtered.length,
      };
    }
    return {
      entries: data?.entries ?? [],
      total: data?.total ?? 0,
      has_more: data?.has_more ?? false,
    };
  }, [mockEnabled, mockAll, debouncedSearch, category, offset, data]);

  const loadMore = () => {
    if (result.has_more) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  };

  return {
    entries: result.entries,
    total: result.total,
    hasMore: result.has_more,
    isLoading: mockEnabled ? false : isLoading,
    error: error as Error | null,
    search,
    setSearch,
    category,
    setCategory,
    loadMore,
    refetch,
    offset,
  };
}
```

- [ ] **Step 2: Add to barrel**

Open `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/spaces/index.ts`. After the existing exports, append:

```typescript
export { useExploreSpaces, SPACE_CATEGORIES } from './useExploreSpaces';
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/business/spaces/useExploreSpaces.ts src/hooks/business/spaces/index.ts
git commit -m "feat(hooks): add useExploreSpaces (with dev-mode mock support)"
```

---

## Task 10: Create `useHideMutedSpaces` hook (read + toggle the UserConfig field)

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/user/useHideMutedSpaces.ts`
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/user/index.ts` (if it exists; otherwise create)

- [ ] **Step 1: Confirm or create the barrel**

```bash
cat "D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/user/index.ts" 2>&1 || echo "MISSING"
```

If the file exists, note its content. If it doesn't exist, create it minimally with:

```typescript
// Barrel for user-scoped business hooks
```

- [ ] **Step 2: Create the hook**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/user/useHideMutedSpaces.ts`:

```typescript
/**
 * useHideMutedSpaces — read + toggle the UserConfig.hideMutedSpacesFromSidebar field.
 *
 * The field controls whether the navbar filters out spaces where
 * notificationSettings[spaceId].isMuted === true. Default false (show all).
 *
 * Write pattern mirrors useChannelMute.toggleShowMutedChannels (channels.ts:232-264):
 *  1. Read current config via messageDB.getUserConfig
 *  2. Build updated config
 *  3. Optimistic React Query cache write
 *  4. Persistent save via actionQueueService (dedup key collapses rapid toggles)
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useConfig, buildConfigKey } from '../../queries/config';

interface UseHideMutedSpacesReturn {
  /** Current preference value; defaults to false when unset */
  hideMutedSpaces: boolean;
  /** Toggle the preference (writes UserConfig + optimistic cache update) */
  toggleHideMutedSpaces: () => Promise<void>;
}

export function useHideMutedSpaces(): UseHideMutedSpacesReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  const hideMutedSpaces = config?.hideMutedSpacesFromSidebar ?? false;

  const toggleHideMutedSpaces = useCallback(async (): Promise<void> => {
    if (!userAddress || !keyset) return;

    try {
      const currentConfig = await messageDB.getUserConfig({ address: userAddress });

      const updatedConfig = {
        ...currentConfig,
        address: userAddress,
        spaceIds: currentConfig?.spaceIds || [],
        hideMutedSpacesFromSidebar: !(currentConfig?.hideMutedSpacesFromSidebar ?? false),
      };

      // Optimistic React Query update for instant UI feedback
      queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);

      // Persistent save through ActionQueue (offline-safe + dedup on rapid toggles)
      await actionQueueService.enqueue(
        'save-user-config',
        { config: updatedConfig },
        `config:${userAddress}`
      );
    } catch (error) {
      console.error('[useHideMutedSpaces] Error toggling preference:', error);
      throw error;
    }
  }, [userAddress, keyset, messageDB, queryClient, actionQueueService]);

  return {
    hideMutedSpaces,
    toggleHideMutedSpaces,
  };
}
```

- [ ] **Step 3: Add to user-hooks barrel**

In `D:/GitHub/Quilibrium/quorum-desktop/src/hooks/business/user/index.ts`, ensure the file exports this hook. If existing content is a barrel, append:

```typescript
export { useHideMutedSpaces } from './useHideMutedSpaces';
```

If the file was empty/new, replace its content with:

```typescript
// Barrel for user-scoped business hooks
export { useHideMutedSpaces } from './useHideMutedSpaces';
```

- [ ] **Step 4: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/business/user/useHideMutedSpaces.ts src/hooks/business/user/index.ts
git commit -m "feat(hooks): add useHideMutedSpaces (read + toggle UserConfig field)"
```

---

## Task 11: Create `SpaceCard` shared card component (two variants)

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpaceCard.tsx`
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpaceCard.scss`

- [ ] **Step 1: Create the component**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpaceCard.tsx`:

```typescript
import * as React from 'react';
import { t } from '@lingui/core/macro';
import { formatMemberCount } from '@quilibrium/quorum-shared';
import SpaceIcon from '../navbar/SpaceIcon';
import { Button, Icon, Tooltip } from '../primitives';
import './SpaceCard.scss';

/**
 * Shared card for the /spaces page. Two visual variants:
 *
 * - "my-space": compact, used in the 3-column grid on My Spaces.
 *   Shows icon + name + member count + owner badge. Whole card is
 *   clickable to navigate into the space.
 *
 * - "public": richer, used in the 2-column grid on Discover.
 *   Shows icon + name + category + member count + 2-line description
 *   excerpt + Join button. No banner area in PR 1 (DirectoryEntry has
 *   no banner field server-side yet — see Phase 12 task drop). When
 *   the server adds banners, this variant gets a hero-card redesign.
 */

interface SpaceCardMySpaceProps {
  variant: 'my-space';
  iconUrl?: string;
  spaceId: string;
  spaceName: string;
  memberCount: number;
  isOwner: boolean;
  onClick: () => void;
}

interface SpaceCardPublicProps {
  variant: 'public';
  iconUrl?: string;
  spaceAddress: string;
  spaceName: string;
  memberCount: number;
  category: string;
  description: string;
  onJoin: () => void;
  isJoining?: boolean;
}

type SpaceCardProps = SpaceCardMySpaceProps | SpaceCardPublicProps;

export const SpaceCard: React.FC<SpaceCardProps> = (props) => {
  if (props.variant === 'my-space') {
    return (
      <div
        className="space-card space-card--my-space"
        role="button"
        tabIndex={0}
        onClick={props.onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            props.onClick();
          }
        }}
        aria-label={t`Open ${props.spaceName}`}
      >
        <div className="space-card__icon">
          <SpaceIcon
            iconUrl={props.iconUrl}
            spaceName={props.spaceName}
            spaceId={props.spaceId}
            size="regular"
            selected={false}
            notifs={false}
            noTooltip={true}
            noToggle={true}
          />
        </div>
        <div className="space-card__body">
          <div className="space-card__name-row">
            <span className="space-card__name">{props.spaceName}</span>
            {props.isOwner && (
              <Tooltip
                id={`owner-${props.spaceId}`}
                content={t`You are the owner of this Space`}
                place="top"
              >
                <Icon name="crown" size="sm" className="space-card__owner-badge" />
              </Tooltip>
            )}
          </div>
          <span className="space-card__meta">
            {formatMemberCount(props.memberCount)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-card space-card--public">
      <div className="space-card__icon">
        <SpaceIcon
          iconUrl={props.iconUrl}
          spaceName={props.spaceName}
          spaceId={props.spaceAddress}
          size="large"
          selected={false}
          notifs={false}
          noTooltip={true}
          noToggle={true}
        />
      </div>
      <div className="space-card__body">
        <div className="space-card__name-row">
          <span className="space-card__name">{props.spaceName}</span>
        </div>
        <span className="space-card__meta">
          {props.category} · {formatMemberCount(props.memberCount)}
        </span>
        <Tooltip
          id={`desc-${props.spaceAddress}`}
          content={props.description}
          place="top"
          delay={500}
        >
          <p className="space-card__description">{props.description}</p>
        </Tooltip>
        <div className="space-card__actions">
          <Button
            type="primary"
            onClick={props.onJoin}
            disabled={props.isJoining}
          >
            {props.isJoining ? t`Joining...` : t`Join`}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create the SCSS**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpaceCard.scss`:

```scss
@import '../../styles/variables';

.space-card {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md;
  border-radius: $border-radius-lg;
  background: var(--surface-01);
  border: 1px solid var(--border-subtle);
  transition: background 150ms ease;

  &__icon {
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-width: 0; // Allow text truncation
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  &__name-row {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
  }

  &__name {
    font-weight: $font-weight-semibold;
    color: var(--text-heading);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__owner-badge {
    color: var(--accent);
    flex-shrink: 0;
  }

  &__meta {
    font-size: $font-size-sm;
    color: var(--text-muted);
  }

  &__description {
    font-size: $font-size-sm;
    color: var(--text-main);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
  }

  &__actions {
    margin-top: auto;
    padding-top: $spacing-sm;
    display: flex;
    justify-content: flex-end;
  }

  // Variants
  &--my-space {
    cursor: pointer;
    align-items: center;

    &:hover {
      background: var(--surface-02);
    }
  }

  &--public {
    align-items: flex-start;
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors. If `formatMemberCount` import fails, check the exact shared export with `grep "formatMemberCount" node_modules/@quilibrium/quorum-shared/dist/*.d.ts` and adjust.

- [ ] **Step 4: Commit**

```bash
git add src/components/spaces-page/SpaceCard.tsx src/components/spaces-page/SpaceCard.scss
git commit -m "feat(spaces-page): add SpaceCard component (my-space + public variants)"
```

---

## Task 12: Build `MySpacesTab` component

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/MySpacesTab.tsx`
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/MySpacesTab.scss`

- [ ] **Step 1: Create the component**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/MySpacesTab.tsx`:

```typescript
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useSpaces, useConfig } from '../../hooks';
import { useHideMutedSpaces } from '../../hooks/business/user/useHideMutedSpaces';
import { useMessageDB } from '../context/useMessageDB';
import { Input, Select, Switch } from '../primitives';
import { SpaceCard } from './SpaceCard';
import type { NavItem } from '../../db/messages';
import './MySpacesTab.scss';

/**
 * "My Spaces" tab — grid of the user's joined Spaces.
 *
 * UX: search input + folder filter Select dropdown + "Hide muted Spaces
 * from sidebar" toggle in the header row. 3-column compact grid.
 *
 * Note: the folder dropdown is a READ-ONLY filter. Folder creation, edit,
 * reorder all stay in the navbar (canonical organize surface). Selecting
 * a folder filters the grid to that folder's spaces.
 *
 * "Hide muted Spaces from sidebar" toggle writes UserConfig — the navbar
 * reads the same field and filters itself accordingly. This grid is NEVER
 * filtered by mute state; the toggle ONLY affects the navbar.
 */

export const MySpacesTab: React.FC = () => {
  const navigate = useNavigate();
  const user = usePasskeysContext();
  const userAddress = user.currentPasskeyInfo?.address || '';
  const { data: spaces } = useSpaces({});
  const { data: config } = useConfig({ userAddress });
  const { hideMutedSpaces, toggleHideMutedSpaces } = useHideMutedSpaces();
  const { messageDB } = useMessageDB();

  const [search, setSearch] = React.useState('');
  const [folderId, setFolderId] = React.useState<string>('all');

  // Extract folders from config (read-only — folder editing happens in navbar)
  const folders = React.useMemo(() => {
    const items = config?.items || [];
    return items.filter((item): item is NavItem & { type: 'folder' } => item.type === 'folder');
  }, [config?.items]);

  // Build folder Select options
  const folderOptions = React.useMemo(() => {
    return [
      { label: t`All folders`, value: 'all' },
      ...folders.map((f) => ({ label: f.name, value: f.id })),
    ];
  }, [folders]);

  // Owner lookup: precompute for the visible set
  const [ownerMap, setOwnerMap] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!spaces || spaces.length === 0) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, boolean> = {};
      for (const space of spaces) {
        try {
          const ownerKey = await messageDB.getSpaceKey(space.spaceId, 'owner');
          result[space.spaceId] = !!ownerKey;
        } catch {
          result[space.spaceId] = false;
        }
      }
      if (!cancelled) setOwnerMap(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [spaces, messageDB]);

  // Filter spaces by name + folder
  const filteredSpaces = React.useMemo(() => {
    let result = spaces ?? [];

    if (folderId !== 'all') {
      const folder = folders.find((f) => f.id === folderId);
      if (folder) {
        const ids = new Set(folder.spaceIds);
        result = result.filter((s) => ids.has(s.spaceId));
      }
    }

    if (search.trim()) {
      const needle = search.toLowerCase().trim();
      result = result.filter((s) =>
        s.spaceName.toLowerCase().includes(needle)
      );
    }

    return result;
  }, [spaces, folderId, folders, search]);

  return (
    <div className="my-spaces-tab">
      <div className="my-spaces-tab__header">
        <Input
          className="my-spaces-tab__search"
          value={search}
          onChange={setSearch}
          placeholder={t`Find a Space...`}
          clearable={true}
        />
        <Select
          value={folderId}
          onChange={(value: string) => setFolderId(value)}
          options={folderOptions}
          size="medium"
        />
        <label className="my-spaces-tab__toggle">
          <Switch
            value={hideMutedSpaces}
            onChange={() => toggleHideMutedSpaces()}
          />
          <span>{t`Hide muted Spaces from sidebar`}</span>
        </label>
      </div>

      <div className="my-spaces-tab__grid">
        {filteredSpaces.length === 0 ? (
          <div className="my-spaces-tab__empty">
            {search.trim() || folderId !== 'all'
              ? t`No Spaces match the current filters.`
              : t`No Spaces yet — discover public spaces or paste an invite link.`}
          </div>
        ) : (
          filteredSpaces.map((space) => (
            <SpaceCard
              key={space.spaceId}
              variant="my-space"
              iconUrl={space.iconUrl}
              spaceId={space.spaceId}
              spaceName={space.spaceName}
              memberCount={0 /* TODO: compute from useSpaceMembers per card */}
              isOwner={ownerMap[space.spaceId] ?? false}
              onClick={() => {
                const firstChannel = space.groups?.[0]?.channels?.[0]?.channelId;
                if (firstChannel) {
                  navigate(`/spaces/${space.spaceId}/${firstChannel}`);
                } else {
                  navigate(`/spaces/${space.spaceId}`);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Resolve the `memberCount` placeholder**

The `memberCount={0}` placeholder in step 1 is intentional — `useSpaceMembers` is per-space and can't be called in a loop. Replace it with a per-card lookup using a small helper component. Update `MySpacesTab.tsx`: add this component above the main `export const MySpacesTab` declaration:

```typescript
/**
 * Per-card member-count resolver. Each SpaceCardMySpace needs its own
 * useSpaceMembers call, which violates the rules-of-hooks if done in a
 * loop. This sub-component lets each card resolve independently.
 */
const MySpaceCard: React.FC<{
  space: ReturnType<typeof useSpaces>['data'] extends Array<infer T> ? T : never;
  isOwner: boolean;
  onClick: () => void;
}> = ({ space, isOwner, onClick }) => {
  // Lazy import to avoid suspense in the parent loop
  const { useSpaceMembers } = require('../../hooks/queries/spaceMembers');
  const { data: members } = useSpaceMembers({ spaceId: space.spaceId });

  return (
    <SpaceCard
      variant="my-space"
      iconUrl={space.iconUrl}
      spaceId={space.spaceId}
      spaceName={space.spaceName}
      memberCount={members?.length ?? 0}
      isOwner={isOwner}
      onClick={onClick}
    />
  );
};
```

Then replace the `filteredSpaces.map((space) => ( <SpaceCard ... />))` block with:

```typescript
filteredSpaces.map((space) => (
  <MySpaceCard
    key={space.spaceId}
    space={space}
    isOwner={ownerMap[space.spaceId] ?? false}
    onClick={() => {
      const firstChannel = space.groups?.[0]?.channels?.[0]?.channelId;
      if (firstChannel) {
        navigate(`/spaces/${space.spaceId}/${firstChannel}`);
      } else {
        navigate(`/spaces/${space.spaceId}`);
      }
    }}
  />
))
```

NOTE: the `require()` inside `MySpaceCard` is a workaround if direct top-of-file import causes circular-import issues. If a normal top-of-file import works, use that instead. Verify both approaches during implementation; pick the simpler one.

- [ ] **Step 3: Create the SCSS**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/MySpacesTab.scss`:

```scss
@import '../../styles/variables';

.my-spaces-tab {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex-wrap: wrap;
  }

  &__search {
    max-width: 28rem;
    flex: 1 1 auto;
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-sm;
    color: var(--text-main);
    cursor: pointer;
    user-select: none;

    span {
      white-space: nowrap;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $spacing-md;

    @media (max-width: 1024px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  }

  &__empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: $spacing-xl;
    color: var(--text-muted);
  }
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors. If type errors surface around the `MySpaceCard` props typing, simplify by directly typing `space: Space` (import from `@quilibrium/quorum-shared`) instead of the inferred type expression.

- [ ] **Step 5: Commit**

```bash
git add src/components/spaces-page/MySpacesTab.tsx src/components/spaces-page/MySpacesTab.scss
git commit -m "feat(spaces-page): add MySpacesTab component"
```

---

## Task 13: Build `DiscoverTab` component

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/DiscoverTab.tsx`
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/DiscoverTab.scss`

- [ ] **Step 1: Create the component**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/DiscoverTab.tsx`:

```typescript
import * as React from 'react';
import { t } from '@lingui/core/macro';
import { useExploreSpaces, SPACE_CATEGORIES } from '../../hooks/business/spaces';
import { useSpaceJoining } from '../../hooks';
import { Input, Select, Button, Icon, Callout } from '../primitives';
import { SpaceCard } from './SpaceCard';
import type { SpaceCategory } from '@quilibrium/quorum-shared';
import './DiscoverTab.scss';

/**
 * "Discover" tab — public space directory browse view.
 *
 * UX: search input + category Select dropdown in the header row, 2-column
 * grid of richer cards below (icon + name + category + member count +
 * description + Join button). "Load more" paginates server-side.
 *
 * In dev mode (?spaces=N or localStorage debug_mock_spaces=true), the
 * fetch is replaced by generateMockSpaces(N) for visual testing without
 * server-seeded data.
 */

export const DiscoverTab: React.FC = () => {
  const {
    entries,
    total,
    hasMore,
    isLoading,
    error,
    search,
    setSearch,
    category,
    setCategory,
    loadMore,
    refetch,
  } = useExploreSpaces();
  const { joinSpace, joining } = useSpaceJoining();
  const [joiningEntry, setJoiningEntry] = React.useState<string | null>(null);

  // Category options for the Select dropdown — labels Lingui-localized
  const categoryOptions = React.useMemo(
    () =>
      SPACE_CATEGORIES.map((c) => ({
        label: c.value === null ? t`All categories` : c.label,
        value: c.value ?? 'all',
      })),
    []
  );

  const handleCategoryChange = (value: string) => {
    setCategory(value === 'all' ? null : (value as SpaceCategory));
  };

  const handleJoin = async (inviteLink: string, spaceAddress: string) => {
    setJoiningEntry(spaceAddress);
    try {
      await joinSpace(inviteLink);
    } finally {
      setJoiningEntry(null);
    }
  };

  return (
    <div className="discover-tab">
      <div className="discover-tab__header">
        <Input
          className="discover-tab__search"
          value={search}
          onChange={setSearch}
          placeholder={t`Search public spaces...`}
          clearable={true}
        />
        <Select
          value={category ?? 'all'}
          onChange={handleCategoryChange}
          options={categoryOptions}
          size="medium"
        />
      </div>

      {error && (
        <Callout variant="error" size="sm">
          <div className="flex items-center justify-between gap-2">
            <span>{t`Failed to load public spaces.`}</span>
            <Button type="secondary" onClick={() => refetch()}>
              {t`Retry`}
            </Button>
          </div>
        </Callout>
      )}

      <div className="discover-tab__grid">
        {isLoading && entries.length === 0 ? (
          <div className="discover-tab__loading">
            <Icon name="spinner" className="icon-spin" />
            <span>{t`Loading public spaces...`}</span>
          </div>
        ) : entries.length === 0 && !error ? (
          <div className="discover-tab__empty">
            {search.trim() || category
              ? t`No public spaces match the current filters.`
              : t`No public spaces available yet.`}
          </div>
        ) : (
          entries.map((entry) => (
            <SpaceCard
              key={entry.space_address}
              variant="public"
              iconUrl={entry.icon || undefined}
              spaceAddress={entry.space_address}
              spaceName={entry.name}
              memberCount={entry.member_count ?? 0}
              category={entry.category}
              description={entry.description}
              isJoining={joiningEntry === entry.space_address && joining}
              onJoin={() => handleJoin(entry.invite_link, entry.space_address)}
            />
          ))
        )}
      </div>

      {hasMore && !isLoading && entries.length > 0 && (
        <div className="discover-tab__load-more">
          <Button type="secondary" onClick={loadMore}>
            {t`Load more`}
          </Button>
        </div>
      )}

      {total > 0 && entries.length > 0 && (
        <div className="discover-tab__footer">
          {t`Showing ${entries.length} of ${total} spaces`}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Create the SCSS**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/DiscoverTab.scss`:

```scss
@import '../../styles/variables';

.discover-tab {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex-wrap: wrap;
  }

  &__search {
    max-width: 28rem;
    flex: 1 1 auto;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-md;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  &__empty,
  &__loading {
    grid-column: 1 / -1;
    text-align: center;
    padding: $spacing-xl;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
  }

  &__load-more {
    display: flex;
    justify-content: center;
    padding: $spacing-md 0;
  }

  &__footer {
    text-align: center;
    font-size: $font-size-sm;
    color: var(--text-muted);
    padding: $spacing-sm 0;
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors. If `useSpaceJoining` lookup fails (wrong path), find it with:

```bash
grep -r "export.*useSpaceJoining" src/hooks
```

and adjust the import accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/components/spaces-page/DiscoverTab.tsx src/components/spaces-page/DiscoverTab.scss
git commit -m "feat(spaces-page): add DiscoverTab component"
```

---

## Task 14: Build `SpacesPage` shell with tab navigation

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpacesPage.tsx`
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpacesPage.scss`
- Create: `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/index.ts`

- [ ] **Step 1: Create the page shell**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpacesPage.tsx`:

```typescript
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Button } from '../primitives';
import { MySpacesTab } from './MySpacesTab';
import { DiscoverTab } from './DiscoverTab';
import './SpacesPage.scss';

/**
 * Top-level route component for /spaces.
 *
 * Renders a 2-tab shell in PR 1 (My Spaces + Discover). PR 2 will add
 * Join via link + Create space tabs and retire AddSpaceModal +
 * CreateSpaceModal.
 *
 * Active tab is persisted in the URL query param (?tab=discover) so the
 * route is deep-linkable and survives page reload. Default: "my-spaces".
 */

type TabId = 'my-spaces' | 'discover';

const TABS: { id: TabId; label: () => string }[] = [
  { id: 'my-spaces', label: () => t`My Spaces` },
  { id: 'discover', label: () => t`Discover` },
];

export const SpacesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = tabParam === 'discover' ? 'discover' : 'my-spaces';

  const setActiveTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'my-spaces') {
      next.delete('tab');
    } else {
      next.set('tab', id);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="spaces-page">
      <nav className="spaces-page__tabs" role="tablist" aria-label={t`Spaces`}>
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="unstyled"
            className={`spaces-page__tab ${activeTab === tab.id ? 'spaces-page__tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label()}
          </Button>
        ))}
      </nav>

      <div className="spaces-page__content" role="tabpanel">
        {activeTab === 'my-spaces' && <MySpacesTab />}
        {activeTab === 'discover' && <DiscoverTab />}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create the SCSS**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/SpacesPage.scss`:

```scss
@import '../../styles/variables';

.spaces-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--surface-00);

  &__tabs {
    display: flex;
    gap: $spacing-md;
    padding: $spacing-md $spacing-lg 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__tab {
    padding: $spacing-sm $spacing-md;
    font-weight: $font-weight-semibold;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 150ms ease, border-color 150ms ease;

    &:hover {
      color: var(--text-main);
    }

    &--active {
      color: var(--text-heading);
      border-bottom-color: var(--accent);
    }
  }

  &__content {
    flex: 1;
    overflow-y: auto;
  }
}
```

- [ ] **Step 3: Create the barrel**

Create `D:/GitHub/Quilibrium/quorum-desktop/src/components/spaces-page/index.ts`:

```typescript
export { SpacesPage } from './SpacesPage';
export { MySpacesTab } from './MySpacesTab';
export { DiscoverTab } from './DiscoverTab';
export { SpaceCard } from './SpaceCard';
```

- [ ] **Step 4: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/spaces-page/SpacesPage.tsx src/components/spaces-page/SpacesPage.scss src/components/spaces-page/index.ts
git commit -m "feat(spaces-page): add SpacesPage shell + tab navigation"
```

---

## Task 15: Wire `/spaces` route in router

**Files:**
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/components/Router/Router.web.tsx`

- [ ] **Step 1: Add the import**

Open `D:/GitHub/Quilibrium/quorum-desktop/src/components/Router/Router.web.tsx`. Add this import after the existing component imports (after line 11):

```typescript
import { SpacesPage } from '@/components/spaces-page';
```

- [ ] **Step 2: Add the route**

Inside the `<Routes>` block, add a new `<Route>` BEFORE the existing `<Route path="/spaces/:spaceId/:channelId">` at line 139. The new route should use the same Layout/Provider stack as other authenticated routes:

```typescript
      <Route
        path="/spaces"
        element={
          <ModalProvider user={user} setUser={setUser}>
            <MobileProvider>
              <SidebarProvider>
                <Layout>
                  <RouteErrorBoundary fallback={<Navigate to="/" replace />}>
                    <SpacesPage />
                  </RouteErrorBoundary>
                </Layout>
              </SidebarProvider>
            </MobileProvider>
          </ModalProvider>
        }
      />
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Router/Router.web.tsx
git commit -m "feat(router): wire /spaces route"
```

---

## Task 16: Wire `icon-layout-grid-add` navbar entry point

**Files:**
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/src/components/navbar/NavMenu.tsx`

- [ ] **Step 1: Add the new entry button at the top of the space list**

Open `D:/GitHub/Quilibrium/quorum-desktop/src/components/navbar/NavMenu.tsx`. Find the closing `</div>` of the `<div className="nav-menu-logo">` block (around line 570). Right after that closing `</div>`, BEFORE the `<nav className="nav-menu-spaces grow">` opening (around line 571), insert:

```typescript
      {/* Spaces hub entry (added 2026-06-01 for unified /spaces page).
          PR 1: coexists with the existing "+" Add space button.
          PR 2: will become the sole entry point (the "+" gets removed). */}
      <div className="nav-menu-spaces-hub">
        <Tooltip
          id="spaces-hub-nav-icon"
          content={t`Spaces`}
          place="right"
          showOnTouch={false}
          className="tooltip-text-large"
        >
          <div
            role="link"
            tabIndex={0}
            className={`block cursor-pointer ${location.pathname === '/spaces' || location.pathname.startsWith('/spaces?') ? 'space-icon-toggle--selected-wrap' : ''}`}
            onClick={() => navigate('/spaces')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/spaces');
              }
            }}
            aria-label={t`Open Spaces page`}
          >
            <div className={`${location.pathname === '/spaces' ? 'space-icon-selected' : 'space-icon'} spaces-hub-icon`}>
              <Icon name="layout-grid-add" size="2xl" />
            </div>
          </div>
        </Tooltip>
      </div>
```

- [ ] **Step 2: Apply mute filter at the `useNavItems` integration point**

Find line 393:

```typescript
  const { navItems, allSpaces } = useNavItems(spaces, config);
```

Replace it with:

```typescript
  // Filter the navbar by mute state when the user has enabled "Hide muted Spaces".
  // The filter applies HERE — before useNavItems — so its empty-folder cascade
  // (useNavItems.ts:69) automatically hides folders containing only muted spaces.
  const hideMutedSpacesFromSidebar = config?.hideMutedSpacesFromSidebar ?? false;
  const filteredSpaces = React.useMemo(() => {
    if (!hideMutedSpacesFromSidebar) return spaces;
    return spaces.filter(
      (s) => !(config?.notificationSettings?.[s.spaceId]?.isMuted ?? false)
    );
  }, [spaces, hideMutedSpacesFromSidebar, config?.notificationSettings]);

  const { navItems, allSpaces } = useNavItems(filteredSpaces, config);
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/navbar/NavMenu.tsx
git commit -m "feat(navbar): add /spaces entry + hide-muted-spaces filter"
```

---

## Task 17: Smoke test PR 1 in dev mode

**Files:**
- None modified; verification only.

- [ ] **Step 1: Lint + format**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
yarn lint
yarn format
```

Expected: both pass cleanly. If lint surfaces issues in newly-added files, fix them and re-run. If format changes files, stage and amend the relevant commit (or add a new commit `chore: format new files`).

- [ ] **Step 2: Production build**

```bash
yarn build
```

Expected: build succeeds.

- [ ] **Step 3: Start dev server**

```bash
yarn dev
```

Note the URL printed (typically `http://localhost:5173`).

- [ ] **Step 4: Smoke test (manual) — coordinate with user**

Open the dev URL in a browser with `?spaces=30` appended (e.g. `http://localhost:5173/?spaces=30`), log in to an existing test account, then verify each checkbox:

- [ ] Navbar shows the new `icon-layout-grid-add` icon at the top of the space list (above the existing space icons; below the DM icon)
- [ ] Clicking it navigates to `/spaces`
- [ ] `/spaces` opens on "My Spaces" tab by default
- [ ] My Spaces shows the test account's actual spaces (could be zero or many)
- [ ] "Find a Space" search filters the My Spaces grid by name (case-insensitive substring)
- [ ] Folder filter dropdown lists "All folders" + the user's existing folders. Selecting a folder filters the grid to that folder's spaces.
- [ ] Owner badge appears on spaces the user owns (verify with a known owned space)
- [ ] "Hide muted Spaces from sidebar" toggle starts in OFF state for a fresh user
- [ ] Muting a space via the existing navbar context menu (right-click → Mute Space) keeps it visible in My Spaces (full inventory) regardless of toggle
- [ ] Turning the toggle ON immediately hides that muted space from the navbar (no reload)
- [ ] Turning the toggle OFF makes the muted space reappear in the navbar
- [ ] Toggle state persists across page reload (synced via `UserConfig`)
- [ ] Folders containing only muted spaces are hidden from the navbar when toggle is ON
- [ ] Folders with mixed muted + non-muted spaces show only non-muted children when toggle is ON
- [ ] Clicking the Discover tab switches to Discover content
- [ ] Discover shows 30 mock spaces spread across categories
- [ ] Discover search debounces and filters mocks by name
- [ ] Category dropdown filters mocks to selected category
- [ ] "Load more" appears and works if filtered mock count exceeds page size (20)
- [ ] Clicking "Join" on a public-space card triggers `useSpaceJoining`. (Will fail on mock data — that's expected; verify the error path is reasonable.)
- [ ] Existing navbar `+` button still works (opens `AddSpaceModal`, paste-invite + create flows unchanged)
- [ ] Existing deep-link invite URL handler still works (visit `/invite/#...` URL → `InviteRoute` opens `JoinSpaceModal`)
- [ ] Direct navigation to `/spaces?tab=discover` lands on the Discover tab
- [ ] Refreshing on `/spaces?tab=discover` preserves the active tab
- [ ] No regressions in existing space list, channel views, DM views

If any item fails, fix in a new commit (`fix(spaces-page): <description>`) and re-test the affected items.

- [ ] **Step 5: Stop the dev server**

Ctrl+C in the terminal running `yarn dev`.

---

## Task 18: Drop mobile-side tasks for shared promotion + banner request

**Files:**
- Create: `D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-01-adopt-shared-directory-types.md`
- Create: `D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-01-add-banner-to-directory-entry.md`
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/quorum-shared-migration/mobile-tasks-pending.md`

- [ ] **Step 1: Create the directory-types adoption task**

Create `D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-01-adopt-shared-directory-types.md`:

```markdown
---
type: task
title: "Mobile: adopt shared DirectoryEntry / DirectoryResponse / SpaceCategory types"
status: open
created: 2026-06-01
runtime-test: not-required
shared-version: 2.1.0-22
desktop-pr: <fill in after desktop PR opens>
shared-pr: <fill in after shared PR is merged>
---

# Adopt shared directory types

## What

Mobile defines `DirectoryEntry` and `DirectoryResponse` locally in `services/api/quorumClient.ts:67-84`. These wire shapes were promoted to `@quilibrium/quorum-shared` as part of desktop's discover-spaces port. Mobile can swap the local types for shared imports.

## Why

Single source of truth for wire shapes. Both apps consume the same `/directory` endpoint; both should use the same types.

## Static verification

```bash
# Confirm no other consumers of the local types
git -C "D:/GitHub/Quilibrium/quorum-mobile" grep -E "DirectoryEntry|DirectoryResponse|SpaceCategory" -- "*.ts" "*.tsx" | grep -v quorumClient.ts
```

If the grep shows only the local definitions and re-exports, the swap is safe.

## File changes

1. In `services/api/quorumClient.ts`:
   - Delete local `DirectoryEntry` and `DirectoryResponse` interfaces (lines 67-84)
   - Add import: `import type { DirectoryEntry, DirectoryResponse, SpaceCategory } from '@quilibrium/quorum-shared';`
   - Update consumers in this file to use the shared types (the local methods returning these shapes)

2. Bump shared dep to `^2.1.0-22` (or whatever version Task 3 of the desktop plan published) in `package.json`.

3. Run `yarn install` to update the lockfile.

4. `yarn tsc --noEmit` clean.

## Pre-filled PR description

```
## What
Adopt shared DirectoryEntry / DirectoryResponse / SpaceCategory types.

## Cross-repo migration
- **quorum-shared**: ✅ MERGED — Org/Repo#NN (version 2.1.0-22)
- **quorum-desktop**: ✅ MERGED — Org/Repo#NN
- **quorum-mobile**: THIS PR

## Why this is safe to merge whenever
Mobile has been on the old shared version (`2.1.0-21`) the whole time and continues to work. This PR bumps mobile and swaps local types for shared imports. No runtime change, no production behavior affected by merge timing.

## Verification
- [x] `yarn tsc --noEmit` clean
- [x] `yarn lint` clean
- [x] Grep confirms no residual references to the local types
```
```

- [ ] **Step 2: Create the banner-request task**

Create `D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-01-add-banner-to-directory-entry.md`:

```markdown
---
type: task
title: "Server: add banner field to DirectoryEntry"
status: open
created: 2026-06-01
runtime-test: required
desktop-pr: <fill in after desktop PR opens>
---

# Add banner field to DirectoryEntry server response

## What

Spaces on Quorum have a `Space.bannerUrl` field (uploaded via desktop's `SpaceSettingsModal.General.tsx`, defined in `quorum-shared/src/types/space.ts:71`). The `/directory` server endpoint currently returns `icon` on `DirectoryEntry` but not `banner`. Add the banner field to the server's `/directory` response, sourcing from each space's existing `bannerUrl`.

## Why

Enables Discord-style hero cards on the Discover surface (both apps). Current PR 1 of desktop's discover-spaces port uses a side-by-side card layout because no banner data is available; when the server exposes banners, both apps can promote to a hero shape.

## File changes (server-side; outside this repo)

This is a request to the Quorum server team. The mobile and desktop repos can't ship the change without server cooperation.

Suggested protocol:
- Add `banner` (string, image URL or data URI) to the `DirectoryEntry` JSON shape
- Source from the registered space's `bannerUrl` field at directory-listing time
- Empty string when no banner uploaded (don't omit; preserves stable shape)

## After server ships

1. Shared additive PR: extend `DirectoryEntry` interface with `banner?: string` (optional initially for backward compat with older servers; promote to required if/when desktop drops support for pre-banner servers).
2. Each app's `SpaceCard variant="public"` can be redesigned to use the banner as a hero element.

## Runtime test

Required: verify the live `/directory` endpoint returns the new field for a space with a banner uploaded.
```

- [ ] **Step 3: Add rows to `mobile-tasks-pending.md`**

Open `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/quorum-shared-migration/mobile-tasks-pending.md`. Add two new rows to the queued tasks table (or section, depending on the file's structure):

```markdown
| 2026-06-01 | Adopt shared DirectoryEntry / DirectoryResponse / SpaceCategory (shared 2.1.0-22) | `quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-01-adopt-shared-directory-types.md` | Static-verifiable swap (no runtime test). Triggered by desktop's discover-spaces port. |
| 2026-06-01 | Server: add `banner` field to DirectoryEntry response | `quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-01-add-banner-to-directory-entry.md` | Server-side change; enables Discord-style hero cards on Discover in both apps. |
```

(Adjust the exact column structure to match the file's existing format — read the file first to confirm.)

- [ ] **Step 4: Regenerate mobile INDEX**

```bash
cd "D:/GitHub/Quilibrium/quorum-mobile"
python .agents/update-index.py
```

Expected: prints something like "INDEX.md regenerated" (or similar; the exact output depends on the script). No errors.

- [ ] **Step 5: Commit the desktop-side `mobile-tasks-pending.md` update**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
git add .agents/tasks/quorum-shared-migration/mobile-tasks-pending.md
git commit -m "docs(shared-migration): queue mobile tasks for directory types + banner request"
```

(The mobile-side task files are gitignored on mobile by convention — see the shared-migration workflow doc. Do not commit them.)

---

## Task 19: Move PR 1 task file to `.done/` + update shipped-log

**Files:**
- Move: `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/port-from-mobile/2026-06-01-port-discover-spaces.md` → `.done/`
- Move: `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/port-from-mobile/2026-06-01-port-discover-spaces-plan.md` → `.done/`
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/port-from-mobile/shipped-log.md`
- Modify: `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/port-from-mobile/README.md` (status table)

- [ ] **Step 1: Confirm PR 1 has been opened, smoke-tested, and self-merged**

This step is gated on the desktop PR being merged. If the PR is still in review, STOP here and do not proceed until the PR ships.

- [ ] **Step 2: Move task files**

```bash
cd "D:/GitHub/Quilibrium/quorum-desktop"
git mv .agents/tasks/port-from-mobile/2026-06-01-port-discover-spaces.md .agents/tasks/port-from-mobile/.done/
git mv .agents/tasks/port-from-mobile/2026-06-01-port-discover-spaces-plan.md .agents/tasks/port-from-mobile/.done/
```

- [ ] **Step 3: Add shipped-log entry**

Open `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/port-from-mobile/shipped-log.md`. Below the existing "Top-level lessons" section and the "2026-06-01 — folder scaffolded" entry, add a new entry:

```markdown
## 2026-06-01 (later) — Unified /spaces page PR 1 shipped

Shipped the foundation of the unified `/spaces` page: new route, two tabs (My Spaces + Discover), navbar entry, mock fixture, and the "Hide muted Spaces from sidebar" toggle.

- Shared PR: `quorum-shared@2.1.0-22` — adds DirectoryEntry, DirectoryResponse, SpaceCategory, UserConfig.hideMutedSpacesFromSidebar (purely additive)
- Desktop PR: <fill in PR URL>
- Mobile: two task drops queued in mobile-tasks-pending.md (adopt shared directory types + request server-side banner field on DirectoryEntry)
- PR 2 (deferred): committed within 2-4 weeks per `2026-06-01-port-discover-spaces-pr2.md` — adds Join via link tab + Create space tab, retires AddSpaceModal + CreateSpaceModal, removes navbar `+` button.

### Lessons

- Pre-flight investigation to resolve "follow existing pattern" hand-waves before writing the plan was essential. The `UserConfig` write pattern (5-step dance: read → build → optimistic-cache → enqueue → invalidate) and the `useNavItems` empty-folder-cascade insight (filter `spaces` BEFORE passing in) saved real implementation time.
- `formatMemberCount` is exported from shared — mobile's inline implementation in `discover.tsx` is duplicate code worth flagging if it ever migrates.
- No `Tabs` primitive exists today; tabs were rendered inline as styled `Button` elements. A `Tabs` primitive could be promoted to shared later as a follow-up if more pages need them.
```

- [ ] **Step 4: Update status table in README.md**

Open `D:/GitHub/Quilibrium/quorum-desktop/.agents/tasks/port-from-mobile/README.md`. Find the status table row for `Unified /spaces page — PR 1`. Change its status column from `🟢 ready to start` to `✅ shipped` and add the PR URL to the reference column.

- [ ] **Step 5: Commit the closure**

```bash
git add .agents/tasks/port-from-mobile/
git commit -m "docs(port-from-mobile): close PR 1 — unified /spaces page shipped"
```

---

## Self-Review Checklist

Run this checklist after the plan is complete and saved. Fix any issues inline.

**1. Spec coverage:** Skim each section of the source spec (`2026-06-01-port-discover-spaces.md`). Can you point to a task that implements it?

- [x] Decision 1 (dedicated route): Task 14 + Task 15
- [x] Decision 2 (navbar entry point): Task 16
- [x] Decision 3 (4 tabs, ship only 2 in PR 1): Task 14
- [x] Decision 4 (PR 1 ships tabs 1+2): Task 14
- [x] Decision 5 (PR 2 committed): captured in companion `2026-06-01-port-discover-spaces-pr2.md`
- [x] Decision 6 (category list verbatim): Task 1 + Task 9 (SPACE_CATEGORIES)
- [x] Decision 7 (shared promotion): Task 1, Task 2, Task 3
- [x] Decision 8 (skip reportSpace): not in scope; no task
- [x] Decision 9 (mock semantics replace): Task 9 (mockEnabled branch)
- [x] Decision 10 (search + Select filter pattern, both tabs): Task 12 + Task 13
- [x] Decision 11 (My Spaces bare grid + search + folder filter): Task 12
- [x] Decision 12 (side-by-side card design): Task 11
- [x] Decision 13 (hide muted Spaces feature): Task 2 + Task 5 + Task 10 + Task 12 + Task 16
- [x] Decision 14 (banner field server request): Task 18

**2. Placeholder scan:** Search the plan for red flags.

Known intentional escapes:
- Task 12 `MySpaceCard` inner component uses `require()` — flagged as a fallback if normal import causes circular issues. Replace at implementation time with a top-of-file import if it works.
- Task 17 (smoke test) has no exact bash commands for "click X in the UI" — this is intentional (smoke tests are visual, not CLI).
- Task 18 references "fill in PR URL after desktop PR opens" — those are inherently late-binding fields that can't be resolved at plan-time.
- Task 19 has a gate: "if the PR is still in review, STOP." This is intentional — the task is post-merge cleanup.

No other placeholders found.

**3. Type consistency:**
- `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` — defined Task 1, consumed Task 7, Task 8, Task 9, Task 11, Task 13. Names match throughout.
- `UserConfig.hideMutedSpacesFromSidebar` — defined Task 2 (shared) + Task 5 (desktop mirror), consumed Task 10, Task 12, Task 16. Field name matches throughout.
- `useExploreSpaces` return shape: defined Task 9 (`{ entries, total, hasMore, isLoading, error, search, setSearch, category, setCategory, loadMore, refetch, offset }`), consumed Task 13. Field names match.
- `useHideMutedSpaces` return shape: defined Task 10 (`{ hideMutedSpaces, toggleHideMutedSpaces }`), consumed Task 12. Field names match.

All consistent.

---

## Execution Handoff

Plan complete and saved to `.agents/tasks/port-from-mobile/2026-06-01-port-discover-spaces-plan.md` (path overridden from default `docs/superpowers/plans/` per global CLAUDE.md).

Two execution options:

**1. Subagent-Driven** — dispatch a fresh subagent per task, review between tasks, fast iteration. NOT recommended for this work per the prior discussion: desktop's pattern density (Lingui, primitives, hook conventions, SCSS variables, existing folder/mute infra) is the kind of thing subagents tend to get wrong; the coordination cost likely exceeds the time savings.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch execution with checkpoints for user review. **Recommended.**

Which approach?
