---
type: bug
title: 'quorum-mobile: 11 type errors, 10 of them in the untested calling code'
status: open
priority: medium
created: 2026-08-24
updated: 2026-08-24
---

# quorum-mobile has 11 type errors

## Status

Recorded as a `KNOWN-RED` baseline of 11 in `scripts/verify/baseline.mjs`, not
fixed. The count is a **ceiling**: it may fall, and a twelfth error fails
`yarn verify`. Nothing here needs to be fixed for the gate to ship.

## How this went unnoticed

quorum-mobile had **no `typecheck` script**. TypeScript 5.9.2 was installed and
`tsconfig.json` was present, so the repo *could* be typechecked — nothing ever
asked it to as part of any script, hook or gate. Whether it typechecked on a
given day depended on someone choosing to run `npx tsc --noEmit` by hand.

Added 2026-08-24 as `"typecheck": "tsc --noEmit"`, and wired into the gate's
fast tier (`scripts/verify/steps.mjs`).

## The measurement

MEASURED 2026-08-24, `yarn typecheck` in quorum-mobile: **11 errors**, exit 2.

| File | Errors | Kind |
|---|---|---|
| `services/calling/webrtc-manager.ts` | 7 | handler properties (`onicecandidate`, `ontrack`, `onconnectionstatechange`, `oniceconnectionstatechange`) not declared on the typed `RTCPeerConnection`; two implicit `any` parameters; one possibly-null object |
| `services/calling/farcaster-link.ts` | 3 | a `string` passed where `Uint8Array` is expected, then `.toCompactHex()` and `.recovery` read off the result |
| `app/explore.tsx` | 1 | `href="/(tabs)/explore"` is not in Expo Router's generated route union (it wants `/explore`) |

## Why they are deliberately unfixed

**10 of the 11 are in `services/calling/`, and that subsystem has zero test
coverage.** The gate prints this on every run in its `NOT COVERED` line:

> calling — zero coverage of all 9 WebRTC message types

So there is currently no way to demonstrate that a change there is safe. The
`webrtc-manager.ts` errors in particular look like the types disagreeing with a
runtime that genuinely does fire those handlers (`react-native-webrtc`'s
`RTCPeerConnection` is not the browser one), which means the "fix" could be
either a type declaration or a real behavioural change — and nothing available
today can tell those apart.

Recording them as a baseline is the honest option: it makes the debt visible and
bounded without pretending a blind edit is a fix.

## What would unblock a real fix

1. Coverage for the calling path — the gate has no arm for any of the 9 WebRTC
   message types, so this is a prerequisite, not a nicety.
2. Then `webrtc-manager.ts` (7) as one change, verified against that coverage.
3. `farcaster-link.ts` (3) is independent of WebRTC and may be tractable sooner;
   it looks like a signature mismatch around a key/signature helper.
4. `app/explore.tsx` (1) is unrelated to both and is probably a one-character
   href fix, but it is not worth a PR on its own.

**Lower the baseline in `scripts/verify/baseline.mjs` as each group lands.** The
gate now prints a note asking for exactly that when the count drops below the
recorded number, so a partial fix cannot silently leave the ceiling too high.

## Related

- The gate: [verify-gate.md](../../docs/verify-gate.md)
- The gap that surfaced this: [cross-repo tooling gaps](2026-08-24-verify-gate-cross-repo-tooling-gaps.md)
- The sibling baseline: [mobile lint, 302 errors](2026-08-23-mobile-lint-302-errors.md)

*Last updated: 2026-08-24*
