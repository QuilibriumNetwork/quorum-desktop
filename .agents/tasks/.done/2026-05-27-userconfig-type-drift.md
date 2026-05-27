---
type: task
title: Fix UserConfig type drift between quorum-shared and quorum-desktop
status: done
created: 2026-05-27
completed: 2026-05-27
---

> **Status: resolved at field level.** Phase 1 (add 7 missing fields to shared `UserConfig`) shipped on branch `chore/userconfig-type-drift-and-yt-toggle`. The deeper structural problem found during dedup (NavItem and NotificationSettings have incompatible shapes) is now tracked in [2026-05-27-shared-vs-local-type-divergence.md](../2026-05-27-shared-vs-local-type-divergence.md).

# Fix UserConfig type drift between quorum-shared and quorum-desktop

## Problem

The desktop app reads and writes several fields on `UserConfig` that **do not exist** in the shared type definition in `quorum-shared`. Because the `UserConfig` object syncs across all devices (desktop, web, mobile) via the encrypted config sync protocol, every field on it is part of the cross-device contract. Untyped fields on a synced contract have these consequences:

1. **Mobile devs cannot discover them** without grepping the desktop codebase. Feature parity is silently broken.
2. **TypeScript catches no typos.** A misspelled `deliveyReceipts` write breaks sync for that setting with zero compile-time warning.
3. **The architecture rule from [quorum-shared-architecture.md](../docs/quorum-shared-architecture.md):** *"Will data need to sync? → If yes → must use shared types"* — is being violated.
4. **The [config-sync-system.md](../docs/config-sync-system.md) doc** documents an outdated `UserConfig` shape that's missing fields desktop has been shipping for a while.

This was discovered while planning the "Generate YouTube previews" toggle. The natural place for it is `UserConfig` (so the privacy preference syncs across devices), but adding it the "follow the existing pattern" way would have propagated the drift rather than fixing it.

## Scope of the drift

Comparison of [`UserConfig` in quorum-shared/src/types/user.ts](../../../../quorum-shared/src/types/user.ts) vs what desktop actually reads/writes in [src/hooks/business/user/useUserSettings.ts](../../src/hooks/business/user/useUserSettings.ts):

| Field | In shared `UserConfig` type? | Written by desktop? | Loaded by desktop? | Documented in [config-sync-system.md](../docs/config-sync-system.md)? |
|---|---|---|---|---|
| `nonRepudiable` | yes | yes | yes | yes |
| `allowSync` | yes | yes | yes | yes |
| `bio` | yes | yes | yes | no |
| `spaceTagId` | yes | yes | yes | no |
| `deliveryReceipts` | **no** | yes | yes | no |
| `readReceipts` | **no** | yes | yes | no |
| `typingIndicatorsDM` | **no** | yes | yes | no |
| `typingIndicatorsSpaces` | **no** | yes | yes | no |
| `deviceNames` | **no** | yes | yes | yes (but absent from type) |
| `deletedDeviceNameAddresses` | **no** | yes (saveChanges) | (via merge) | yes (but absent from type) |

That's **6 sync-critical fields** ghosted on the wire and 2 more (`bio`, `spaceTagId`) that are in the type but missing from the doc.

## Root cause (hypothesis)

Best guess: each setting was added to desktop as part of a feature PR (delivery/read receipts, typing indicators, device naming) without the corresponding quorum-shared type bump. The desktop code uses `const newConfig = { ...freshConfig, deliveryReceipts, ... }` which TypeScript happily accepts because `freshConfig` is loose enough (or cast through `any`) that excess-property checking is bypassed. The pattern compounds: each new feature follows the previous one's example, drift grows.

Worth confirming by running `git log -p` on `useUserSettings.ts` for each field addition and checking whether the corresponding quorum-shared PR exists.

## Proposed remediation

### Phase 1 — type-only fix (low risk, ship in same PR as YouTube toggle)

In `quorum-shared/src/types/user.ts`, add to `UserConfig` (all optional, type-only):

```typescript
// Privacy / messaging behaviour preferences
deliveryReceipts?: boolean;
readReceipts?: boolean;
typingIndicatorsDM?: boolean;
typingIndicatorsSpaces?: boolean;
generateYouTubePreviews?: boolean;  // new — gates sender-side YouTube thumbnail fetch

// Device management (synced labels + tombstones)
deviceNames?: { [inboxAddress: string]: string };
deletedDeviceNameAddresses?: string[];
```

Then update [config-sync-system.md](../docs/config-sync-system.md) `UserConfig` snippet (lines 23–57) to match the real shape.

**Why this is safe:**
- All new fields are optional. Existing on-wire data is unchanged.
- No runtime code changes anywhere. Pure type addition.
- Mobile gets type visibility but no implementation pressure — they can mirror UI when ready.
- Desktop code compiles unchanged.

