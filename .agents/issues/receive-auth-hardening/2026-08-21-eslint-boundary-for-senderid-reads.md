---
type: task
title: "ESLint boundary: restrict where content.senderId may be read"
status: open
priority: medium
created: 2026-08-21
updated: 2026-08-21
area: receive-side authorization / tooling
---

# ESLint boundary for `senderId` reads

> Rationale: §4.4 of the private design doc
> (`.agents/issues/.secret/2026-08-20-sender-authentication-is-opt-in-mechanism-level-fix-design.md`).

## What & why

`content.senderId` is a plaintext field the **sending** client writes. It is fine
as a display value and must never decide an authorization question. Today nothing
distinguishes the two uses, so a reviewer has to notice by reading.

A `no-restricted-syntax` rule banning `.senderId` reads outside an explicit
allow-list makes every new use land in a diff as a visible allow-list change,
which is the review signal that is currently missing.

## ⚠️ Do NOT rename the field instead

This was considered and rejected on measured grounds. `encryptAndSendToSpace`
does `JSON.stringify` on the `Message` object directly, so **the TypeScript
property name is the wire key**. Renaming it is a breaking wire change on every
message type, non-additive, requiring both clients to update in lockstep for chat
to work at all. The lint rule achieves the review-visibility goal at zero wire
risk.

## Observable outcome

`yarn lint` rejects a diff that reads `content.senderId` in a file not on the
allow-list, and names the file.

## Steps

- [ ] Read the existing prior art in this repo: `eslint.config.js` already
      restricts `resolveIdentity` / `identityFromMaps` to `src/identity/**`, and
      there is a custom AST rule at `eslint-rules/no-ungated-debug-globals.js`.
      Same shape, same repo — follow it rather than inventing a pattern.
- [ ] Enumerate today's legitimate readers and build the initial allow-list from
      **measured** current usage, so the rule lands green.
- [ ] Add the rule.
- [ ] Add a deliberately-violating fixture or a documented manual check proving
      the rule actually fires. A lint rule nobody has seen fail is not known to
      work.

## Definition of done

- [ ] `yarn lint` passes on `main` with the rule active.
- [ ] The rule has been **seen to fire** on a violation, and that is recorded.
- [ ] The allow-list has a comment saying what earns a place on it, so widening
      it is a decision rather than a reflex.

## Honest caveat, from the design doc

An allow-list can be widened under deadline pressure, and that is roughly how the
original bug happened. **This is a backstop, not the mechanism.** The policy map
and dispatch are the mechanism. Do not let this shipping create the impression the
class is closed.

---
*Last updated: 2026-08-21*
