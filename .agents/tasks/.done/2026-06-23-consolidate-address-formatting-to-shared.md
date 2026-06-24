# Consolidate address formatting/truncation into `@quilibrium/quorum-shared`

**Status:** Phase 1 ✅ (shared, PR #49 merged 2026-06-24) · Phase 2 ✅ (desktop, branch `feat/consolidate-address-formatting`, committed 2026-06-24) · Phase 3 ⏳ (mobile — blocked on shared publish; see `quorum-mobile/.agents/tasks/.todo/2026-06-24-adopt-shared-formatAddress.md`)
**Author:** audit + plan, 2026-06-23
**Scope:** quorum-shared (add util) → quorum-desktop (migrate) → quorum-mobile (migrate, mobile-paced)

> **Update 2026-06-24:** desktop adopted 6/6 at every site (not the 4/4-in-tight-spots split originally drafted) — desktop is a wide viewport and 4/4 was judged unnecessary. The onboarding account-address input keeps 10/8. Phase 3 (mobile) likewise uses fixed mode pairs (`short 4/3`, `medium 6/4`, `long 8/6`) with `scaleFactor` dropped.

---

## Problem

Address truncation (`QmQuCGpEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imXST1` → a short display label) is implemented **independently and inconsistently** across all three repos. The same address renders differently between desktop and mobile, and even between screens *within* each app.

This matters because the truncated string is used for **identity verification** (confirming you're messaging the right person). Two concrete consequences:

1. **No cross-platform parity.** A user who sees `QmQu…XST1` on desktop and `QmQuCG…imXST1` on mobile can't visually cross-check identity.
2. **Weak anti-grinding.** Short anchors (esp. last-6-only) are cheap to grind for impersonation/address-poisoning. See the entropy analysis below.

### The `Qm` entropy problem (the reason this plan exists)

Every Quilibrium address is a CIDv0: `0x12 0x20 | <32-byte SHA-256 digest>` base58btc-encoded (see `quorum-shared/src/qns/deriveAddress.ts:28-35`). The leading `0x12 0x20` **always** encodes to the `Qm` prefix. So `Qm` carries **zero entropy** — it is identical for every address.

Implication: a naive `slice(0, 6)` prefix spends 2 of its 6 chars on the constant `Qm`, leaving only **4 meaningful** leading chars. A "6/6" scheme is really a **4/6** = 10-meaningful-char anchor wearing a 12-char costume.

| Scheme | Meaningful chars | Grind cost (≈58^n) | Verdict |
|---|---|---|---|
| last-6 only | 6 | 3.8 × 10^10 (~GPU-hours) | grindable |
| naive 6/6 (= effective 4/6) | 10 | 4.3 × 10^17 | better, but short |
| **Qm-aware 6/6 (= true 6 meaningful + 6)** | **12** | **1.4 × 10^21** | infeasible to grind |

**Fix:** keep `Qm` visible (it's the brand image — hard requirement) but **don't spend slice budget on it**. Take `start` meaningful chars *after* the `Qm` prefix. Same screen width, two extra real entropy chars, true 12-char anchor.

> **Note on threat model:** This hardens against *grinding* (cheap automated impersonation), which is the realistic attack. It does NOT make truncation a substitute for real identity verification — a human still won't catch a single swapped middle char at a glance. For genuine trust decisions the UI should still surface the full address (copyable) or a verification flow. Truncation stays a *disambiguation + anti-grind label*, not proof of identity.

---

## Current state (audit 2026-06-23)

### quorum-shared — nothing usable today
- No exported address formatter. Only a **private, non-exported** `truncate` (`6…4`, Unicode `…`) buried in `src/utils/resolveDisplayName.ts:25`.
- `src/utils/formatting.ts` already holds generic display formatters (`truncateText` etc.), uses `…` (Unicode `…`), and is in the barrel — natural home.
- Package: `@quilibrium/quorum-shared`, version `2.1.0-33`.

### quorum-desktop — three+ inconsistent implementations, none shared
- `src/utils.ts:27` `truncateAddress(start=4, end=4)`, sep `...` (ASCII)
- `src/utils/deviceInfo.ts:70` duplicate `truncateAddress` fixed 4/4, sep `...`
- `src/utils.ts:39` `getAddressSuffix` → `#` + last-6 (the identity-fallback; weakest)
- `src/components/message/TypingIndicator.tsx:20` local `truncateAddress` 6/4
- Inline bare suffixes: `MessageList.tsx:312,316` `slice(-6)`; `useChannelMessages.ts:168,172` `slice(-6)`; `MessagePreview.tsx:196` `slice(-8)`
- Inline both-ends: `DisplayNameStep.tsx:42` `10/8`
- Prefix-only: `ReactionsModal.tsx:53`, `ReactionsList.tsx:113`, `ContextMenu.tsx:122` `slice(0,8)`; `useMessageFormatting.ts:144` `@`+`substring(0,8)`
- Non-display (leave alone): `useUserSettings.ts:267` backup-filename suffix `slice(-6)`; `dbDumpUtil.ts:62` dev tool
- Dependency on shared: **`link:../quorum-shared`** (consumes source live)

### quorum-mobile — one canonical util + ~18 inline divergences
- Canonical `utils/formatAddress.ts`: `truncateAddress(addr, mode)` modes `short=4/3`, `medium=6/4`, `long=8/6`, **screen-scaled via React Native `Dimensions`**, Unicode `…`; plus `formatAddress(addr, chars=6)` symmetric; plus `truncateName`. Used in ~31 sites across ~17 files.
- ~18 UI sites bypass the util with inline slices: `DirectMessagesList.tsx:107` `8/4` (the DM-list screenshot), wallet/QNS/profile sites with `8/6`, `10/8`, `10/6`, `6/4`, `4/3`, mixing `...` ASCII and `…` Unicode.
- Dependency on shared: **pinned to `2.1.0-32`** (published) — will NOT see new shared code until shared is published AND mobile bumps the pin.

**Synced? No** — not across repos, not even within each repo. Different char counts, separators (`...` vs `…`), and prefixes (`#`).

---

## Decision

1. **Add one canonical, pure, Qm-aware `formatAddress` to `quorum-shared`** (`src/utils/formatting.ts`).
2. **Separator:** Unicode `…` (`…`) — matches existing `truncateText` house style and mobile's canonical util.
3. **`Qm` always visible** (brand) but excluded from the meaningful-char budget.
4. **Defaults:** `start=6, end=6` → `Qm` + 6 meaningful + `…` + 6 = a true 12-char anchor, e.g. `QmWXgV6G…wFBKnw`.
5. **Drop mobile's `Dimensions` screen-scaling entirely (decided 2026-06-24).** Shared stays pure/fixed-width, and mobile drops its `scaleFactor` too — modes map to fixed `start`/`end` pairs exactly like desktop, so the two platforms render an identical truncation for a given preset. Rationale: the `scaleFactor` scaled by *device size*, not by the label's actual container, so it never fit-to-width; it only ever added a couple of leading chars on tablets (≤393pt phones already saw `scaleFactor ≈ 1.0`, i.e. no effect). Dropping it costs nothing on phones and gives true cross-platform parity.
6. **Additive-only in shared** (never remove/rename existing exports). Mobile migrates on its own cadence after shared is published and the pin is bumped (per the don't-break-mobile rule).
7. **Adaptivity = preset-based, NOT container-aware (decided 2026-06-23).** Truncation length is chosen per call site via the `start`/`end` args (or `short`/`medium`/`long` presets on mobile's wrapper), not by measuring available pixel width. We consciously rejected two alternatives:
   - **Mobile's device-width scaling** (`Dimensions`-based `scaleFactor`) is dropped from BOTH the shared util AND mobile itself — it's non-portable, and it never measured the actual label's container anyway (it scaled by *phone size*, so a cramped DM row and a wide profile header got the same result on one device). It only changed output on tablets/large phones (>393pt); normal phones already saw no scaling. We drop it for true cross-platform parity (decided 2026-06-24): a given preset now renders identically on desktop and mobile.
   - **True container-aware truncation** (measure available width with ResizeObserver / `onLayout`, fit the largest start/end, re-truncate on resize) was considered and rejected for v1. Rationale: (a) it's a measuring *primitive/component*, not a string util — wrong layer for `formatting.ts`; (b) for an **identity anchor**, shrink-to-fit is actively undesirable — a cramped container could silently drop the anchor below grind-resistant length. A fixed per-site floor is safer than "whatever fits." If a genuinely dynamic-width site appears later, build it as a separate primitive on top of `formatAddress`; do not fold measurement into the util. Keep ~12 meaningful chars as the floor for identity-bearing sites.

---

## The shared function

`quorum-shared/src/utils/formatting.ts` (append):

```ts
/**
 * Truncate a Quilibrium address for display.
 *
 * Every Quilibrium address is a CIDv0 ("Qm" + 44 base58 chars); the "Qm"
 * prefix is a constant multihash header (0x12 0x20) and carries ZERO entropy.
 * We keep "Qm" visible (brand recognizability) but do NOT spend the `start`
 * budget on it — `start` counts MEANINGFUL chars after the prefix. This yields
 * a true `start + end`-char discriminating anchor, which matters for resisting
 * address-grinding/impersonation. Defaults (6/6) give a 12-char anchor.
 *
 * Truncation is a disambiguation + anti-grind label, NOT identity proof —
 * surface the full address for real trust decisions.
 *
 * @param address  Full address (or @username, returned verbatim).
 * @param start    Meaningful leading chars to show AFTER the Qm prefix. Default 6.
 * @param end      Trailing chars to show. Default 6.
 */
export function formatAddress(
  address: string | undefined | null,
  start = 6,
  end = 6,
): string {
  if (!address) return '';
  if (address.startsWith('@')) return address; // username passthrough

  // 'Qm' = constant CIDv0 multihash prefix → zero entropy. Keep it visible,
  // but don't count it toward `start`.
  const hasQm = address.startsWith('Qm');
  const head = hasQm ? 2 : 0;

  // If too short to truncate meaningfully, return as-is.
  if (address.length <= head + start + end + 1) return address;

  return `${address.slice(0, head + start)}…${address.slice(-end)}`;
}
```

Add to `src/utils/index.ts` barrel if `formatting.ts` exports aren't already re-exported (verify: `formatting` is in the utils barrel — `truncateText` is exported from shared, so it is).

**Resolved 2026-06-24 (was an open question):** mobile keeps its `truncateAddress(addr, mode)` wrapper for a non-breaking migration, but each mode delegates to shared `formatAddress(addr, start, end)` for the actual slice (option (a)). The `Dimensions`-based `scaleFactor` is **removed**, not kept: modes map to fixed `start`/`end` pairs, so desktop and mobile render identically for a given preset. Suggested fixed mapping (no scaling): `short → (4, 3)`, `medium → (6, 4)`, `long → (8, 6)` — i.e. today's phone (`scaleFactor ≈ 1.0`) values frozen as constants. A later cleanup may collapse to `formatAddress` everywhere and drop the mode wrapper (option (b)), but that's optional churn, not required for parity.

---

## Steps

### Phase 1 — quorum-shared (additive)
1. Branch in quorum-shared (per `feedback_quorum_shared_workflow`: create branch, user opens/merges PR).
2. Append `formatAddress` to `src/utils/formatting.ts` (code above).
3. Confirm it's exported through `src/utils/index.ts` → `src/index.ts` barrel.
4. Add a unit test: `Qm`-aware slicing, `@username` passthrough, short-address passthrough, non-Qm address fallback, exact output `QmWXgV6G…wFBKnw` for a known input.
5. Verify build: shared builds web + native bundles cleanly.
6. **Do NOT** modify or remove the private `truncate` in `resolveDisplayName.ts` in this phase (additive-only; separate optional cleanup later).
7. Bump shared version, publish, so mobile can later pin to it.

### Phase 2 — quorum-desktop (consumes `link:` — available immediately after Phase 1)
Replace each desktop site with `formatAddress` from `@quilibrium/quorum-shared`. Map old → new:
- `truncateAddress(a, 4, 4)` / `deviceInfo.truncateAddress` → `formatAddress(a, 6, 6)` (or `4,4` where width-constrained — decide per site).
- `getAddressSuffix(a)` (`#`+last6) → **behavior change**: this is a both-ends upgrade. Decide whether the `#` prefix stays (it's a visual marker, not entropy). Recommend: `#${formatAddress(a, 6, 6)}` only where the `#` is meaningful UI, else plain `formatAddress`.
- Bare `slice(-6)` / `slice(-8)` fallbacks (MessageList, useChannelMessages, MessagePreview) → `formatAddress(senderId, 6, 6)`. **This is the biggest correctness win** — these are the weakest (suffix-only) identity fallbacks.
- `DisplayNameStep.tsx:42` `10/8` → `formatAddress(a, 10, 8)` (keep wider look for the disabled input).
- Prefix-only sites (`ReactionsModal`, `ReactionsList`, `ContextMenu`, `useMessageFormatting`) → these show only a head, no tail. Either leave as-is (out of scope; they're not identity anchors) OR switch to `formatAddress` for consistency. Recommend leaving prefix-only tooltips alone in v1.
- **Leave non-display sites untouched:** `useUserSettings.ts:267` (backup filename), `dbDumpUtil.ts:62` (dev tool).
4. Delete the now-dead desktop utils (`truncateAddress` in `utils.ts` + `deviceInfo.ts`, local one in `TypingIndicator.tsx`, and `getAddressSuffix` if fully replaced). Keep whatever still has non-address callers.
5. Verify: `npx tsc --noEmit`, `yarn lint`, run the app, eyeball DM list / message list / profile sidebar render `Qm…` correctly.

### Phase 3 — quorum-mobile (mobile-paced, AFTER shared is published)
1. Bump mobile's `@quilibrium/quorum-shared` pin from `2.1.0-32` to the newly published version.
2. Refactor `utils/formatAddress.ts`: keep `truncateAddress(addr, mode)` as a thin wrapper whose modes delegate to shared `formatAddress(addr, start, end)` for the actual slice (option (a) above). This keeps mobile's API, gains the Qm-aware anchor, and removes the duplicated slice logic. **Remove the `Dimensions`-based `scaleFactor`** and the `SCREEN_WIDTH`/`BASE_WIDTH` constants entirely (decided 2026-06-24): map each mode to a fixed `start`/`end` pair — `short → (4, 3)`, `medium → (6, 4)`, `long → (8, 6)` — matching desktop so a preset renders identically on both platforms. `truncateName`'s `Math.round(16 * scaleFactor)` default must also be replaced with a fixed value (use `16`). Do not introduce pixel-measurement here.
3. Migrate the ~18 inline sites to the util (`DirectMessagesList.tsx:107` is the visible DM-list one).
4. Standardize separators on `…` (drop the inline `...` ASCII variants).
5. Verify mobile build + key screens.

---

## Risks / guardrails
- **Don't break mobile** (`feedback_dont_break_mobile_on_shared_changes`): shared change is additive-only; mobile migrates separately after pin bump. ✅
- **Brand:** `Qm` must remain visible in every truncated address. The function guarantees this (head always included). ✅
- **Behavior change is intentional** for the suffix-only fallbacks (last-6 → both-ends). This is the security fix, not a regression — call it out in the PR description, and per `feedback_pr_commit_no_noneffect_editorializing` describe only what the change does.
- **Width:** `6/6` Qm-aware is ~2 chars wider than old `4/4`. Check tight layouts (nav rail, DM list rows, chips) don't overflow; drop to `4/6` or `4/4` at genuinely width-constrained sites.

---

*Last updated: 2026-06-24*