### Phase 2 — defensive cleanup (separate task, lower priority)

Once Phase 1 lands:

1. **Audit the `freshConfig` spread pattern.** In [useUserSettings.ts:300-322](../../src/hooks/business/user/useUserSettings.ts#L300-L322) the code spreads `freshConfig` and adds known fields. Consider a typed builder so excess-property checks fire on typos.
2. **Type the `getConfig` return.** If `getConfig` currently returns `any` or `UserConfig & Record<string, unknown>`, tighten it to `UserConfig` so reads benefit from the type too.
3. **Check `ConfigService.saveConfig`** in [src/services/ConfigService.ts](../../src/services/ConfigService.ts) for places where untyped data is written into the encrypted blob. The encryption happens on the JSON string of the whole object, so anything stuffed in survives the round-trip — meaning future drift is just as easy to introduce.
4. **Doc pass.** [config-sync-system.md:240-252](../docs/config-sync-system.md#L240-L252) lists "Toggle privacy settings → modifies `allowSync`, `nonRepudiable`". Should be expanded to include receipts, typing indicators, YouTube previews, device names.

### Phase 3 — mobile parity tracking (optional, do it if you want pressure)

Open a tracking issue in `quorum-mobile` listing each `UserConfig` field that has desktop UI but no mobile UI. Currently that's at least:
- `deliveryReceipts` / `readReceipts`
- `typingIndicatorsDM` / `typingIndicatorsSpaces`
- `deviceNames` (rename UI)
- `bio`
- `spaceTagId`
- `generateYouTubePreviews` (once added)

Mobile devs decide which to implement and when. The shared type makes it discoverable.

## Branch naming

Current branch `feat/preview-privacy-toggle` no longer fits the work. Suggested rename: `feat/userconfig-sync-type-fix` or `chore/userconfig-type-drift-and-yt-toggle` — covers both the type cleanup and the YouTube toggle that motivated it.

## Files involved

**quorum-shared** (separate repo, branch + PR per the [quorum-shared workflow](../../../../../.config/.agents/memory/projects/quilibrium/quorum-desktop/quorum-shared-workflow.md)):
- `src/types/user.ts` — add 7 optional fields to `UserConfig`

**quorum-desktop** (this branch):
- `.agents/docs/config-sync-system.md` — refresh `UserConfig` snippet, expand the "Triggers: When Sync Happens" table

No desktop runtime code changes needed for Phase 1.

## Verification

- `npx tsc --noEmit --jsx react-jsx --skipLibCheck` in quorum-desktop after pulling the bumped quorum-shared version
- Sanity check: load a desktop config that has `deliveryReceipts: true` set, confirm it still loads and the toggle still reflects the value
- Mobile build (not local) is also expected to be unaffected since fields are optional

## Risks

- **Wire format compatibility:** none — fields are optional, nothing changes about the JSON-on-wire.
- **Mobile crashes:** none expected — mobile already ignores fields it doesn't know about, this just makes them visible in the type.
- **Hidden duplicates:** possible. If mobile already wrote a field under a slightly different name (e.g. `delivery_receipts` snake_case vs `deliveryReceipts` camelCase), that would be a real conflict surfaced by this audit. Worth grepping the mobile repo before finalising the field names.

## Open questions (for Kyn)

1. **Naming convention:** desktop uses camelCase (`deliveryReceipts`). Is mobile consistent? If mobile uses snake_case for any of these, we have a real interop bug, not just a type gap.
2. **Should `generateYouTubePreviews` be device-local instead of synced?** Argument for syncing: privacy preference should be uniform across the user's devices. Argument for device-local: someone might have a different threat model on their phone (e.g. mobile data carrier vs home wifi). Default recommendation: sync it — uniform default privacy is safer.
3. **Cleanup of `UserConfig` itself:** the type has grown organically. Worth a separate task to consider grouping (e.g. `privacy: { allowSync, nonRepudiable, deliveryReceipts, readReceipts, typingIndicatorsDM, typingIndicatorsSpaces, generateYouTubePreviews }` as a nested object)? That would be a breaking change requiring migration logic, so probably not now — but worth noting.

## Related

- [quorum-shared-architecture.md](../docs/quorum-shared-architecture.md) — defines the "shared types are mandatory for synced data" rule
- [config-sync-system.md](../docs/config-sync-system.md) — describes how `UserConfig` is encrypted and uploaded
- Original session that surfaced this: planning the "Generate YouTube previews" toggle on branch `feat/preview-privacy-toggle`, 2026-05-27

---

*Created: 2026-05-27 — discovered while planning YouTube previews toggle. Reverted in-progress desktop-only edits on `useUserSettings.ts` so this task can drive the cleaner approach.*
