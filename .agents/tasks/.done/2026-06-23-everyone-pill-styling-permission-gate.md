---
type: task
title: "Gate @everyone pill styling on sender permission (render-side), not just the wire flag"
status: done
created: 2026-06-23
urgency: low (cosmetic; notification side already enforced)
found_via: mobile↔desktop @everyone audit 2026-06-23 (mobile fix shipped same day)
related_files:
  - src/components/message/Message.tsx
  - src/components/message/MessageMarkdownRenderer.tsx
  - src/hooks/business/messages/useMessageFormatting.ts
related_bug: .agents/bugs/2026-06-12-everyone-mention-owner-bypass-send-side-only.md
mirror_of: quorum-mobile commit "fix(mentions): only style @everyone when the sender was authorized"
---

# Gate @everyone pill styling on sender permission

## Problem

Desktop renders `@everyone` in a message body as a styled mention pill whenever
`message.mentions?.everyone === true` (the wire flag) — with NO re-check of the
sender's `mention:everyone` permission at render time. So an unauthorized sender
who sets/ spoofs the flag gets a styled `@everyone` pill on every honest viewer's
screen.

This is cosmetic only — the NOTIFICATION path is already correctly gated
(`isMentionedWithSettings` re-checks `hasPermission(senderId, 'mention:everyone',
space)`, so no badge/alert fires for an unauthorized @everyone). But the styled
PILL still appears, which carries implied authority (looks like a real all-call)
and is inconsistent with the trust rule the notification path enforces.

Mobile fixed this on 2026-06-23 (see mirror_of). Desktop should match.

## Current desktop behavior (confirmed)

- `Message.tsx:~1155`: `hasEveryoneMention={message.mentions?.everyone}` — raw wire
  flag, no permission check.
- `MessageMarkdownRenderer.tsx:~304-323`: injects `<<<MENTION_EVERYONE>>>` token
  when `hasEveryoneMention` is true; renders styled span at ~615-621.
- `useMessageFormatting.ts:~118-127` (legacy token path): styles `@everyone` when
  `message.mentions?.everyone` — no permission check.
- (Also `useMessageFormatting.isMentioned` ~L50 trusts `mentions.everyone` for the
  viewport highlight animation — same gap, same fix.)

## Fix (mirror mobile's approach)

Compute a single `everyoneAuthorized` boolean where the message + space are in
scope (the message list / Message component), and gate the pill on it instead of
the raw flag:

```ts
const everyoneAuthorized =
  message.mentions?.everyone === true &&
  hasPermission(message.content.senderId, 'mention:everyone', space); // role-only, no owner bypass
```

Thread `everyoneAuthorized` to:
- `Message.tsx` → `hasEveryoneMention={everyoneAuthorized}` (instead of the raw flag).
- `MessageMarkdownRenderer.tsx` (already keyed on `hasEveryoneMention`, so passing
  the gated value is enough).
- `useMessageFormatting.ts` token builder + `isMentioned` (gate the @everyone
  branch on `everyoneAuthorized`).

`space` is already available in the message-list context (used elsewhere for
permission checks). `hasPermission` is the shared role-only check (owner bypass
already removed in shared `fc73eb2`).

## Verify
- Authorized sender's @everyone → styled pill (unchanged).
- Unauthorized sender's @everyone → plain text (no pill).
- No `mentions.everyone` flag → plain text.
- Notification behavior unchanged (already gated).

## Note
Net effect = consistency: the render layer now respects the same "don't trust a
sender's @everyone claim" rule the notification layer already enforces. Not a
security fix (a hostile client bypasses all client code); it removes a misleading
visual-authority signal and aligns the two layers.

## Resolution (2026-06-24)

Implemented in worktree `secondary`, branch `session-secondary-2026-06-24`,
commit `380396d5`. Mirrors quorum-mobile `c144d3c`.

Computed `everyoneAuthorized = mentions.everyone === true && hasPermission(
senderId, 'mention:everyone', { roles })` (role-only — `hasPermission` only reads
`space.roles`, so a `{ roles }` shim is sufficient; no full Space object needed
and no owner bypass) at each render site where space roles are in scope, then
gated the pill on it instead of the raw wire flag:

- **Message.tsx** — one `useMemo` feeds all three paths: the markdown renderer
  (`hasEveryoneMention={everyoneAuthorized}`), the legacy token path
  (`processTextToken`), and the viewport self-highlight (`isMentioned`, via the
  hook). The hook (`useMessageFormatting`) gained an `everyoneAuthorized` option
  and gates both `processTextToken`'s @everyone branch and `isMentioned`.
- **MessagePreview.tsx** — same predicate from its own `spaceRoles` prop, so
  pinned-message previews authorize correctly. Bookmarks render MessagePreview
  without roles → @everyone safely falls back to plain text (never an
  unverifiable pill).
- **NotificationItem.tsx** — same predicate, so the notification preview text
  matches the message-list rule (notifications are pre-gated, but recomputing
  keeps the render layer self-consistent rather than trusting the raw token).

Verified against current code: the report's claims were all accurate (markdown
path at `Message.tsx:1155` was the live one — `ENABLE_MARKDOWN = true`; the
notification path was already gated via shared `isMentionedWithSettings` →
`hasPermission`, `mentions.ts:306-313`). The report's line numbers were
approximate (written on the fly) but substantively correct. The only refinement:
`useMessageFormatting` is the legacy token path; the markdown path is what users
actually see — both are now gated.

Tests: added `src/dev/tests/utils/everyonePillAuthorization.unit.test.ts`
(7 cases against the real shared `hasPermission`: flag-set-and-authorized,
spoofed/unauthorized, flag-unset, unknown sender, missing senderId, no-roles
fallback, no-owner-bypass). tsc clean (exit 0); eslint clean (only pre-existing
warnings unrelated to this change).

Changed files:
- `src/components/message/Message.tsx`
- `src/components/message/MessagePreview.tsx`
- `src/components/notifications/NotificationItem.tsx`
- `src/hooks/business/messages/useMessageFormatting.ts`
- `src/dev/tests/utils/everyonePillAuthorization.unit.test.ts` (new)

*Last updated: 2026-06-24*
