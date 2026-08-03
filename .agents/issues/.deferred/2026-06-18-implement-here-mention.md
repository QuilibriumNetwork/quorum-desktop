---
type: task
title: "Implement @here mention (all space members, channel-context notification)"
status: deferred
complexity: high
ai_generated: true
created: 2026-06-18
updated: 2026-06-18
related_issues: []
related_docs: []
related_tasks: ["2026-06-18-fix-everyone-mention-scope.md"]
---

# Implement @here mention (all space members, channel-context notification)

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files** (anticipated — confirm before implementing):
- `d:\GitHub\Quilibrium\quorum-shared\src\utils\mentions.ts` — `extractMentionsFromText`, `isMentionedWithSettings`
- `d:\GitHub\Quilibrium\quorum-shared\src\types\` — `Mentions` type, `Permission` type
- `d:\GitHub\Quilibrium\quorum-desktop\src\utils\mentionPillDom.ts:16` — `MentionPillType`
- `d:\GitHub\Quilibrium\quorum-desktop\src\hooks\business\mentions\useMentionInput.ts:41` — autocomplete union type
- `d:\GitHub\Quilibrium\quorum-desktop\src\services\MessageService.ts:4509` — mention type detection (receive)
- `d:\GitHub\Quilibrium\quorum-desktop\src\services\MessageService.ts:4667` — send side permission check
- `d:\GitHub\Quilibrium\quorum-desktop\src\services\NotificationService.ts:26` — `mentionType` union
- `d:\GitHub\Quilibrium\quorum-desktop\src\components\message\MessageMarkdownRenderer.tsx:308` — pill rendering
- `d:\GitHub\Quilibrium\quorum-desktop\src\components\modals\SpaceSettingsModal\Account.tsx` — notification settings UI

## Deferred reason

**Deferred 2026-06-18**: Quorum's P2P architecture makes `@here` meaningless. All space members hold the space encryption key and therefore receive all channel messages — there is no such thing as "channel membership" as a distinct subset of space membership. `@here` in Discord/Slack is useful precisely because channel membership is a real, enforced subset. Since that distinction doesn't exist in Quorum, `@here` would be an exact alias for `@everyone` with no functional difference, which would confuse users familiar with Discord/Slack who expect `@here` to be narrower. Revisit only if Quorum introduces a concept of per-channel access control (architecturally unlikely given the P2P model).

## What & Why

Add an `@here` mention type. Quorum is fully P2P — all space members receive all channel messages at the transport layer, and private channels are architecturally impossible. This means `@here` and `@everyone` reach the **same set of people** (all space members).

**So why add `@here` at all?**

The distinction is **intent and urgency**, not scope:
- `@everyone` = "heads up to the whole space, channel context is incidental"
- `@here` = "attention needed from people following this channel specifically" — a softer, more channel-contextual nudge even though the notification reaches the same people

This matches how power users in Discord and Slack use the two: `@here` is considered less disruptive than `@everyone` even when the technical reach is similar. It also gives users a `mention-here` toggle in notification settings separate from `mention-everyone`, so they can filter differently.

**No online-only filtering**: Discord's `@here` notifies only online members. Quorum has no presence/online-status system. `@here` = all space members, online or not — matching Slack's `@channel` semantics.

## Context
- **Architecture**: P2P space-wide transport. No channel membership gate possible. `@here` and `@everyone` are same scope in terms of who receives the message.
- **Existing pattern**: `@everyone` is the direct reference — `mentions.everyone: boolean`, `MentionPillType = 'everyone'`, `mention:everyone` permission, `canUseEveryone` in composer.
- **Constraints**: quorum-shared changes must be additive/optional — mobile is pinned to the published version.
- **Dependencies**: None blocking. The "private channels" question from the related task is answered: there are none.

## Prerequisites
- [ ] Confirm with lead dev: is the `@here` / `@everyone` intent distinction (urgency/tone) worth adding, or is it unnecessary complexity?
- [ ] Confirm: should `@here` require a separate permission (`mention:here`) or reuse `mention:everyone`? A separate permission gives admins finer control.
- [ ] Branch created from `main`
- [ ] No conflicting PRs against quorum-shared

## Implementation

### Phase 1: quorum-shared — data model + core logic

- [ ] **Add `here` field to `Mentions` type** (`quorum-shared/src/types/`)
  - Add optional `here?: boolean` alongside `everyone?: boolean`
  - Done when: TypeScript compiles, existing callers unaffected

- [ ] **Add `mention:here` permission** (`quorum-shared/src/types/space.ts:14`)
  - Extend `Permission` union: `'mention:here'`
  - Or decide to reuse `mention:everyone` — confirm with lead dev first
  - Done when: permission type updated

- [ ] **Update `extractMentionsFromText`** (`quorum-shared/src/utils/mentions.ts`)
  - Detect `@here` in message text (same word-boundary regex as `@everyone`)
  - Add `allowHere` option (parallel to `allowEveryone`)
  - Set `mentions.here = true` when detected and permitted
  - Done when: unit tests pass for extraction with/without permission

- [ ] **Update `isMentionedWithSettings`** (`quorum-shared/src/utils/mentions.ts:283`)
  - Add `'mention-here'` branch: `mentions.here === true` + sender held `mention:here` permission
  - No channel gate needed (P2P architecture — all members receive all messages)
  - Done when: unit tests cover honoring and ignoring `@here` based on sender permission

- [ ] **Write unit tests** (`quorum-shared/src/utils/mentions.test.ts`)
  - `@here` honored when sender has `mention:here` permission
  - `@here` ignored when sender lacks permission
  - Backwards compat: existing `@everyone` tests unaffected

### Phase 2: quorum-shared PR

- [ ] Open PR against quorum-shared with Phase 1 changes
- [ ] Follow quorum-shared workflow (branch → PR → user merges manually)
- [ ] Wait for merge + publish before touching desktop

### Phase 3: quorum-desktop — composer / autocomplete

- [ ] **Add `'here'` to `MentionPillType`** (`src/utils/mentionPillDom.ts:16`)
- [ ] **Add CSS class mapping** (`src/utils/mentionPillDom.ts:31`) — `here: 'message-mentions-here'`
- [ ] **Add `@here` option to `useMentionInput`** (`src/hooks/business/mentions/useMentionInput.ts:41`)
  - Add `{ type: 'here' }` to the mention option union
  - Show in autocomplete when typing `@h` / `@he` / `@her` (same tier logic as `@everyone`)
  - Gate display on `canUseHere` prop
- [ ] **`extractPillDataFromOption`** (`src/utils/mentionPillDom.ts`) — handle `type: 'here'` → `{ type: 'here', displayName: 'here', address: 'here' }`
- [ ] **Send side** (`src/services/MessageService.ts:4667`) — compute `canUseHere` from `hasPermission('mention:here', ...)` and pass to composer

### Phase 4: quorum-desktop — rendering + notifications

- [ ] **MessageMarkdownRenderer** (`src/components/message/MessageMarkdownRenderer.tsx:308`)
  - Add `@here` pill styling, gated on `mentions.here === true`
  - Style can match `@everyone` or be visually distinct (designer decision)

- [ ] **NotificationService** (`src/services/NotificationService.ts:26`)
  - Add `'here'` to `mentionType` union
  - Notification text: e.g. "mentioned @here in #channel-name"

- [ ] **MessageService notification path** (`src/services/MessageService.ts:4509`)
  - Detect `mentionType = 'here'` when `mentions.here === true`
  - Priority order: user > role > here > everyone

- [ ] **Notification settings UI** (`src/components/modals/SpaceSettingsModal/Account.tsx`)
  - Add `mention-here` toggle alongside `mention-everyone` and `mention-roles`
  - Label: "@here mentions" with description: "Notifies all space members following this channel"
  - Update `SpaceNotificationTypeId` type if needed

- [ ] **`useChannelMentionCounts` + `useSpaceMentionCounts`**
  - Include `mention-here` in `enabledTypes` filtering when user has it enabled
  - Ensure `@here` messages count toward unread mention badges

### Phase 5: i18n

- [ ] Add translation strings for `@here` notification text in `src/i18n/en/messages.ts`
- [ ] Run Lingui extract: `yarn lingui:extract`

## Verification

✅ **`@here` appears in autocomplete when typing `@h`**

✅ **`@here` pill renders correctly in sent messages**

✅ **All space members with `mention-here` enabled receive a notification**

✅ **`@everyone` and `@here` are independently toggleable** in notification settings

✅ **Sender without `mention:here` permission cannot trigger `@here` notifications** (pill is hidden in autocomplete, extraction ignores it)

✅ **TypeScript compiles** — `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **quorum-shared unit tests pass** — `cd quorum-shared && yarn test`

✅ **Mobile unaffected** — quorum-shared changes are optional-field additive; mobile pinned to published version

## Definition of Done
- [ ] Lead dev confirms `@here` is worth adding (intent distinction over `@everyone`)
- [ ] All phases complete
- [ ] quorum-shared PR merged and published before desktop changes land
- [ ] All verification tests pass
- [ ] No console errors
- [ ] Notification settings UI updated and tested

*Last updated: 2026-06-18*
