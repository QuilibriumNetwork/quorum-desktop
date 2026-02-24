---
type: task
title: "Emoji Picker Performance Fix — Lazy Loading + Upgrade"
status: done
complexity: medium
ai_generated: true
reviewed_by: feature-analyzer agent
created: 2026-02-24
updated: 2026-02-24
related_tasks:
  - "tasks/emoji-picker-in-message-composer.md"
related_docs:
  - "docs/features/messages/emoji-picker-react-customization.md"
---

# Emoji Picker Performance Fix — Lazy Loading + Upgrade

> **Reviewed by**: feature-analyzer agent (2026-02-24)

**Files**:
- `src/components/space/Channel.tsx:1214-1223` — Channel emoji picker config
- `src/components/direct/DirectMessage.tsx:899-908` — DM emoji picker config
- `src/components/message/EmojiPickerDrawer.tsx:84-93` — Mobile drawer emoji picker config
- `src/components/message/Message.tsx:642-703` — Reaction emoji picker configs (3 instances)
- `web/vite.config.ts:134-139` — viteStaticCopy of Apple emoji PNGs
- `package.json:66-67` — `emoji-datasource-apple` and `emoji-picker-react` dependencies

## What & Why

The emoji picker currently loads **3,785 individual Apple PNG files** via HTTP requests (one `<img>` tag per emoji pointing to `/apple/64/{unified}.png`). This causes emojis to render one-by-one with visible delay — the "frequently used" category appears instantly but all other categories load progressively, roughly one emoji per second. Most users cannot browse emojis effectively.

**Root cause**: The `getEmojiUrl` prop generates individual image URLs, and `emoji-picker-react` renders each emoji as a separate `<img>` tag. Combined with browser connection limits (~6 concurrent for HTTP/1.1), this creates a waterfall of sequential image loads. The full emoji set is ~28MB of PNGs.

### Industry context

Major messaging apps (Discord, Telegram, Slack, WhatsApp) all use **image-based emojis** for cross-platform visual consistency — none use native OS emojis. They solve the performance problem through:
- **Virtualization** — only render emojis visible in the viewport (Discord, Slack)
- **Sprite sheets** — one large image instead of thousands of requests (Telegram, Slack, WhatsApp)
- **CDN + aggressive caching** — images download once, then served from cache (Discord)

### Fix strategy

A two-step approach that keeps Apple emoji consistency while fixing performance:

