---
type: task
title: "Desktop has no self-echo guard on receipt ack intercepts — mobile does"
status: in-progress
created: 2026-08-01
priority: low
effort: tiny if it needs fixing (one condition; `selfAddress` is already a parameter of the intercept). The check is the work, not the fix.
area: DM receipts — src/services/MessageService.ts `interceptControlMessages`
repo: quorum-desktop only
shared_change_required: false
related:
  - "issues/.done/2026-07-27-combined-receipt-ack-and-protocol-options.md (§8 R4 and §9 item 3, where this was found and spun out from)"
  - "quorum-mobile/context/WebSocketContext.tsx `handleDmReceipt` (the platform that DOES guard)"
---

# Desktop has no self-echo guard on receipt ack intercepts

## The asymmetry

Mobile guards both of its ack intercepts on `raw.senderId !== self`:

```ts
// quorum-mobile/context/WebSocketContext.tsx, handleDmReceipt
if (raw.type === 'read-ack') {
  if (svc && raw.senderId !== self && isReceiptEnabled('read', partner) && ...) {
```

Desktop has no equivalent condition (`MessageService.ts:644` and `:656`). It gates on the
receipt settings only.

## Why the fan-out is real — verified 2026-08-01

Not hypothetical on either platform. Desktop's DM send excludes only the **sending device's**
own inbox, not the user's other devices:

```ts
// MessageService.ts:1054-1057
// Get target inboxes from existing encryption states (excluding our own device)
const targetInboxes = sets
  .map((s) => s.tag as string)
  .filter((tag) => tag !== keyset.deviceKeyset.inbox_keyset.inbox_address);
```

So when this device acks the partner's messages, that ack is also delivered to the user's
*other* devices, which decrypt it and run it through the same intercept. Those devices are
being told "these messages were read" about messages **they sent**, by themselves.

(The earlier citation of `MessageService.ts:998` for this has drifted; the filter is at
1054-1057 as of 2026-08-01.)

## Why it might nevertheless be harmless on desktop

The two platforms key the ack to different addresses, and that is the whole question:

| | Key used | Effect of a self-echo |
|---|---|---|
| **Mobile** | `partner` — the conversation partner | Would apply the ack to a real conversation → mis-marks own sent messages. **Guarded.** |
| **Desktop** | `senderAddress` — the envelope sender | A self-echo's sender is our *own* user address, so the ack lands on a conversation keyed `self/self`, which does not exist. |

If that reasoning holds, desktop's write paths no-op: `updateMessagesReadAt(self, self, ...)`
selects no rows, and the React Query prefix for a self-addressed conversation matches no
cache entry. The only residue would be a junk entry in the in-memory watermark map keyed by
our own address, which nothing subsequently reads.

**That is reasoning, not evidence.** It has never been observed on a real two-device desktop
setup, which is why this is filed as a question rather than as a bug or a closed non-issue.

## What to actually check

Two desktop devices signed in as the **same** user, plus a third account as the DM partner.

1. Partner sends several messages to the user.
2. Read them on device A only.
3. On **device B**, check whether anything in that conversation, or in any self-addressed
   conversation, gained a tick it should not have.

Instrumenting the intercept to log `raw.senderId`, `senderAddress` and `selfAddress` on every
ack for the duration of the run is worth more than the visual check: it settles what the
self-echo actually looks like on arrival, which is the thing currently being inferred.

## The fix, if the check finds damage

One condition. `selfAddress` is already a parameter of `interceptControlMessages`
(`MessageService.ts:633`), so it is available at both intercept sites with nothing to thread
through:

```ts
if (raw.type === 'read-ack') {
  if (this.receiptService && readReceiptsEnabled && raw.senderId !== selfAddress) {
```

Keep returning `true` either way — the message must still be intercepted and never saved,
whoever sent it. Dropping the `return true` is how un-intercepted control messages reach
`saveMessage`, die on a NOT NULL constraint, are never acked, and redeliver forever.

## Scope note

This pre-dates the read acks that name what they read (option 2b), and 2b does not worsen it:
named ids are the *partner's* message ids and so can never match our own messages. The
high-water-mark path is not covered by that reasoning, which is exactly why the question
stayed open when 2b closed.

---

*Last updated: 2026-08-01*
