# Implementation plan: per-message indicators on grouped (continuation) messages — DESKTOP

**Status:** ready to execute
**Created:** 2026-07-15
**Scope:** quorum-desktop only (desktop-first; mobile mirrored in a later slice)
**Design:** `2026-06-28-grouped-message-indicators-design.md` (approved)
**Bug:** `2026-06-28-grouped-message-indicators-missing.md`
**Mobile mirror:** deferred — see "Cross-repo follow-up" at the end.

> This plan implements the desktop half only. Per the atlas, desktop is the
> reference layout and higher-confidence repo: fix + validate it fully, then
> mirror to mobile as a separate slice with its own review.

---

## Goal (observable outcome)

In a **grouped conversation** (several consecutive messages from the same sender),
each continuation row shows its own per-message indicators inline after the text:
`(edited)`, unsigned-warning, pinned, bookmark, and — in DMs — the read/delivery
receipt. Today those are silently dropped on continuation rows because they live in
the collapsed header. The header itself stays collapsed (that's the point of
grouping); only the per-message signals return.

**How you'll verify it:** open a DM or channel, send 3+ messages in a row, edit one,
pin one, bookmark one — each continuation row shows the right indicator inline, the
first-in-group/standalone rows look exactly as before (no regression).

---

## Key structural fact (verified against current code)

The content-rendering block in [Message.tsx](../../src/components/message/Message.tsx)
— the big `{(() => { ... })()}` IIFE at ~line 1086–1498 — runs **after both branches**
of the `isCompact ? … : …` ternary (compact branch ~894, header branch ~911). So it
renders identically for compact and non-compact rows. It already builds a
`receiptIndicator` node (~1138) and injects it inline at the end of the last content
line in **both** the markdown path (`suffix={receiptIndicator}`, ~1181) and the
token path (`i === last && receiptIndicator`, ~1358).

**The trailing group is the same mechanism, widened.** Instead of injecting only the
receipt, we inject a small `trailingIndicators` node that contains the full ordered
group, but only when compact. Non-compact rows keep exactly today's behaviour: the
header shows edited/pinned/bookmark/unsigned, and the content block shows only the
receipt. This is why there's no regression to the common case — we branch on
`isCompact` when composing the trailing node.

All required values are already in scope at the render point: `isCompact` (~249),
`isEdited` (~487), `message.isPinned`, `messageActions.isBookmarked`,
`message.signature`, `receiptIndicator` (built ~1138).

---

## Design decision: one small local render, not a new shared component

Build the trailing group as a single `trailingIndicators` node composed **once**
inside the content IIFE, right after `receiptIndicator` is built (~1154). Reasons:

- It needs the same in-scope values the receipt already uses; extracting a component
  would mean threading ~6 props for zero reuse (only this file consumes it).
- It must slot into the **same two insertion points** the receipt already uses
  (markdown `suffix`, token last-line), plus the two media paths. Keeping it a local
  node means those call sites change from `receiptIndicator` → `trailingIndicators`
  with no new wiring.
- Matches the existing pattern in the file (receipt is a local `React.ReactNode`,
  not a component). Follows [[feedback_prefer_most_solid_design]] — least-surprise,
  in-convention.

If a later mobile/shared migration wants to unify, that's a separate migration
decision (atlas §5), not this slice.

---

## Steps (each ends in something testable)

### Step 1 — Compose the `trailingIndicators` node
In the content IIFE, immediately after the `receiptIndicator` block (~1154), add:

```tsx
// On continuation (compact) rows the header is collapsed, so per-message
// indicators have nowhere to show. Reproduce them inline after the text,
// Discord-style. Non-compact rows keep them in the header (unchanged) and
// only carry the receipt here.
const trailingIndicators: React.ReactNode = isCompact ? (
  <span className="message-inline-indicators">
    {isEdited && <span className="text-small text-muted">{t`(edited)`}</span>}
    {!message.signature && (/* unsigned-warning Icon, xs, text-warning, Tooltip */)}
    {message.isPinned && (/* pin Icon, xs, text-accent, Tooltip */)}
    {messageActions.isBookmarked && (/* bookmark Icon, xs, text-accent, Tooltip */)}
    {receiptIndicator}
  </span>
) : receiptIndicator;
```

