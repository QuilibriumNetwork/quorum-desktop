---
type: task
title: "Table-driven receive dispatch — make an unclassified handler a compile error"
status: open
priority: medium
created: 2026-08-21
updated: 2026-08-21
area: receive-side authorization / architecture
---

# Table-driven receive dispatch

> Rationale: §4.3 of the private design doc
> (`.agents/issues/.secret/2026-08-20-sender-authentication-is-opt-in-mechanism-level-fix-design.md`).
>
> **Blocked on** [the policy map](2026-08-21-exhaustive-message-auth-policy-map.md).
> There is nothing to dispatch against until that exists.

## What & why

The policy map makes every message *type* classified. It does not make any
handler *consult* it. A map handlers **may** check has the same shape of gap as a
`senderId` field code **may** decline to trust — it protects future types, not
future handlers.

The goal: a new `content.type === ` or `envelope.message.type === ` branch cannot
be added to `MessageService.ts` **at all** without going through classified,
table-driven handling. Writing an unclassified handler becomes a compile error
rather than a lookup someone forgot.

## ⚠️ Risk assessment before any code

This is the most invasive item in the folder and the design doc names it as the
one most likely to be descoped. It restructures two large if/else chains inside a
file of roughly eight thousand lines, on the path every received message takes.

**Do the assessment as a separate, reviewable step and stop there.** It is
legitimate for this brief to end in "we are not doing this, here is why" — that
is a result, not a failure.

- [ ] How many branches are in each chain? Enumerate them.
- [ ] Do any share fall-through, ordering dependencies, or early returns that a
      table cannot express? These are the things that make a mechanical
      conversion unsafe.
- [ ] What is the blast radius if the dispatch table is wrong — silently dropped
      messages, or a loud failure? Silent is much worse here.
- [ ] Can it be done incrementally, one branch at a time, with both paths live?
      If not, say so; a big-bang rewrite of the receive path needs a much stronger
      justification.

## Observable outcome (if it proceeds)

Add a handler for a new message type without classifying it, run `tsc --noEmit`,
and watch it fail.

## Definition of done

Either:

- [ ] The restructure ships, no receive behaviour changes, the full suite is
      green throughout, and the unclassified-handler compile error is
      demonstrated; **or**
- [ ] A written decision not to proceed, with the assessment behind it — and
      **this file updated to say so explicitly**, because the design doc's §4.3
      requires that a descope be stated rather than assumed:
      > "If it is descoped, say so explicitly and accept that 4.2 protects future
      > *types* but not future *handlers*."

Leaving this open and untouched is the one outcome that is not acceptable, since
it silently implies coverage the codebase does not have.

## Notes

If it proceeds, it wants its own decomposition — probably one PR per chain, or
per group of branches. Do not attempt it as a single change. That decomposition
belongs in this folder as further briefs, written after the assessment.

---
*Last updated: 2026-08-21*
