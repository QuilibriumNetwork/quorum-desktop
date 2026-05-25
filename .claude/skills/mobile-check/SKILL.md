---
name: mobile-check
description: Use when the user asks to inspect, verify, or run something against the sibling `quorum-mobile` (React Native) or `quorum-shared` repos. Triggers on "check on mobile", "look at quorum-mobile", "verify in shared", "does this exist in shared", "check the mobile side".
---

# Check `quorum-mobile` or `quorum-shared`

Switch context to one of the sibling repos and answer the user's request against it.

## Repos

- `..\quorum-mobile` — React Native mobile app (sibling directory)
- `..\quorum-shared` — shared components / hooks / utilities consumed by both `quorum-desktop` and `quorum-mobile`

## Approach

1. Read the user's request to determine which repo applies (mobile, shared, or both).
2. Run searches, opens, and verifications against that repo's path.
3. Cross-reference with this repo when the question is about parity (e.g. "does mobile already have X that desktop has?").

## Architectural context

Before diving in, skim `.agents/docs/quorum-shared-architecture.md` if the request involves the boundary between desktop, shared, and mobile.

## Related skills

- **migrate-to-shared** — when extracting code from desktop into shared
- **update-shared** — when adding small additions (icon, type, hook) to shared
