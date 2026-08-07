---
type: doc
title: "Privacy Settings — what each toggle discloses, and to whom"
status: done
ai_generated: true
created: 2026-08-07
updated: 2026-08-07
related_docs:
  - "../config-sync-system.md"
  - "./security.md"
  - "./identity-resolution-and-profile-sync.md"
  - "./user-data-backup.md"
related_tasks:
  - "../../issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md"
---

# Privacy Settings — what each toggle discloses, and to whom

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Every claim below is READ from the code at the cited `file:line`, not observed
> at runtime. Re-check the line references before quoting this in user-facing copy.

## Overview

Settings → **Privacy** ([Privacy.tsx](../../../src/components/modals/UserSettingsModal/Privacy.tsx))
holds seven working toggles and one placeholder. They are not variations on a
single theme: each one discloses a *different kind* of data to a *different
audience*. Grouping them under one "Privacy" heading makes them look
interchangeable, and they are not.

The question this doc answers for each toggle is: **who learns what, if you turn
this on?**

## The default privacy state of a fresh account

A new account is private-by-default on everything **except message signing**.

| Toggle | Default | Where the default comes from |
|---|---|---|
| Enable sync | **OFF** | [utils.ts:13](../../../src/utils.ts#L13) |
| **Always sign Direct Messages** | **ON** | [utils.ts:14](../../../src/utils.ts#L14), plus `?? true` at [DirectMessage.tsx:189](../../../src/components/direct/DirectMessage.tsx#L189) |
| Public profile | **OFF** | `?? false` at [useUserSettings.ts:144](../../../src/hooks/business/user/useUserSettings.ts#L144) |
| Show online status | **OFF**, and disabled | Hard-coded `value={false} disabled` at [Privacy.tsx:145](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L145) |
| Delivery receipts | **OFF** | `?? false` at [useUserSettings.ts:129](../../../src/hooks/business/user/useUserSettings.ts#L129) and [DirectMessage.tsx:196](../../../src/components/direct/DirectMessage.tsx#L196) |
| Read receipts | **OFF** | `?? false`, and additionally gated on delivery receipts |
| Typing indicators in DMs | **OFF** | `!!cfg?.typingIndicatorsDM` at [MessageDB.tsx:1180](../../../src/components/context/MessageDB.tsx#L1180) |
| Typing indicators in Spaces | **OFF** | `!!cfg?.typingIndicatorsSpaces` at [MessageDB.tsx:1181](../../../src/components/context/MessageDB.tsx#L1181) |
| Generate YouTube previews | **OFF** | `?? false` at [useMessageComposer.ts:37](../../../src/hooks/business/messages/useMessageComposer.ts#L37) |

**Only `allowSync` and `nonRepudiable` are written by `getDefaultUserConfig`**
([utils.ts:10-25](../../../src/utils.ts#L10-L25)). The other five are simply
absent from a fresh config, so their effective default is whatever the read site
falls back to. Every read site falls back to `false`, and there are two or three
read sites per setting — so the safe default is currently correct, but it is
enforced by repetition rather than by a single source of truth.

> **If you add a Privacy toggle, add its default to `getDefaultUserConfig` as
> well as the read sites.** A new field that only exists as an undefined check
> is one careless `?? true` away from silently opting every existing user in.

## The four destinations

The useful way to read the table below is by *where the data ends up*, because
that determines who can compel, subpoena or observe it.

| Destination | What it means | Which toggles |
|---|---|---|
| **Local only** | Never leaves the device | All of them, when off |
| **Encrypted blob on the Quorum server** | Server holds ciphertext keyed to your address; it learns size and timing, not content | Enable sync |
| **Plaintext on the Quorum server** | Server, and anyone who asks it, reads the actual values | Public profile |
| **Encrypted to your counterparties** | The people you are talking to learn it; the server does not | Receipts, typing indicators |
| **A third party outside Quorum** | Someone other than Quorum sees your IP | YouTube previews |

Two toggles are categorically different from the rest: **Public profile** is the
only one that writes plaintext to the server, and **YouTube previews** is the
only one that discloses anything to a company outside the Quorum network.

---

## Enable sync (`allowSync`) — default OFF

**What it does.** Encrypts your config with AES-GCM under a key derived from your
Ed448 private key, signs it, and uploads it to `POST /api/settings/{address}`
([ConfigService.ts:524](../../../src/services/ConfigService.ts#L524)). The parcel
carries your spaces list, **space keys and space ratchet state**, profile,
bookmarks, notification settings and every other toggle on this page.

**What you give up.** Not content: the blob is encrypted on-device and the server
never sees a config field. What it gains is **metadata**:

- **A timeline.** Every config write is a fresh timestamped POST. Toggling a
  setting, adding a bookmark, reordering the sidebar, renaming a device: each one
  is an observable event tied to your address.
- **Size.** Blob size tracks what you have. Per
  [config-sync-system.md](../config-sync-system.md), a **created** space
  pre-allocates roughly 2 MB of polynomial evals while a **joined** space costs
  about 12 KB, so size deltas distinguish the two.
- **A durable, retroactively decryptable archive.** The blob persists on the
  server and is decryptable by anyone who later obtains your private key.

**What you do NOT give up.** Sync is not what reveals that you joined a space.
`postHubAdd` is called directly by [InvitationService.ts:680](../../../src/services/InvitationService.ts#L680)
on join and [SpaceService.ts:294](../../../src/services/SpaceService.ts#L294) on
create, with no `allowSync` check. The in-app tooltip's "can reveal when you have
joined new Spaces" overstates the delta: hub registration is visible either way.

**What you gain.** This is the only backup of your space keys. With it off, a lost
or wiped device means losing access to your spaces, not just their history. The
returning-user restore path reads `getUserSettings(address)`
([profile-sync-returning-user-login.md](./profile-sync-returning-user-login.md)),
which finds nothing if you never synced. Browser storage loss is not exotic:
see [the Safari ITP issue](../../issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md).

### Off is "stop publishing", not "unpublish"

The API client exposes only `getUserSettings` (GET) and `postUserSettings` (POST)
— [baseTypes.ts:410](../../../src/api/baseTypes.ts#L410) and
[baseTypes.ts:470](../../../src/api/baseTypes.ts#L470). **There is no delete.**
Three consequences that matter when explaining this to users:

1. **Turning sync off leaves your last snapshot on the server, permanently.** The
   flip is itself never uploaded, because the flip is what suppresses the upload.
2. **On that device it then behaves correctly.** Local saves keep advancing the
   local timestamp ([ConfigService.ts:521](../../../src/services/ConfigService.ts#L521),
   which runs *before* the `allowSync` gate), so the stale remote loses the
   comparison at [ConfigService.ts:71](../../../src/services/ConfigService.ts#L71)
   forever after.
3. **But it silently switches back on in two cases**, because the remote config is
   adopted verbatim at [ConfigService.ts:417](../../../src/services/ConfigService.ts#L417)
   (`{...config}`, `allowSync` included):
   - **Local storage is lost.** With no stored config, the timestamp check compares
     against `?? 0` and the remote always wins. You are restored to your state at
     the moment you turned sync off, with sync back on, unannounced.
   - **A second device still has it on.** Your flip was never uploaded, so that
     device never learns. Once its blob is newer than this device's last local
     save, this device adopts it and re-enables itself.

**On-then-off is therefore not equivalent to never-on.** For anyone who needs the
guarantee, the only reliable state is leaving it off from the start, which is the
default.

---

## Always sign Direct Messages (`nonRepudiable`) — default **ON**

**The one toggle whose default is the less-private position, and the most
consequential one on the page for a high-risk user.**

**What it does.** Attaches a signature from your key to every DM. When off, the
composer exposes a per-message signing control
([DirectMessage.tsx:1116](../../../src/components/direct/DirectMessage.tsx#L1116),
`showSigningToggle={!nonRepudiable}`) and `skipSigning` becomes effective
([DirectMessage.tsx:426](../../../src/components/direct/DirectMessage.tsx#L426)).

**What you give up.** **Deniability.** A signed message is cryptographic proof
that the message came from your key, and that proof is transferable: your
recipient can show it to a third party who was not in the conversation, and it
verifies. Unsigned messages are still authenticated to the recipient by the
ratchet, so they still know it is you; what they lose is the ability to *prove*
it to anyone else.

**Why the default is ON anyway.** Signing is what makes impersonation detectable.
The trade is authenticity versus deniability, and the app chooses authenticity by
default. That is a defensible default for most users and the wrong one for a
source talking to a journalist, so it deserves prominence in any user-facing
explanation rather than being buried between sync and receipts.

**Note the asymmetry of the UI**: when the global toggle is ON, the per-message
control is hidden entirely. A user who wants deniability for a single message must
first turn the global setting off.

---

## Public profile (`isProfilePublic`) — default OFF

**The only toggle that writes plaintext to the server.**

**What it does.** Publishes a signed, **unencrypted** profile to
`POST /users/:addr/public-profile`
([PublicProfileService.ts:59-80](../../../src/services/PublicProfileService.ts#L59-L80)):
display name, profile image and bio, signed over
`public-profile:addr:name:image:bio:` plus a big-endian timestamp.

**What you give up.** Anyone who knows your address reads your name, avatar and
bio, including people you share no space with. Unlike the sync blob, this is not
ciphertext: the server and any requester see the actual values. Your address is
already a public identifier, so this makes it directly linkable to a human-readable
identity.

**What you gain.** People who DM you out of the blue can tell who you are. Without
it, identity resolution falls back to space membership.

**It is the only privacy setting with a working unpublish.** Turning it off issues
a signed `DELETE` when it was previously on
([useUserSettings.ts:455-464](../../../src/hooks/business/user/useUserSettings.ts#L455-L464)).
Worth stating explicitly to users, because it is the opposite of how sync behaves,
and the two sit three rows apart in the same panel.

The toggle requires explicit confirmation to turn **on** and none to turn off
([Privacy.tsx:55-65](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L55-L65)),
which is the correct asymmetry: confirm increases in exposure, never decreases.

---

## Delivery receipts and Read receipts — both default OFF

**What they do.** Send acknowledgements back to your sender: `ackMessageIds` on
delivery, `readAckUpTo` on read
([MessageService.ts:924-931](../../../src/services/MessageService.ts#L924-L931)).

**What you give up.** To **your counterparty only**, not to the server: that your
device received a message, and when you actually read it. Read receipts are the
sharper of the two, because "when you read it" is a behavioural signal about your
waking hours, attention and presence, inferred from a stream of timestamps.

**Structural details worth knowing:**

- **Read is gated behind delivery.** The read row is hidden unless delivery is on
  ([Privacy.tsx:190](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L190)),
  turning delivery off cascades read off
  ([Privacy.tsx:169](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L169)),
  and the runtime enforces the same at
  [DirectMessage.tsx:197-198](../../../src/components/direct/DirectMessage.tsx#L197-L198).
- **`readAt` is not persisted when the setting is off**
  ([MessageService.ts:870](../../../src/services/MessageService.ts#L870)), so
  toggling it on later cannot retroactively leak read times you accrued while it
  was off.
- **These are reciprocal.** The tooltips say so plainly: you see theirs only if
  you send yours.
- **The global toggle is a default, not a rule.** Precedence at
  [MessageService.ts:4182-4186](../../../src/services/MessageService.ts#L4182-L4186)
  is: per-conversation override → the conversation record → the global setting →
  `false`. A user can be visible in one conversation and dark in every other.

---

## Typing indicators, in DMs and in Spaces — both default OFF

**What they do.** Send ephemeral `typing-start` / `typing-stop` control messages
through the same encrypted channel as messages
([MessageService.ts:632](../../../src/services/MessageService.ts#L632) for DMs,
[MessageService.ts:662](../../../src/services/MessageService.ts#L662) for spaces).
They are intercepted on receipt and never stored
([MessageService.ts:842](../../../src/services/MessageService.ts#L842)).

**What you give up.** To your counterparties, encrypted, and not to the server:
that you are present and composing right now. The Spaces variant has a much wider
audience than the DM one, since **everyone in the channel** sees it. They are the
finest-grained presence signal in the app, and they reveal drafts you never send.

Because these are ephemeral and unstored, they leak in the moment rather than
accumulating into a record. That makes them lower-risk than read receipts over
time, and higher-risk in the moment.

---

## Generate YouTube previews (`generateYouTubePreviews`) — default OFF

**The only toggle that discloses anything to a party outside Quorum.**

**What it does.** At compose time, the **sender's** device fetches the thumbnail
for any YouTube link it is about to send
([useMessageComposer.ts:213-251](../../../src/hooks/business/messages/useMessageComposer.ts#L213-L251))
and embeds it in the message as a data URI.

**What you give up.** Your IP address, and the fact that you are about to share a
specific video, to **Google**. Nothing about this reaches the Quorum server.

**The design detail worth highlighting:** because the thumbnail travels inside the
encrypted message as a pre-resolved data URI
([YouTubeFacade.tsx:10-11](../../../src/components/ui/YouTubeFacade.tsx#L10-L11)),
**recipients never contact Google to see it**. When the sender has this off,
`thumbnailSrc` is null and recipients get a plain link
([YouTubeFacade.tsx:89](../../../src/components/ui/YouTubeFacade.tsx#L89)).
So the setting governs the sender's exposure only, and no configuration of it
leaks a *recipient's* IP. A recipient's IP reaches Google only if they click to
play, which loads the embed iframe.

---

## Show Online Status — not implemented

Rendered permanently off and disabled
([Privacy.tsx:145](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L145)),
with a tooltip saying the feature is not yet available. It is a placeholder for a
planned setting and currently discloses nothing. It is listed here so that anyone
auditing the panel does not mistake it for a working control.

## Adjacent settings that are not on the Privacy tab

- **Notifications → desktop notifications**
  ([Notifications.tsx:36](../../../src/components/modals/UserSettingsModal/Notifications.tsx#L36)).
  Local only, triggers the browser's own permission prompt. No data leaves the device.
- **General → display name, avatar, bio.** Inert by themselves. They become
  disclosure the moment **Public profile** is on, since those are exactly the three
  fields it publishes.
- **Security → device list.** Shows which devices can receive new messages.
  Removing one stops new messages reaching it; it does not log that device out or
  wipe its local data ([Security.tsx:243](../../../src/components/modals/UserSettingsModal/Security.tsx#L243)).

## Known limitations

- **Defaults live at the read sites, not in one place.** Five of the seven working
  toggles are absent from `getDefaultUserConfig`, so their default is the `??
  false` at each consuming call site. Correct today; fragile.
- **Sync has no delete and its off-state is not durable.** See the section above.
  A user who turns it off, then loses local storage or keeps a second device
  syncing, gets it re-enabled without being told.
- **The sync tooltip overstates what sync reveals** about joining spaces, while
  understating the durable-archive property, which is the part that actually
  matters for a high-risk user.
- **The panel gives equal visual weight to unequal risks.** Publishing plaintext
  to a server, removing cryptographic deniability, and showing a typing bubble are
  eight identical rows of switches.

## Related Documentation

- [Config Sync System](../config-sync-system.md) — the sync mechanism, blob contents, and size budget
- [Security Architecture](./security.md) — client-side protections and cryptographic posture
- [Identity Resolution and Profile Sync](./identity-resolution-and-profile-sync.md) — how public profiles feed name resolution
- [User Data Backup & Restore](./user-data-backup.md) — `.qmbak` export, and what it cannot restore
- [Safari ITP wipes IndexedDB](../../issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md) — why "sync off" has a real cost

---

*Last updated: 2026-08-07*
