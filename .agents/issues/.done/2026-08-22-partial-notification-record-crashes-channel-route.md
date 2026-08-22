---
type: bug
title: "A partial notificationSettings record written by mobile crashes the whole channel route on desktop"
status: done
priority: high
created: 2026-08-22
updated: 2026-08-22
area: Notifications / cross-client config sync
repos: quorum-desktop, quorum-shared, quorum-mobile
related:
  - "issues/.done/2026-06-23-notification-settings-stale-read-and-clobber.md (the previous bug in the same hook; its clobber guard interacts with this fix)"
  - "docs/features/mention-notification-system.md"
  - "docs/features/channel-space-mute-system.md"
---

## Symptom

On production (`app.quorummessenger.com`, release build `index-DTb_hj0K.js`), opening
one specific space showed **"the channel could not be loaded"**. The channel never
rendered; the route error boundary caught the failure.

Console, in order:

```
GET .../users/<address>/public-profile 404 (Not Found)        <- unrelated noise
TypeError: Cannot read properties of undefined (reading 'filter')
    at vY (index-DTb_hj0K.js:126:10333)
Route error boundary caught: TypeError: ... (reading 'filter')
[ReplyCounts] Error calculating reply counts: TypeError: Cannot read properties of undefined (reading 'includes')
    at tRi (EmojiPicker-dQQMB-6f.js:56:333)
[SpaceReplyCounts] Error calculating reply counts: TypeError: ... (reading 'includes')
```

Only one space and one account were affected. A second account on the same build
was fine, which is why it looked like it might already be fixed in dev — it was
not. The code at both crash sites is byte-identical between the release tag and
`main`.

## Cause

`UserConfig.notificationSettings[spaceId]` **existed but had no
`enabledNotificationTypes` array**.

`SpaceNotificationSettings` declares that field as **required**, so every reader
treated it as guaranteed. The value does not come from TypeScript, though — it
comes from an untyped, cross-device synced config blob. The type is a claim about
what should be there, not a guarantee.

The producer is quorum-mobile, `services/config/configService.ts` → `setSpaceMuted`:

```ts
[spaceId]: { ...(prevSettings[spaceId] ?? {}), isMuted: muted } as any,
```

For a space with **no prior settings**, `?? {}` makes this write a bare
`{ isMuted }` — no `spaceId`, no `enabledNotificationTypes`. That record then
syncs to every other device. Its sibling `setNotificationTypes` was always
correct; only the mute path was lossy.

Desktop could not recover from it, because the guard was a null-check, not a
shape-check:

```ts
config?.notificationSettings?.[spaceId] ?? getDefaultNotificationSettings(spaceId)
```

The record is **truthy**, so `??` never fires and the missing array survives.

### Why it took down the entire route

```
mobile: first mute/unmute of a space  ──►  { isMuted: false }
                                              │  syncs
desktop useMentionNotificationSettings ───────┴──►  settings.enabledNotificationTypes === undefined
                                                        │
                                    selectedTypes = useState(undefined)
                                                        │
                    NotificationPanel.tsx:66  selectedTypes.filter(...)  ✗ THROWS IN RENDER
```

`NotificationPanel` is mounted **unconditionally** in `Channel.tsx:1696` — `isOpen`
is only a prop, so the component and its hooks run even while the panel is closed.
The user never had to click the bell. A render-phase throw there is not
recoverable, so the route error boundary swallowed the whole channel.

The `.includes` errors are the same root cause on a non-fatal path:
`isNotificationTypeEnabled` had `if (!settings) return true;` then
`settings.enabledNotificationTypes.includes(...)`. Both reply-count hooks wrap it
in try/catch, so it degraded to zero counts plus console noise.

`isMuted` must have been **false** on the affected account: the reply-count hooks
return early when a space is muted, so reaching the `.includes` proves the space
was muted and then unmuted on mobile.

### Method note

The two crash sites were identified by downloading the deployed bundles and
reading the minified functions directly, rather than by guessing from source:

- `tRi` = `function tRi(e,t){return e?e.enabledNotificationTypes.includes(t):!0}`
  → `isNotificationTypeEnabled`
- `vY` = the `NotificationPanel` component, crashing on
  `g.filter(e=>e.startsWith("mention-"))`, and mounted in the deployed build with
  a real `spaceId` in the channel header

## Fix

Three layers. **A is the one that unbreaks affected accounts** — C alone does
nothing for data already written and synced.

| Layer | Repo | Change |
|-------|------|--------|
| **A** | quorum-desktop | `useMentionNotificationSettings` normalizes the record on read instead of `??`-ing it |
| **B** | quorum-shared | new `normalizeSpaceNotificationSettings`; `isNotificationTypeEnabled` and `hasEnabledNotificationTypes` now shape-check instead of null-check |
| **C** | quorum-mobile | `setSpaceMuted` writes a complete record even on first write |

The fix is **read-side only on desktop**. No desktop write path was changed.

### Rejected: repairing the stored record (implemented, then reverted)

Read-normalization makes a partial record harmless but does not **converge** it —
the selection derived from it equals the normalized default, so `saveSettings`'
clobber guard matches and returns early, and the malformed shape survives on the
server.

A repair path was built for this: a `needsSpaceNotificationSettingsRepair`
predicate that let Save bypass the clobber guard when the raw stored record was
malformed, plus the same normalization applied to `useChannelMute`'s mute/unmute
writes. **It was reverted.** The safety argument behind it — "a record missing its
array carries no user selection to clobber, so writing the default fills a blank"
— is wrong:

- The repair writes the all-enabled **default**, which is not a selection the user
  made.
