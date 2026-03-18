# Utilities Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate platform-agnostic utility functions from quorum-desktop to quorum-shared (PR #3 in stacked PRs workflow).

**Architecture:** Copy desktop's production utils to shared, replace shared's basic overlapping versions, update desktop to re-export from shared, delete local source files. Same pattern as primitives migration (PR #2).

**Tech Stack:** TypeScript, tsup (shared build), Vite (desktop bundler), dayjs, unified/remark (markdown processing), multiformats (base58)

**Spec:** `.agents/tasks/2026-03-18-utils-migration-design.md`

---

## File Structure

### quorum-shared — files to create/modify

| File | Action |
|------|--------|
| `src/utils/index.ts` | Modify — add re-exports for all new modules |
| `src/utils/validation.ts` | Replace — desktop's 15-function version |
| `src/utils/mentions.ts` | Replace — merge desktop's 7 functions with shared's existing `parseMentions`/`formatMention` |
| `src/utils/formatting.ts` | Replace — remove date functions, keep `truncateText`/`formatFileSize`/`formatMemberCount` |
| `src/utils/formatMentionCount.ts` | Create |
| `src/utils/permissions.ts` | Create |
| `src/utils/channelPermissions.ts` | Create |
| `src/utils/channelUtils.ts` | Create — `findChannelByName` only |
| `src/utils/messageGrouping.ts` | Create — replace `./dayjs` import with direct dayjs + plugin setup |
| `src/utils/messageLinkUtils.ts` | Create |
| `src/utils/messagePreview.ts` | Create — strip @lingui |
| `src/utils/markdownFormatting.ts` | Create |
| `src/utils/markdownStripping.ts` | Create |
| `src/utils/codeFormatting.ts` | Create |
| `src/utils/rateLimit.ts` | Create |
| `src/utils/avatar.ts` | Create |
| `src/utils/canonicalize.ts` | Create — strip @lingui |
| `src/utils/clipboard.ts` | Create — strip @lingui |
| `src/utils/notificationSettingsUtils.ts` | Create — move notification types inline or to shared types |
| `src/utils/inviteDomain.ts` | Create — refactor `window.location` to use `getEnvironmentInfo()` |
| `src/utils/environmentDomains.ts` | Create — guard `window.location` with `typeof window` check (already partially done) |
| `src/utils/youtubeUtils.ts` | Create |
| `src/utils/dayjs.ts` | Create — dayjs config with plugins (shared between messageGrouping and any future consumers) |
| `package.json` | Modify — add dependencies |

### quorum-desktop — files to modify/delete

| File | Action |
|------|--------|
| `src/utils/index.ts` | Create — barrel re-exporting from `@quilibrium/quorum-shared` + local utils |
| `src/utils/bytes.ts` | Delete — use `int64ToBytes` from shared encoding |
| All 21 migrated `.ts` files | Delete source (keep only in shared) |
| `src/utils/channelUtils.ts` | Keep — but remove `findChannelByName` (now from shared), keep `isChannelMuted`/`getMutedChannelsForSpace` |
| Various component/hook files | Modify — update imports to use barrel or `@quilibrium/quorum-shared` |

---

## Task 1: Create Branches

**Files:** None (git operations only)

- [ ] **Step 1: Create branch on quorum-shared**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git checkout feat/shared-primitives-migration
git pull origin feat/shared-primitives-migration
git checkout -b feat/shared-utils-migration
```

- [ ] **Step 2: Create branch on quorum-desktop**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git checkout feat/shared-primitives-migration
git pull origin feat/shared-primitives-migration
git checkout -b feat/shared-utils-migration
```

- [ ] **Step 3: Verify link: dependency is active**

In `d:/GitHub/Quilibrium/quorum-desktop/package.json`, confirm `"@quilibrium/quorum-shared": "link:../quorum-shared"` is set. If not, set it and run `yarn install`.

---

## Task 2: Add Dependencies to quorum-shared

**Files:**
- Modify: `d:/GitHub/Quilibrium/quorum-shared/package.json`

- [ ] **Step 1: Add new dependencies**

Add to `dependencies`:
```json
{
  "dayjs": "^1.11.0",
  "multiformats": "^13.0.0",
  "unified": "^11.0.0",
  "remark-parse": "^11.0.0",
  "remark-gfm": "^4.0.0",
  "remark-stringify": "^11.0.0",
  "strip-markdown": "^6.0.0"
}
```

Check the exact versions used in `d:/GitHub/Quilibrium/quorum-desktop/package.json` and match them.

- [ ] **Step 2: Install dependencies**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn install
```

- [ ] **Step 3: Verify build still works**

```bash
yarn build
```

Expected: Build succeeds with no errors.

---

## Task 3: Migrate Pure Utility Files (No Dependencies, No Refactoring)

These files have zero imports from desktop modules, no @lingui, no DOM APIs. Straight copy.

**Files to create in `d:/GitHub/Quilibrium/quorum-shared/src/utils/`:**
- `permissions.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/permissions.ts`
- `channelPermissions.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/channelPermissions.ts`
- `markdownFormatting.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/markdownFormatting.ts`
- `codeFormatting.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/codeFormatting.ts`
- `formatMentionCount.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/formatMentionCount.ts`
- `rateLimit.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/rateLimit.ts`
- `avatar.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/avatar.ts`
- `youtubeUtils.ts` — copy from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/youtubeUtils.ts`

- [ ] **Step 1: Copy all 8 files**

Copy each file from desktop to shared. All imports reference `@quilibrium/quorum-shared` types (already available) or have no imports at all.

- [ ] **Step 2: Verify type imports resolve**

`permissions.ts` and `channelPermissions.ts` import from `@quilibrium/quorum-shared`. In shared, change these to relative imports:
- `import type { Permission, Role, Space } from '@quilibrium/quorum-shared'` → `import type { Permission, Role, Space } from '../types'`
- Same pattern for all shared type imports

- [ ] **Step 3: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

Expected: Build succeeds.

---

## Task 4: Migrate Files Requiring @lingui Stripping (No Other Dependencies)

These files use `@lingui/core/macro` `t` function. Replace with plain English strings.

**Files:**
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/canonicalize.ts`
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/clipboard.ts`

- [ ] **Step 1: Copy canonicalize.ts**

Copy from desktop. Remove `import { t } from '@lingui/core/macro'`. Replace:
- `t\`invalid message type\`` → `'invalid message type'`

Update `@quilibrium/quorum-shared` type imports to relative paths.

- [ ] **Step 2: Copy clipboard.ts**

Copy from desktop. Remove `import { t } from '@lingui/core/macro'`. Replace all `t` tagged template literals with plain English strings:
- `t\`[Image]\`` → `'[Image]'`
- `t\`[Sticker: ${...}]\`` → `` `[Sticker: ${...}]` ``
- etc.

Update type imports to relative paths.

- [ ] **Step 3: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

---

## Task 5: Migrate Files with npm Dependencies

These files import from npm packages that need to be available in shared.

**Files:**
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/validation.ts` (replace existing)
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/markdownStripping.ts`
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/messagePreview.ts`
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/dayjs.ts`
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/messageGrouping.ts`

- [ ] **Step 1: Replace validation.ts**

Replace shared's existing `validation.ts` with desktop's version. Desktop imports `multiformats/bases/base58` (added in Task 2). Check if shared's current version has a `sanitizeContent` function not present in desktop's version — if so, append it to the new file. Set `MAX_MESSAGE_LENGTH` to `2500`.

- [ ] **Step 2: Copy markdownStripping.ts**

Copy from desktop. Imports `unified`, `remark-parse`, `remark-gfm`, `remark-stringify`, `strip-markdown` (added in Task 2). Also imports `logger` from `@quilibrium/quorum-shared` — change to relative: `import { logger } from './logger'`.

- [ ] **Step 3: Copy messagePreview.ts**

Copy from desktop. Remove `import { t } from '@lingui/core/macro'`. Replace `t` strings with plain English. Update type imports to relative paths. This file imports `./markdownStripping` — it resolves to the file created in Step 2 above.

- [ ] **Step 4: Create dayjs.ts**

Create `d:/GitHub/Quilibrium/quorum-shared/src/utils/dayjs.ts`. This is a new file in shared (desktop's `dayjs.ts` also stays local — both repos have their own copy of this config):

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(calendar);

export default dayjs;
```

- [ ] **Step 5: Copy messageGrouping.ts**

Copy from desktop. Change `import dayjs from './dayjs'` — this now resolves to the shared dayjs.ts created above. Update type imports to relative paths.

- [ ] **Step 6: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

---

## Task 6: Migrate Mention Utils (Merge with Existing)

**Files:**
- Modify: `d:/GitHub/Quilibrium/quorum-shared/src/utils/mentions.ts` (replace + merge)

- [ ] **Step 1: Replace mentions.ts**

Replace shared's `mentions.ts` with desktop's `mentionUtils.ts` content. Then add back shared's existing `parseMentions`, `formatMention`, `MENTION_PATTERNS`, and `ParsedMention` type that desktop doesn't have.

Desktop's file imports:
- `@quilibrium/quorum-shared` types → change to relative `../types`
- `./validation` (createIPFSCIDRegex) → resolves to the new validation.ts from Task 5

- [ ] **Step 2: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

---

## Task 7: Migrate Environment & Invite Domain Utils (window.location Refactoring)

**Files:**
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/environmentDomains.ts`
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/inviteDomain.ts`

- [ ] **Step 1: Copy environmentDomains.ts**

Copy from desktop. This file already has a `typeof window === 'undefined'` guard that returns production defaults for non-browser environments (line 20-26). This is sufficient for React Native — mobile will get production domain defaults, which is correct behavior. No refactoring needed.

- [ ] **Step 2: Copy inviteDomain.ts**

Copy from desktop. This file also has `typeof window !== 'undefined'` guards (line 15). Update imports:
- `import { logger } from '@quilibrium/quorum-shared'` → `import { logger } from './logger'`
- `import { buildValidPrefixes, getEnvironmentInfo } from './environmentDomains'` — resolves locally

- [ ] **Step 3: Copy messageLinkUtils.ts**

Copy from desktop. Imports `./environmentDomains` — resolves locally now.

- [ ] **Step 4: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

---

## Task 8: Migrate Notification Settings Utils

**Files:**
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/notificationSettingsUtils.ts`

- [ ] **Step 1: Move notification types to shared**

Desktop's `src/types/notifications.ts` defines `NotificationTypeId`, `NotificationSettings`, `NotificationSettingOption`, `ReplyNotification`. These are simple interfaces with only a `Message` import from shared.

Option A: Add these types directly to quorum-shared's types module.
Option B: Define them inline in `notificationSettingsUtils.ts`.

Choose Option A if these types are used elsewhere in desktop (check imports). Choose Option B if only `notificationSettingsUtils.ts` uses them.

Check: `grep -r "NotificationTypeId\|NotificationSettings\|NotificationSettingOption\|ReplyNotification" d:/GitHub/Quilibrium/quorum-desktop/src/ --include="*.ts" --include="*.tsx" -l`

- [ ] **Step 2: Copy notificationSettingsUtils.ts**

Copy from desktop. Update the import to use the shared types (from Step 1).

- [ ] **Step 3: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

---

## Task 9: Migrate channelUtils.ts (Partial)

**Files:**
- Create: `d:/GitHub/Quilibrium/quorum-shared/src/utils/channelUtils.ts`

- [ ] **Step 1: Copy findChannelByName only**

Create the file with only the `findChannelByName` function from desktop's `channelUtils.ts`. Import `Channel` type from relative path. Import `logger` from `./logger`.

Do NOT include `isChannelMuted` or `getMutedChannelsForSpace` — they depend on `UserConfig` from desktop's DB layer.

- [ ] **Step 2: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

---

## Task 10: Update formatting.ts (Replace)

**Files:**
- Modify: `d:/GitHub/Quilibrium/quorum-shared/src/utils/formatting.ts`

- [ ] **Step 1: Replace formatting.ts**

Remove all date formatting functions (`formatTime`, `formatDate`, `formatDateTime`, `formatRelativeTime`, `formatMessageDate`, `isSameDay`). Keep:
- `truncateText`
- `formatFileSize`
- `formatMemberCount`

`formatMentionCount` is already a separate file (copied in Task 3) — do not duplicate it here. It's exported via the barrel.

- [ ] **Step 2: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

---

## Task 11: Update Barrel Export

**Files:**
- Modify: `d:/GitHub/Quilibrium/quorum-shared/src/utils/index.ts`

- [ ] **Step 1: Add all new modules to barrel**

Add re-exports for every new file:

```typescript
export * from './validation';
export * from './mentions';
export * from './formatting';
export * from './encoding';
export * from './logger';
export * from './permissions';
export * from './channelPermissions';
export * from './channelUtils';
export * from './messageGrouping';
export * from './messageLinkUtils';
export * from './messagePreview';
export * from './markdownFormatting';
export * from './markdownStripping';
export * from './codeFormatting';
export * from './formatMentionCount';
export * from './rateLimit';
export * from './avatar';
export * from './canonicalize';
export * from './clipboard';
export * from './notificationSettingsUtils';
export * from './inviteDomain';
export * from './environmentDomains';
export * from './youtubeUtils';
export { default as dayjs } from './dayjs';
```

- [ ] **Step 2: Check for export name collisions**

Multiple files may export identically-named types or functions. Run build and check for conflicts:

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

Resolve any collisions by renaming or using named re-exports.

- [ ] **Step 3: Full build verification**

```bash
yarn build
```

Expected: 0 errors. All 3 outputs (index.mjs, index.js, index.native.js) generated.

---

## Task 12: Commit on quorum-shared

**Files:** All changes from Tasks 2-11

- [ ] **Step 1: Commit dependencies separately**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git add package.json yarn.lock
git commit -m "Add dependencies for utils migration (dayjs, multiformats, unified, remark)"
```

- [ ] **Step 2: Commit all utility files as one atomic commit**

```bash
git add src/utils/
git commit -m "Migrate utility functions from quorum-desktop

Replaces basic validation/mentions/formatting with desktop's production versions.
Adds 17 new utility modules: permissions, channelPermissions, messageGrouping,
markdownFormatting, markdownStripping, codeFormatting, rateLimit, avatar,
canonicalize, clipboard, messagePreview, messageLinkUtils, environmentDomains,
inviteDomain, notificationSettingsUtils, channelUtils, youtubeUtils.

Strips @lingui from canonicalize, clipboard, messagePreview (plain English defaults).
MAX_MESSAGE_LENGTH set to 2500."
```

- [ ] **Step 3: If notification types were moved to shared types (Task 8), commit separately**

```bash
git add src/types/
git commit -m "Add notification settings types for utils migration"
```

---

## Task 13: Update quorum-desktop Imports

**Files:**
- Create: `d:/GitHub/Quilibrium/quorum-desktop/src/utils/index.ts`
- Modify: Various component/hook files that import from utils subpaths

- [ ] **Step 1: Create utils barrel export**

Create `d:/GitHub/Quilibrium/quorum-desktop/src/utils/index.ts` that re-exports utils from shared. Do NOT use `export * from '@quilibrium/quorum-shared'` — that would re-export everything (types, primitives, hooks, etc.), causing collisions. Instead, re-export specific utils modules:

```typescript
// Re-export shared utilities
export * from '@quilibrium/quorum-shared/utils';
```

If the above doesn't work with the package's export map, use named imports instead — list each util module explicitly. The primitives migration barrel can serve as a reference for the pattern used there.

Also re-export local-only utilities:

```typescript
// Local-only utilities (DOM-specific, stay in desktop)
export * from './dateFormatting';
export * from './mentionPillDom';
export * from './mentionHighlighting';
export * from './modalPositioning';
export * from './toolbarPositioning';
export * from './caretCoordinates';
export * from './cursor';
export * from './messageHashNavigation';
export * from './toast';
```

- [ ] **Step 2: Find all files importing from migrated utils**

Search for imports from each migrated file:

```bash
grep -r "from.*utils/validation\|from.*utils/mentionUtils\|from.*utils/permissions\|from.*utils/channelPermissions\|from.*utils/messageGrouping\|from.*utils/messageLinkUtils\|from.*utils/messagePreview\|from.*utils/markdownFormatting\|from.*utils/markdownStripping\|from.*utils/codeFormatting\|from.*utils/formatMentionCount\|from.*utils/rateLimit\|from.*utils/avatar\|from.*utils/canonicalize\|from.*utils/clipboard\|from.*utils/notificationSettingsUtils\|from.*utils/inviteDomain\|from.*utils/environmentDomains\|from.*utils/youtubeUtils\|from.*utils/bytes" d:/GitHub/Quilibrium/quorum-desktop/src/ --include="*.ts" --include="*.tsx" -l
```

- [ ] **Step 3: Update imports to use barrel or @quilibrium/quorum-shared**

For each file found in Step 2, update the import to either:
- `import { functionName } from '@quilibrium/quorum-shared'` (direct from shared)
- `import { functionName } from '../utils'` (via barrel)

Follow whichever pattern is more consistent with the codebase.

- [ ] **Step 4: Update channelUtils.ts**

Desktop's `channelUtils.ts` keeps `isChannelMuted` and `getMutedChannelsForSpace` but loses `findChannelByName`. Update to re-export `findChannelByName` from shared:

```typescript
// Re-export from shared
export { findChannelByName } from '@quilibrium/quorum-shared';

// Desktop-only (depends on UserConfig from db/messages)
import type { UserConfig } from '../db/messages';
// ... keep isChannelMuted and getMutedChannelsForSpace
```

---

## Task 14: Delete Local Source Files from quorum-desktop

**Files to delete:**

- [ ] **Step 1: Delete migrated source files**

Delete these files from `d:/GitHub/Quilibrium/quorum-desktop/src/utils/`:
- `validation.ts`
- `mentionUtils.ts`
- `permissions.ts`
- `channelPermissions.ts`
- `messageGrouping.ts`
- `messageLinkUtils.ts`
- `messagePreview.ts`
- `markdownFormatting.ts`
- `markdownStripping.ts`
- `codeFormatting.ts`
- `formatMentionCount.ts`
- `rateLimit.ts`
- `avatar.ts`
- `canonicalize.ts`
- `clipboard.ts`
- `notificationSettingsUtils.ts`
- `inviteDomain.ts`
- `environmentDomains.ts`
- `youtubeUtils.ts`
- `bytes.ts`

Do NOT delete: `channelUtils.ts` (partial migration — still has local functions), `dateFormatting.ts`, `dayjs.ts`, DOM-specific files, `mock/`, `imageProcessing/`.

- [ ] **Step 2: Verify web app builds and loads**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
yarn build
```

Then start dev server and verify the app loads correctly.

---

## Task 15: Verify Mobile Compatibility

- [ ] **Step 1: Verify Metro bundle**

If mobile test screens are set up, verify Metro can still bundle:

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
yarn mobile
```

Expected: Bundle succeeds, no import resolution errors.

- [ ] **Step 2: Check for accidental DOM APIs in shared**

Run a quick check that no `window.` or `document.` usage snuck into shared without proper guards:

```bash
grep -r "window\.\|document\.\|navigator\." d:/GitHub/Quilibrium/quorum-shared/src/utils/ --include="*.ts" | grep -v "typeof window"
```

Any hits (except in `environmentDomains.ts` and `inviteDomain.ts` which have guards) need `typeof window !== 'undefined'` guards.

---

## Task 16: Commit on quorum-desktop

- [ ] **Step 1: Commit import updates**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add -A
git commit -m "Update imports to use shared utilities from @quilibrium/quorum-shared"
```

- [ ] **Step 2: Commit file deletions**

```bash
git add -A
git commit -m "Remove local utility source files (now in quorum-shared)

Deleted 20 utility files (-X,XXX lines). Utilities are now imported
from @quilibrium/quorum-shared. DOM-specific utils remain local."
```

---

## Task 17: Handle Test Files

**Files:**
- `d:/GitHub/Quilibrium/quorum-desktop/src/utils/channelPermissions.test.ts`
- `d:/GitHub/Quilibrium/quorum-desktop/src/dev/tests/utils/mentionUtils.enhanced.test.ts`
- `d:/GitHub/Quilibrium/quorum-desktop/src/dev/tests/utils/reservedNames.test.ts`
- `d:/GitHub/Quilibrium/quorum-desktop/src/dev/tests/utils/messageGrouping.unit.test.ts`

- [ ] **Step 1: Update test imports**

Each test file imports from local utils paths. Update to import from shared:
- `from '../../utils/validation'` → `from '@quilibrium/quorum-shared'`
- `from '../../utils/mentionUtils'` → `from '@quilibrium/quorum-shared'`
- etc.

- [ ] **Step 2: Handle dayjs dependency in messageGrouping test**

`messageGrouping.unit.test.ts` imports `dayjs` from desktop's local `./dayjs`. Update to import from `@quilibrium/quorum-shared` (which now exports `dayjs`).

- [ ] **Step 3: Run tests**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
yarn test
```

Fix any failures. Tests should pass with shared imports.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Update test imports for shared utils migration"
```

---

## Task 18: Final Verification

- [ ] **Step 1: Full build on quorum-shared**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

- [ ] **Step 2: Full build on quorum-desktop**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
yarn build
```

- [ ] **Step 3: Run linting**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
yarn lint
```

- [ ] **Step 4: Manual smoke test**

Start the dev server and verify:
- App loads without errors
- Navigate between spaces/channels
- Open modals (create space, settings, etc.)
- Send a message
- Check that mentions work
- Check that markdown formatting works

---

## Notes

- **Before merging PRs**: Switch `link:../quorum-shared` back to published version in package.json
- **Mobile review needed**: Once read access to updated quorum-mobile is available, verify the migration doesn't break mobile and that mobile could adopt shared's formatting utils
- **Notification types**: If moved to shared (Task 8), this adds scope to the types module — note this for the types PR if it hasn't merged yet

---

_Created: 2026-03-18_