- **Order (design rule 3):** edited → unsigned → pinned → bookmark → receipt (last).
- **Styling (design rule 4):** reuse the existing header markup verbatim, only drop
  the header-specific `ml-2` spacing and set icons to `size="xs"`. No new style
  variant. Keep the existing Tooltip wrappers and their `id`s (suffix `-compact` to
  keep ids unique vs the header copies, mirroring the existing
  `signature-warning-compact-…` id).
- **Expected observation:** nothing changes yet (node built, not yet injected).
- **Likely failure + signal:** duplicate Tooltip `id` → tooltip mis-targets; fix by
  suffixing `-compact`.

### Step 2 — Inject into the two text paths (post content)
Replace the two `receiptIndicator` call sites with `trailingIndicators`:
- markdown path: `suffix={receiptIndicator}` → `suffix={trailingIndicators}` (~1181)
- token path: `{i === contentData.content.length - 1 && receiptIndicator}` →
  `… && trailingIndicators}` (~1358)

- **Test now:** grouped text messages in a channel show `(edited)`/pinned/bookmark
  inline on continuation rows; DM grouped messages also show the receipt last;
  first-in-group rows unchanged. This is the primary observable outcome.
- **Likely failure + signal:** trailing group floats to the right edge instead of
  flowing after the last word → the `message-inline-indicators` span isn't inline;
  ensure it renders inline (matches how `receiptIndicator` already flows).

### Step 3 — Media continuation rows (embed + sticker) — design rule 5
The embed (~1383) and sticker (~1490) branches have no "last word" to trail. On
**compact** rows only, render `trailingIndicators` in a small left-aligned inline row
directly **below** the media (both branches). Non-compact: unchanged.

- **Test now:** send a grouped image/embed and a grouped sticker as continuation
  rows; pin/bookmark/edit one — indicators appear below the media.
- **Note:** `isEdited` on a sticker/embed is possible (pin/bookmark certainly are);
  render the row whenever the compact group is non-empty. Guard against rendering an
  empty row (all flags false, no receipt) → render nothing.

### Step 4 — CSS for `message-inline-indicators`
Add a minimal rule (find the stylesheet holding `.message-status` and co-locate).
Inline-flex, `gap` matching the existing receipt spacing, vertical-align baseline so
it sits on the text line. Reuse existing tokens per the style-guide; run the
`style-guide` skill before writing CSS.

- **Test now:** spacing looks even; icons align to the text baseline, not floating
  high/low.

### Step 5 — Worst-case crowding pass
Manually reproduce the two verified worst cases from the design:
- Channel: `text (edited) ⚠ 📌 🔖`
- DM: `text (edited) ⚠ 🔖 ✓✓`
Confirm it wraps naturally at a narrow width and doesn't overflow the bubble.

---

## Verification before calling it done

- `npx tsc --noEmit --jsx react-jsx --skipLibCheck` clean, `yarn lint` clean.
- **Smoke test (required — runtime change):** run the app, exercise grouped
  channel + grouped DM, edited/pinned/bookmark/receipt, and confirm non-compact rows
  are visually identical to before. Use the `run` / `browser-debug` skill.
- No new console errors; no duplicate-tooltip-id warnings.

## Shipping

One desktop branch, one PR via `/ship-pr` after the smoke test passes (atlas §2/§6).
PR targets **main** (not develop — see [[project_main_branch]]). Describe only what
the change does; no non-effect editorializing ([[feedback_pr_commit_no_noneffect_editorializing]]).

## Cross-repo follow-up (NOT this slice)

After desktop ships and is validated, mirror to mobile as a separate slice with its
own review — mobile is the higher-bar repo (atlas §2) and needs an explicit iOS
review pass (atlas §3). Mobile specifics already captured in the design:
- Mobile drops MORE than desktop (also loses unsigned-warning + sending spinner) —
  restore those too.
- DM receipts aren't wired into mobile message rows yet; the receipt slot (position
  5) fills in when that lands. Ship positions 1–4 now.
- Must stay additive / not break mobile ([[feedback_dont_break_mobile_on_shared_changes]]).
This desktop slice is independently shippable and observable on its own.

*Last updated: 2026-07-15*