- Config sync is **last-write-wins over the whole blob** (`ConfigService.ts:72`
  compares timestamps; there is no per-field merge). So the repair does not fill a
  blank quietly — it publishes an assertion with a fresh timestamp that competes
  with every other device.
- A partial record is a **transient** state, not a terminal one. Mobile's flow is
  mute-first-then-refine-types, so "partial" is a normal step on the way to a real
  value that has not synced down yet.
- The trigger is far wider than notification editing: `saveSettings` runs on
  **every** Account-tab Save (`SpaceSettingsModal.handleAccountSave`), including a
  save where the user only changed a nickname.

Together those give a concrete data-loss path: mobile writes a real
`['mention-roles']`; before it syncs down, desktop's unrelated Save repairs the
still-partial record to all-four with a newer timestamp; the user's choice is
silently reverted. That is exactly the class of bug the 2026-06-23 clobber guard
exists to prevent.

`useChannelMute` had the same defect once normalized: pre-change it spread a
partial record forward and asserted only `isMuted`, inventing nothing. Normalizing
made it assert the default array too. Reverted for the same reason.

**Accepted instead:** a partial record is inert while every reader normalizes, and
it converges by itself the first time the user genuinely changes a selection on
any device, because that write goes out complete. Convergence is traded for never
writing a value the user did not choose.

This decision is pinned by tests in all three repos; reintroducing a repair write
turns them red.

Normalization is deliberately conservative: a stored `enabledNotificationTypes: []`
means "notify me about nothing" and is preserved, not mistaken for missing data.
`isMuted` is preserved in every path — healing the shape must never silently
unmute a space the user muted on their phone.

## Verification

Every test below was **mutation-proven**: the fix was reverted and the tests were
confirmed to go red, then restored.

| Suite | New tests | Red without the fix |
|-------|-----------|---------------------|
| quorum-shared `src/utils/notificationSettingsUtils.test.ts` | 14 | 7 fail |
| quorum-desktop `src/dev/tests/hooks/notificationSettingsPartialRecord.unit.test.tsx` | 14 | 8 fail |
| quorum-mobile `__tests__/spaceMuteWritesCompleteRecord.test.ts` | 6 | 3 fail |

The desktop suite is mutation-tested in **both** directions, because the two
failure modes here are opposites and a one-sided check would miss one of them:

| Mutation | Expected | Result |
|----------|----------|--------|
| Revert read-normalization to `??` (the original crash) | crash tests red | 8 red |
| Reintroduce a repair write on Save | **no-write tests red** | 2 red |

The second direction is what defends the rejected-design decision above. Without
it, a future change could re-add the repair path and the suite would stay green.

The desktop test reproduces the production error verbatim
(`Cannot read properties of undefined (reading 'length')` and the `.filter`)
against the **real** hook and the **real** shared normalizer. The pre-existing
`NotificationPanel.test.tsx` mocks `useMentionNotificationSettings` wholesale, so
it could never have caught this.

Full suites after the change: quorum-shared 756 passed, quorum-desktop 1663
passed, quorum-mobile 1208 passed. Desktop `tsc --noEmit` clean.

Two independent adversarial reviews ran. The first swept all three repos for remaining unguarded
reads of `enabledNotificationTypes` / `notificationSettings[...]` and found none.
It confirmed the other readers (`fetchSpaceMentions`, `useSpaceMentionCounts`,
`useChannelMentionCounts`, `MessageService`, and mobile's own getters) were
already safe, because they read at the **property** level with a `||`/`??`
fallback — `settings?.enabledNotificationTypes` is `undefined` on a partial record
whether or not the object is truthy, so those fallbacks always fired. Only the
object-level `??` in `useMentionNotificationSettings` and the null-check in
`isNotificationTypeEnabled` were vulnerable.

The second review was scoped to the repair-on-Save mechanism and is what killed
it. It confirmed the trigger was any Account-tab Save rather than a notification
edit, confirmed the whole-blob last-write-wins sync, and constructed the
interleaving above. It also independently re-ran the claimed mutation results in
both directions rather than trusting them. Its one finding that did NOT drive the
revert: the predicate also fired for a record with a valid array but a missing
`spaceId` — a real selection — though no current writer produces that shape.

## Status

**2026-08-22 — shipped across all three repos**

- quorum-desktop **#363** (`fix(notifications): stop a partial settings record crashing the channel route`)
- quorum-shared **#88** (`fix(notifications): tolerate a partial per-space settings record`)
- quorum-mobile **#269** (`fix(config): write a complete per-space notification record when muting`)

What landed: desktop normalizes the record on read, which stops the route crash;
shared gained the normalizer and its two guards now shape-check; mobile's
`setSpaceMuted` writes a complete record so no new partial records are created.
No desktop write path changed.

**Shared was NOT republished, deliberately.** Desktop consumes it via
`link:../quorum-shared` so it picks the change up from the sibling checkout,
while mobile is pinned to the published `2.1.0-45` and does not use any of the
changed functions — its own fix references only mobile-local symbols. Whoever
publishes shared next must bump the version, because `master` now differs in
content from the published `2.1.0-45` while carrying the same version number.

Stored records are deliberately not repaired (see the rejected design above), so
an affected account keeps its partial record until the user next changes a
notification selection on any device. That is inert. Mobile's fix prevents new
corruption but heals nothing retroactively.

## Known debt, not fixed here

quorum-mobile declares its own local `SpaceNotificationTypeId` union in
`services/config/configService.ts` instead of importing quorum-shared's identical
type. The lists match today and nothing keeps them in step, so a change in shared
would leave mobile silently stale with no compiler error. Pre-existing (it carries
its own `TODO: drop the as any once the shared type is published + pinned`), and
this change extends reliance on it. Worth its own task.

---
*Last updated: 2026-08-22*