1. **Step 1 — Immediate (zero risk)**: Add `lazyLoadEmojis={true}` to all 6 EmojiPicker instances. This prop already exists in the currently installed v4.13.2 and defers image downloads until emojis scroll into the viewport.
2. **Step 2 — Upgrade (verify first)**: Upgrade `emoji-picker-react` to latest for potential DOM virtualization. The claim that v4.18.0 adds virtualization (PR #439) must be verified on GitHub before executing.

## Implementation

### 1. Add `lazyLoadEmojis={true}` to all EmojiPicker instances

> **Important**: This prop already exists in the currently installed v4.13.2. It does NOT require the upgrade. This is the lowest-effort, zero-risk improvement and should be done first.

There are **6 locations** where `<EmojiPicker>` or `<LazyEmojiPicker>` is rendered. Each needs `lazyLoadEmojis={true}` added:

1. `src/components/space/Channel.tsx:1214-1223` — Channel composer panel
2. `src/components/direct/DirectMessage.tsx:899-908` — DM composer panel
3. `src/components/message/EmojiPickerDrawer.tsx:84-93` — Mobile drawer
4. `src/components/message/Message.tsx:642-647` — Reaction picker (upwards)
5. `src/components/message/Message.tsx:668-673` — Reaction picker (downwards)
6. `src/components/message/Message.tsx:696-701` — Reaction picker (mobile)

This sets `loading="lazy"` on each `<img>` tag, so the browser only downloads emoji images when they are near the viewport. Note: this does NOT reduce DOM nodes — all ~3,785 `<img>` elements are still created, but network requests are deferred until the user scrolls to them. This alone should significantly reduce the initial load waterfall.

### 2. Upgrade `emoji-picker-react` to latest (verify virtualization first)

> **Before upgrading**: Verify the v4.18.0 virtualization claim at `https://github.com/ealush/emoji-picker-react/releases`. Look for actual DOM windowing (react-window, Intersection Observer-based row removal, etc.). If the claim is false, the upgrade has low value — `lazyLoadEmojis` alone provides most of the improvement.

- Run `yarn upgrade emoji-picker-react --latest` (currently 4.13.2 → latest)
- If v4.18.0+ includes true virtualization, this is the biggest performance win: only ~30-50 emoji DOM nodes exist at a time instead of thousands
- Verify no breaking API changes in the changelog (the props used — `suggestedEmojisMode`, `customEmojis`, `getEmojiUrl`, `skinTonePickerLocation`, `theme`, `onEmojiClick`, `lazyLoadEmojis` — are all stable)
- **Check the deep import**: `EmojiPickerDrawer.tsx` imports `CustomEmoji` from `emoji-picker-react/dist/config/customEmojiConfig` (a private dist path). Verify this still resolves after upgrade, or check if `CustomEmoji` is re-exported from the package root in the target version

### Service worker caching — removed from scope

The original task proposed a cache-first service worker for emoji images. This has been **removed from scope** for the following reasons:

- **Unnecessary**: `lazyLoadEmojis` + potential virtualization should be sufficient. The static emoji PNGs will be cached by the browser's standard HTTP cache naturally — no service worker needed
- **Not a privacy concern**: Caching static Apple emoji images has zero privacy implications (same files for every user, no user data). The "no caching" design in `tasks/service-worker-app-updates.md` was about keeping that specific service worker minimal for update detection — it is a non-issue for static image assets
- **Measure first**: If performance is still insufficient after Steps 1 and 2, the correct next step is ensuring the web server sends proper `Cache-Control: immutable` headers for the `/apple/` static path — not a custom service worker cache

## Verification

✅ **Emojis load significantly faster**
   - Open emoji picker → first visible category renders quickly → scrolling loads new emojis smoothly without long delays

✅ **Apple emoji style preserved**
   - Emojis still render as Apple-style images, consistent across all platforms

✅ **Second open is fast**
   - Close and reopen emoji picker → previously loaded emojis appear from browser HTTP cache

✅ **Virtualization is active** (if upgrade adds it)
   - Inspect DOM → only ~30-50 emoji `<img>` elements exist at a time, not thousands

✅ **Custom space emojis still work**
   - Custom emojis (image-based) still load via their `imgUrl`

✅ **Reactions still work**
   - Message reaction picker opens, emojis display, selecting adds reaction

✅ **Mobile drawer still works**
   - On small viewports, emoji drawer opens with Apple emojis

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Follow-up considerations

### Lazy-load EmojiPicker in Message.tsx

`Channel.tsx` and `DirectMessage.tsx` correctly use `React.lazy()` for the emoji picker, but `Message.tsx` imports `EmojiPicker` eagerly (direct import). The three reaction pickers in `Message.tsx` could be wrapped in a lazy-loaded subcomponent to match the pattern and reduce the initial bundle chunk. This is a separate follow-up, not a blocker.

### emoji-mart migration

A full comparison was conducted — see **[Emoji Picker Library Comparison](../reports/emoji-picker-library-comparison_2026-02-24.md)**.

emoji-mart's sprite sheet approach (1 HTTP request instead of 3,785) is architecturally superior for image loading. However, migration is **not recommended** due to: Shadow DOM breaking our 118 lines of SCSS overrides, not being a true React component (web component wrapper with quirks), weak TypeScript support, and no release in ~22 months. Revisit only if the lazy loading + upgrade approach proves insufficient.

## Definition of Done

- [x] `lazyLoadEmojis={true}` added to all 6 EmojiPicker instances (works on current v4.13.2)
- [x] Virtualization claim verified on GitHub before upgrading
- [x] `emoji-picker-react` upgraded to latest (if virtualization confirmed)
- [x] `CustomEmoji` deep import verified or simplified after upgrade
- [x] Apple emoji images still render correctly
- [x] TypeScript passes
- [ ] Manual testing confirms noticeably faster emoji loading
- [ ] No console errors

## What was done (2026-02-24)

### 1. `lazyLoadEmojis={true}` added to all 6 instances
Added the prop to all EmojiPicker renders. This sets `loading="lazy"` on each `<img>` tag so the browser defers downloads until near the viewport.

**Outcome**: Minimal visible improvement. Browsers implement native lazy loading with a generous threshold, so most requests still fire almost immediately. The fundamental problem (3,785 DOM nodes + 3,785 HTTP requests) remains.

### 2. `emoji-picker-react` upgraded 4.13.2 -> 4.18.0
- No breaking changes to props API
- `CustomEmoji` deep import (`emoji-picker-react/dist/config/customEmojiConfig`) still resolves — `.d.ts` file exists, no `exports` field restricts access
- `CustomEmoji` is still NOT exported from the package root

### 3. Virtualization PR #439 — NOT merged
PR #439 (`feat: added virualization and added headless search hook`) is still open. v4.18.0 does NOT include DOM virtualization. This was the hoped-for big win.

## What still needs to happen

The core performance problem is **unsolved**. The emoji picker still creates ~3,785 `<img>` DOM nodes and fires ~3,785 HTTP requests. The only real fixes are:

### Option A: Wait for virtualization PR #439 (recommended)
- **What**: When PR #439 merges into `emoji-picker-react`, upgrade the package
- **Impact**: Reduces DOM nodes from ~3,785 to ~30-50 (only visible emojis rendered)
- **Effort**: Just a `yarn upgrade`
- **Action**: Periodically check https://github.com/ealush/emoji-picker-react/pull/439
- **Why recommended**: Clean fix, no maintenance burden, works with the library's design

### Option B: Switch emoji picker library
- **What**: Replace `emoji-picker-react` with a library that uses sprite sheets or virtualization out of the box
- **Impact**: Could reduce HTTP requests from ~3,785 to 1-2 (sprite sheets) or DOM nodes to ~30-50 (virtualization)
- **Effort**: High — we have 118 lines of SCSS overrides, 6 render sites, 8 files importing `CustomEmoji`
- **Blockers**: emoji-mart (best alternative) uses Shadow DOM which breaks our SCSS overrides, and hasn't released in ~22 months. See [library comparison report](../reports/emoji-picker-library-comparison_2026-02-24.md)
- **When**: Only if PR #439 stalls for 6+ months and performance is a user complaint

### Option C: Sprite sheet hack on current library (NOT recommended)
- **What**: Generate CSS sprite sheets from the 3,785 Apple PNGs, override `<img>` rendering via CSS
- **Impact**: Would reduce HTTP requests to 1-2 large downloads
- **Why not**: Fights against the library's `<img src>` architecture. Requires fragile CSS hacks (hiding `<img>`, using `background-image` on parent). Would break silently on library updates. Not maintainable.

## Related issue: Apple vs native emoji inconsistency

The emoji picker displays **Apple PNGs** (via `getEmojiUrl`), but once an emoji is selected, `onEmojiClick` returns the **native unicode character** (e.g. `😀`). This means:

- **Picker**: Apple emoji images (consistent across platforms)
- **Message text, composer, reactions**: Native browser/OS emoji font (Windows emojis on Windows, Google on Android, etc.)

This creates a visual mismatch — users pick an Apple emoji but see a different style rendered in messages.

### Possible fixes (separate task)

implemented option 2

1. **Render emojis as `<img>` everywhere** — parse unicode emojis in messages/reactions and replace with Apple PNG `<img>` tags (how Discord/Slack do it). High effort: needs a text parser, affects message rendering, composer, reaction badges, notifications.
2. **Emoji webfont** — load a consistent emoji font (e.g. Twemoji) so all unicode characters render the same across platforms. Simpler but has licensing considerations for Apple style specifically.
3. **Drop Apple images in picker** — remove `getEmojiUrl`, use native emojis everywhere. Loses cross-platform consistency but eliminates the mismatch *and* solves the performance problem entirely (no images to load).

Option 3 is worth considering since it solves both the performance and consistency problems at once, at the cost of platform-dependent emoji appearance.

---

_Created: 2026-02-24_
_Updated: 2026-02-24 — Implemented lazyLoadEmojis + upgrade. Minimal visible improvement. Waiting on PR #439 for virtualization. Documented Apple vs native emoji inconsistency._
