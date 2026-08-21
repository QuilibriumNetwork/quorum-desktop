---
type: task
title: "Audit: does every receive handler authorize the same object it acts on?"
status: open
priority: high
created: 2026-08-21
updated: 2026-08-21
area: receive-side authorization
---

# Handler identifier-mismatch audit

> **Do this before anything else in this folder.** It is read-only and cheap, and
> its result changes what the rest of the queue is worth. See
> [README.md](../README.md).

## What & why

A receive handler often pulls **more than one identifier** out of an incoming
frame — a target id, a thread id, a channel id, a message id. Every one of those
is written by the sending client and none is inherently trustworthy.

The failure this audit looks for:

> The permission check reads identifier **A**. The mutation acts on identifier
> **B**. Nothing requires A and B to refer to the same thing.

When that happens the authorization is real, correct, and about the wrong object.
The attacker names something harmless they legitimately own for the check, and
something else entirely for the effect. It is a classic confused deputy, and no
amount of type classification catches it — the handler is enrolled, dispatched
and verified, and still wrong.

**This is not hypothetical in this codebase.** Two issues fixed in desktop #361
were both in this class. Detail is private (`.secret/.done/`, ask the operator);
what matters here is that the class is live and was found twice by review rather
than by any systematic pass. That is what this audit replaces.

## Scope

Every receive-side handler in `quorum-desktop`, and the same sweep in
`quorum-mobile` if the shape repeats there:

- every `content.type === ` branch in `src/services/MessageService.ts`
- every `envelope.message.type === ` branch (the hub-envelope chain — note this
  universe is **not** part of `MessageContent` and is easy to miss)
- `ThreadService`, and any other service reached from those chains

## Steps

- [ ] List every receive handler and, for each, **every identifier it reads from
      the frame**. Not just the obvious one.
- [ ] For each handler, answer one question: **is the identifier the
      authorization reads the same one the mutation acts on?**
- [ ] Mark each handler with exactly one verdict:
      - `derived` — the second id is computed by the receiver from the first, so
        a mismatch is impossible. **This is the goal state.**
      - `checked` — both come off the wire, but the handler explicitly refuses
        them when they disagree. Safe, but a convention someone must remember.
      - `unlinked` — both come off the wire and nothing ties them together.
        **This is a finding.**
      - `single` — only one identifier; nothing to mismatch.
- [ ] For every `unlinked`, work out what the mutation can actually reach, and
      whether it is destructive. An unlinked pair that only reads is a lower
      priority than one that deletes.
- [ ] For every `unlinked` that is destructive or privileged, check whether the
      id could instead be **derived**. Several already have a derivation the
      codebase computes on the send side and simply does not re-check on receive.

## Definition of done

- [ ] A table covering every handler, with a verdict for each. No blanks — an
      unexamined handler is recorded as unexamined, not omitted.
- [ ] Each `unlinked` finding has: what it can reach, whether it is destructive,
      and whether derivation is available.
- [ ] The table says plainly what was **not** covered and why.
- [ ] If any finding is a live exploitable weakness, it is written up in
      `.agents/issues/.secret/` — **not here**, not in a PR body, not in a commit
      message. This repo is public.
- [ ] If nothing is found, that is a genuine and valuable result. Record it with
      the same rigour, including how many handlers were examined, so the next
      person knows the sweep really happened.

## Notes

- **This produces a document, not a diff.** Resist fixing things as you go: a
  half-audit plus two fixes is worse than a complete audit, because nobody can
  tell afterwards which handlers were actually examined.
- Reading is not evidence of absence. If a handler is hard to trace, say so and
  mark it unexamined rather than guessing `single`.
- Rationale and the two prior incidents: §1b of the private design doc.

---
*Last updated: 2026-08-21*
