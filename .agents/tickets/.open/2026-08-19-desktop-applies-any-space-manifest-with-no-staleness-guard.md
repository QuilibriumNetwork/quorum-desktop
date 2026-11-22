---
type: bug
title: "Desktop applies any signed space-manifest, with no staleness guard, so a replayed one can revert a newer edit"
status: open
priority: medium
ai_generated: true
created: 2026-08-19
updated: 2026-08-19
---

# Desktop applies any signed space-manifest, with no staleness guard

> **⚠️ AI-Generated**: May contain errors. Verify before use.

Found during independent review of
[`2026-08-11-public-invite-link-never-reaches-existing-members.md`](2026-08-11-public-invite-link-never-reaches-existing-members.md)
(PR pending). **Pre-existing, not introduced by that PR** — but that PR makes
manifest broadcasts more frequent, which raises the exposure.

## Symptom

Desktop's `space-manifest` receive handler (`src/services/MessageService.ts:5193-5265`)
verifies the owner signature, decrypts, and then calls `saveSpace(space)`
unconditionally. It does not compare the incoming `manifest.timestamp` against
anything.

Mobile does guard this (`quorum-mobile/context/WebSocketContext.tsx:1908-1934`):

```ts
// mobile — skips a manifest older than what is already stored
if (existingSpace && typeof existingTs === 'number' &&
    typeof incomingTs === 'number' && incomingTs < existingTs) {
  logger.debug('[space-manifest] skipped: stale manifest ...');
  break;
}
```

So the two clients disagree about which record wins, which makes this a parity
defect as well as a correctness one.

## Why it matters

The hub can redeliver historical log entries on reconnect. A replayed older
manifest is still correctly owner-signed — the signature says "the owner really
did send this", not "this is current". Desktop will therefore apply it and
overwrite whatever is stored, silently reverting a newer Space edit: a rename, an
icon change, a channel addition, a role grant, or a newly published invite URL.

Failure is quiet. Nothing errors; the Space just reads as an older version of
itself, and on desktop only. A user would most likely interpret it as a sync
glitch and rename the Space again.

**Not a security hole.** The owner signature is still verified, so a
non-owner cannot forge a manifest. The exposure is limited to replay of
genuinely-owner-signed historical records.

## Suggested fix

Mirror mobile's guard: compare `manifest.timestamp` against the stored space's
`modifiedDate` and skip when the incoming one is strictly older. Fail OPEN —
apply when there is no stored space, when it has no `modifiedDate`, or on an
exact tie — so a first-seen or legitimately-newer update is never blocked.

Prerequisite worth checking first: **do all desktop senders set `modifiedDate`?**
The invite path does as of the pending PR. `SpaceService.updateSpace` and the
other broadcast paths need auditing — a guard that compares against a field
half the senders never populate would drop legitimate updates, which is worse
than the bug it fixes.

## Verification

Cannot be proven by unit test alone in any convincing way, since the failure
needs a real hub replaying real historical entries. Minimum bar:

- [ ] Audit every desktop path that sends a `space-manifest` and confirm each
      sets `modifiedDate`
- [ ] Unit test: an older manifest does not overwrite a newer stored record
- [ ] Unit test: a first-seen manifest, a manifest with no stored
      `modifiedDate`, and an exact tie all still apply
- [ ] Cross-client: rename a Space on mobile, confirm desktop still receives it
      (guards against the audit above having missed a sender)

## Related

- [`2026-08-11-public-invite-link-never-reaches-existing-members.md`](2026-08-11-public-invite-link-never-reaches-existing-members.md)
  — flagged this as "unchecked: whether this repo's receive handler has an
  equivalent staleness guard". It does not. This issue is that answer.
- `src/services/MessageService.ts:5193` — the handler
- `quorum-mobile/context/WebSocketContext.tsx:1908-1934` — the reference implementation

---

*Last updated: 2026-08-19*
