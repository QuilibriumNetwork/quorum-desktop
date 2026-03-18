---
type: spec
title: "Utilities Migration: quorum-desktop → quorum-shared"
status: draft
created: 2026-03-18
depends_on:
  - "tasks/2026-03-15-primitives-migration-prep.md"
  - "tasks/2026-03-15-stacked-prs-workflow.md"
---

# Utilities Migration Design

Migrate platform-agnostic utility functions from quorum-desktop to quorum-shared so that all Quorum apps (desktop, mobile, future apps) share a single source of truth for business logic and pure utility functions.

## Context

quorum-shared serves as both a UI kit (primitives) and a Quorum business logic package. It's consumed by quorum-desktop (web) and quorum-mobile (React Native), and will be used by future Quorum apps.

The primitives migration (PR #2) established the pattern: copy production code to shared, update desktop to re-export from shared, delete local source files. This migration follows the same pattern for utilities.

### Prior Art

- **Types migration** (PR #1): Shared types between repos
- **Primitives migration** (PR #2): 18 primitives moved to shared with `.web.tsx`/`.native.tsx` splits
- **Business logic extraction** (Phase 1 complete): 230+ hooks extracted into `business/` folders

### Current State of Shared Utils

quorum-shared already has 5 utility modules: `encoding.ts`, `formatting.ts`, `mentions.ts`, `validation.ts`, `logger.ts`. Audit findings:

| Module | Shared status | Desktop status | Mobile uses it? |
|--------|--------------|----------------|-----------------|
| encoding | 7 functions, production-ready | `bytes.ts` — 1 function (subset) | Yes (`bytesToHex`, `hexToBytes`, `int64ToBytes`) |
| formatting | 8 basic functions (native Date API) | `dateFormatting.ts` — 3 functions (dayjs + @lingui) | No — has own local implementations |
| mentions | 3 parse-only functions | 7 functions with word boundaries, IPFS CID, rate limiting | No |
| validation | 3 basic functions, MAX_MESSAGE_LENGTH=4000 | 15 functions with XSS, homoglyph, IPFS CID. MAX_MESSAGE_LENGTH=2500 | No |
| logger | Full implementation | Desktop already imports from shared | Yes, heavily (100+ locations) |

**Key finding:** Mobile does not use shared's validation, mentions, or formatting APIs. Replacing them with desktop's production versions is safe.

---

## Decisions

### 1. What migrates vs what stays

**Migrate to quorum-shared** — pure functions and domain logic:

| Utility | Category | Rationale |
|---------|----------|-----------|
| `validation.ts` | Replace shared's version | XSS, homoglyph, IPFS CID, impersonation detection — security-critical, must be consistent |
| `mentionUtils.ts` | Replace shared's version | Word boundaries, rate limiting, IPFS validation — protocol-level |
| `permissions.ts` | New | Core business rules — permission divergence = bugs |
| `channelPermissions.ts` | New | Channel-specific permission logic |
| `channelUtils.ts` | New (partial) | `findChannelByName` only — other functions depend on desktop's `UserConfig` from db/messages |
| `messageGrouping.ts` | New | Group messages by date/author — imports `./dayjs`, replace with dayjs direct import in shared |
| `messageLinkUtils.ts` | New | Parse/format message links — depends on `environmentDomains.ts` (migrating together) |
| `messagePreview.ts` | New | Preview text for conversation lists — has @lingui, strip to plain English |
| `markdownFormatting.ts` | New | Bold/italic/quote — platform-agnostic text transforms |
| `markdownStripping.ts` | New | Strip markdown for previews — already imports logger from shared |
| `codeFormatting.ts` | New | Code block utilities — pure text processing |
| `formatMentionCount.ts` | New | Badge count formatting (99+) — trivial pure function |
| `rateLimit.ts` | New | Generic rate limiter — platform-agnostic |
| `avatar.ts` | New | Avatar URL/color generation |
| `canonicalize.ts` | New | Canonical message representation for IDs/signatures — protocol-level. Has @lingui — strip to plain English |
| `clipboard.ts` (extractMessageRawText) | New | Extract plain text from typed messages — no Clipboard API despite the name. Has @lingui — strip to plain English |
| `notificationSettingsUtils.ts` | New | Notification preference utilities — depends on desktop's `../types/notifications`, types must be moved to shared first |
| `inviteDomain.ts` | New | Invite link parsing — uses `window.location`, needs environment injection |
| `environmentDomains.ts` | New | Domain/environment config — uses `window.location`, needs environment injection |
| `youtubeUtils.ts` | New | YouTube embed detection — pure regex |

**Stay in quorum-desktop** — DOM-specific or platform-coupled:

| Utility | Reason |
|---------|--------|
| `mentionPillDom.ts` | DOM contentEditable manipulation |
| `mentionHighlighting.ts` | DOM-based mention highlighting |
| `modalPositioning.ts` | `getBoundingClientRect()` |
| `toolbarPositioning.ts` | DOM measurement APIs |
| `caretCoordinates.ts` | Text cursor positioning via DOM |
| `cursor.ts` | DOM cursor utilities |
| `messageHashNavigation.ts` | Browser hash/router APIs |
| `toast.ts` | `window.dispatchEvent` |
| `imageProcessing/*` | Web File/Canvas APIs |
| `crypto.ts` / `crypto.web.ts` / `crypto.native.ts` | Obsolete — shared has proper crypto layer |
| `platform.ts` / `platform.native.ts` | Obsolete — architecture moved past this |
| `folderUtils.ts` | Fully coupled to desktop — imports `NavItem`, `UserConfig`, `FolderColor` from db/messages and `IconName` from primitives |
| `haptic.ts` | `navigator.vibrate` — mobile has native haptics |
| `dateFormatting.ts` + `dayjs.ts` | Depends on dayjs + @lingui |
| `remarkTwemoji.ts` | Remark plugin — web rendering specific |
| `mock/*` | Test data |

**No action needed:**

| Utility | Status |
|---------|--------|
| `encoding.ts` | Shared's version is the superset; desktop drops `bytes.ts` |
| `logger.ts` | Already in shared, already used by desktop |

### 2. How overlapping modules are handled

**validation.ts — Replace:**
- Desktop's 15-function version replaces shared's 3-function version
- `MAX_MESSAGE_LENGTH` set to 2500 (desktop's production value)
- Shared's `sanitizeContent` is useful and not in desktop — keep it

**mentionUtils.ts — Replace:**
- Desktop's 7-function version replaces shared's 3-function version
- Shared's `parseMentions` and `formatMention` are useful — keep alongside desktop's functions

**formatting.ts — Replace:**
- Remove date formatting functions (each app handles dates with its own i18n stack)
- Keep non-date formatters: `truncateText`, `formatFileSize`, `formatMemberCount`
- Add `formatMentionCount` from desktop

### 3. What does NOT migrate (and why)

**Platform-variant utils (crypto, platform):** Already handled by shared's architecture. Desktop's `.native.ts` files are obsolete stubs from an earlier cross-platform experiment.

**DOM-specific utils:** These don't have a meaningful cross-platform interface. Native equivalents will be written fresh for mobile with completely different APIs. Forcing them into shared with `.web`/`.native` splits would create artificial API alignment where none naturally exists.

**Date formatting:** Tied to i18n (dayjs + @lingui). Forcing a specific i18n library on all consumers is wrong. Each app formats dates with its own stack.

---

## File Organization

```
quorum-shared/src/utils/
├── index.ts                      # barrel export (update)
├── encoding.ts                   # existing — no changes
├── logger.ts                     # existing — no changes
├── formatting.ts                 # replace — remove dates, keep truncate/fileSize/memberCount
├── formatMentionCount.ts         # new (separate file)
├── validation.ts                 # replace — desktop's full version (MAX_MESSAGE_LENGTH=2500)
├── mentions.ts                   # replace — desktop's version + keep shared's parseMentions/formatMention
├── permissions.ts                # new
├── channelPermissions.ts         # new
├── channelUtils.ts               # new (partial — findChannelByName only)
├── messageGrouping.ts            # new (replace ./dayjs import with direct dayjs)
├── messageLinkUtils.ts           # new
├── messagePreview.ts             # new
├── markdownFormatting.ts         # new
├── markdownStripping.ts          # new
├── codeFormatting.ts             # new
├── rateLimit.ts                  # new
├── avatar.ts                     # new
├── canonicalize.ts               # new
├── clipboard.ts                  # new (extractMessageRawText — no actual Clipboard API)
├── notificationSettingsUtils.ts  # new
├── inviteDomain.ts               # new
├── environmentDomains.ts         # new
└── youtubeUtils.ts               # new
```

---

## Desktop Import Handling

Same pattern as primitives migration:

1. Desktop's `utils/index.ts` becomes a barrel that re-exports from `@quilibrium/quorum-shared`
2. DOM-specific utils stay as local files, imported directly by consumers
3. `dateFormatting.ts` and `dayjs.ts` stay local
4. `bytes.ts` is deleted (use `int64ToBytes` from shared's encoding)

---

## Dependencies to Handle During Migration

For each util migrated, we must:

- **Strip `@lingui` imports** — same pattern as primitives (plain English defaults, apps pass translated strings)
- **Ensure type imports use shared types** — already migrated in PR #1
- **Check for DOM API usage** — any accidental `window`, `document`, `navigator` references in "pure" functions must be removed or guarded
- **Check for app-specific imports** — any imports from desktop's components, hooks, or services must be made injectable or removed
- **Add npm dependencies to quorum-shared** — some utils bring in npm packages (e.g., `markdownStripping.ts` uses `unified`, `remark-parse`, `remark-gfm`, `remark-stringify`, `strip-markdown`). These must be added to quorum-shared's `package.json` (as dependencies or peerDependencies as appropriate)

---

## Branch & Commit Strategy

### Branches

```
quorum-shared:
  feat/shared-primitives-migration
    └── feat/shared-utils-migration       ← new branch (base: primitives)

quorum-desktop:
  feat/shared-primitives-migration
    └── feat/shared-utils-migration       ← new branch (base: primitives)
```

### Commit strategy

**quorum-shared:** Minimal commits.
- One commit for all migrated utility files (the atomic migration)
- Separate commits only for out-of-scope items (version bump, dependency changes, fixes)

**quorum-desktop:** Flexible — commit as needed for import updates, cleanup, file deletions.

### Before merging
- Switch `link:` back to published registry version in package.json
- Verify web app loads and functions correctly
- Verify mobile test screens still work (Metro bundle)

---

## Tests

Test files exist for several migrating modules. During implementation, decide per-file whether tests migrate to shared or stay in desktop:

| Test file | Tests module | Notes |
|-----------|-------------|-------|
| `src/utils/channelPermissions.test.ts` | `channelPermissions.ts` | Colocated with source |
| `src/dev/tests/utils/mentionUtils.enhanced.test.ts` | `mentionUtils.ts` | In dev test directory |
| `src/dev/tests/utils/reservedNames.test.ts` | `validation.ts` | In dev test directory |
| `src/dev/tests/utils/messageGrouping.unit.test.ts` | `messageGrouping.ts` | Imports `dayjs` from desktop — has platform-specific dep |

Handle case-by-case: tests with no desktop-specific dependencies are good candidates for shared; tests that import desktop-local modules (like dayjs) may need adjustment or stay in desktop.

## Out of Scope — Evaluate Later

- `src/utils.ts` (root level) — contains `getDefaultUserConfig`, `truncateAddress`, `getAddressSuffix`, `DefaultImages`. These are domain logic candidates but import from `../src/db/messages` (desktop's IndexedDB layer). Evaluate during hooks migration when the DB layer's cross-platform story is clearer.
- `folderUtils.ts` — fully coupled to desktop's navigation/DB types (`NavItem`, `UserConfig`, `FolderColor`, `IconName`). Evaluate when folder system is cross-platform.
- `channelUtils.ts` (partial) — `isChannelMuted` and `getMutedChannelsForSpace` depend on `UserConfig`. Only `findChannelByName` migrates now.

## Notes & Future Review

- Once we have read access to the updated quorum-mobile repo, verify:
  - Mobile's local formatting functions could adopt shared's versions
  - No new dependencies on shared's validation/mentions APIs were added since the version we audited
  - `MAX_MESSAGE_LENGTH=2500` is consistent with mobile's expectations
- This migration feeds into the hooks migration (PR #4), which is a separate effort requiring its own discussion

---

_Created: 2026-03-18_
