---
type: task
title: "Twemoji Migration — Consistent Emoji Rendering Across App"
status: done
complexity: high
ai_generated: true
reviewed_by: feature-analyzer agent, security-analyst agent
created: 2026-02-24
updated: 2026-02-24
related_tasks:
  - "tasks/emoji-picker-performance-fix.md"
  - "tasks/.done/emoji-picker-in-message-composer.md"
related_docs:
  - "docs/features/messages/emoji-picker-react-customization.md"
  - "reports/emoji-picker-library-comparison_2026-02-24.md"
---

# Twemoji Migration — Consistent Emoji Rendering Across App

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent (2026-02-24)

**Files**:
- `src/components/space/Channel.tsx:1214-1224` — Channel emoji picker config
- `src/components/direct/DirectMessage.tsx:899-909` — DM emoji picker config
- `src/components/message/EmojiPickerDrawer.tsx:84-94` — Mobile drawer emoji picker config
- `src/components/message/Message.tsx:642-708` — Reaction emoji picker configs (3 instances)
- `src/components/message/MessageMarkdownRenderer.tsx:798-831` — Markdown `img` handler (must be updated)
- `src/components/message/ReactionsList.tsx:84-89` — Reaction emoji display
- `web/vite.config.ts:134-139` — viteStaticCopy config (replace Apple with Twemoji)
- `package.json` — Dependencies to add/remove

## What & Why

The app currently has two emoji problems:

1. **Performance**: The emoji picker loads 3,785 individual Apple PNG files via HTTP requests (one `<img>` per emoji pointing to `/apple/64/{unified}.png`), causing slow progressive rendering.

2. **Inconsistency**: The picker shows Apple emojis (via `getEmojiUrl`), but `onEmojiClick` returns native unicode characters. Messages, reactions, and the composer all render using the OS emoji font — Windows emojis on Windows, Google on Android, etc. Users pick an Apple emoji but see a different style once it's inserted.

**Goal**: Switch to Twemoji (Twitter emoji set, CC-BY 4.0 license) **self-hosted** and rendered consistently across the app — in the emoji picker, message bodies, and reactions — using `<img>` tags for cross-platform visual consistency.

## Context

- **Existing pattern**: `MessageMarkdownRenderer.tsx` already uses `react-markdown` with `remark-gfm` and `remark-breaks` plugins — adding a remark plugin for emoji replacement fits naturally
- **Library support**: `emoji-picker-react` v4.18.0 (already installed) supports custom `getEmojiUrl` for any local asset path
- **Asset source**: `emoji-datasource-twitter` v16.0.0 (published Sep 2025, Emoji v16.0, 3,809 PNGs). Uses the same `iamcal/emoji-data` filename format as `emoji-datasource-apple` — drop-in replacement. Note: `twitter/twemoji` is deprecated ([see issue](https://github.com/twitter/twemoji/issues/1453)), but `emoji-datasource-twitter` is maintained independently by iamcal and uses the latest Twemoji art
- **Licensing**: Twemoji is CC-BY 4.0 (legitimate open-source license, requires attribution). Apple emoji PNGs (`emoji-datasource-apple`) are in a gray licensing area
- **Webfont approach was ruled out**: COLR color fonts have poor cross-browser support. JavaScript parsing (unicode → `<img>`) is the industry standard approach
- **`@twemoji/parser`**: Use the `jdecked/twemoji-parser` fork (v17+, MIT, actively maintained, supports Unicode 17) for parsing emoji in messages and reactions. Note: jdecked/twemoji filenames use a different naming convention than `emoji-datasource-twitter` (omits `fe0f` for simple emojis, includes it for some ZWJ sequences). The custom remark plugin must map `@twemoji/parser` output to `emoji-datasource-twitter` filenames

## Critical Design Decisions (from agent reviews)

### 1. Self-hosting is mandatory, not optional

**Quorum is a privacy-focused decentralized messaging app.** Loading emoji from a CDN (jsdelivr) would leak user IP, read timing, and activity metadata to a third party. Every time a user views a message containing emojis, their browser would make outbound requests to a CDN, enabling:
- Traffic analysis and communication pattern inference
- Passive read receipts (CDN logs show when specific messages were viewed)
- Tor/VPN bypass (CDN requests may not route through the user's proxy)
- Offline breakage (Electron desktop app has no internet guarantee)

**Solution**: Bundle `emoji-datasource-twitter` locally via `viteStaticCopy` (same pattern as current Apple setup). Use `getEmojiUrl` pointing to `/twitter/64/{unified}.png`. Do NOT use `EmojiStyle.TWITTER` which hardcodes CDN URLs.

### 2. `remark-twemoji` is dead — write a custom remark plugin

`remark-twemoji` was last published in 2018, targets remark v6, and is incompatible with our react-markdown v10 / remark v14 ecosystem. Its dependency on the deprecated `twemoji` npm package is a supply chain risk.

**Solution**: Write a thin custom remark plugin (~30 lines) using `@twemoji/parser` to transform text nodes containing emoji into image nodes pointing to locally-hosted assets.

### 3. The `img` handler in MessageMarkdownRenderer.tsx returns `null`

The markdown renderer's `img` component handler (line ~830) returns `null` for all images except YouTube embeds and invite cards. Twemoji `<img>` nodes generated by the remark plugin would be silently swallowed.

**Solution**: Add an explicit case in the `img` handler for Twemoji images (identified by a specific `alt` prefix like `twemoji-{codepoint}`). Construct `src` from the local asset path + codepoint, never from the raw markdown AST `src` attribute.

### 4. Keep `lazyLoadEmojis={true}` — it helps with self-hosted images too

The original task said to remove it. Self-hosted images still benefit from lazy loading since the picker creates ~3,785 `<img>` elements. `lazyLoadEmojis` defers network requests until scroll.

### 5. Use a single consistent image source

`emoji-datasource-twitter` (the self-hosted PNGs) must be the single source for all three surfaces: picker, messages, and reactions. Using `@twemoji/parser` CDN URLs for reactions while the picker uses local paths would create visual inconsistency and privacy leakage.

## Prerequisites

- [ ] Install `emoji-datasource-twitter` and verify Twemoji PNG assets are available at `node_modules/emoji-datasource-twitter/img/twitter/64/`
- [ ] Verify `@twemoji/parser` is available and actively maintained (jdecked/twemoji-parser fork, v17+)
- [ ] Branch created from `develop`

## Implementation

### Phase 0: Self-host Twemoji assets (BLOCKING — do this first)

- [ ] **Install `emoji-datasource-twitter`**
  - Run: `yarn add emoji-datasource-twitter`

- [ ] **Update viteStaticCopy** (`web/vite.config.ts:134-139`)
  - Replace Apple emoji source with Twitter emoji source:
  - Change: `src: 'node_modules/emoji-datasource-apple/img/apple/*'` → `src: 'node_modules/emoji-datasource-twitter/img/twitter/*'`
  - Change: `dest: 'apple'` → `dest: 'twitter'`
  - Verify: Build produces `/twitter/64/{unified}.png` files

  Done when: Twemoji PNGs are served from the app's own origin at `/twitter/64/`
  Verify: `yarn build` → check `dist/web/twitter/64/` directory exists with PNG files

### Phase 1: Emoji Picker — switch to self-hosted Twemoji

Replace `getEmojiUrl` Apple path with Twemoji path in all 6 EmojiPicker instances. Keep `lazyLoadEmojis={true}`.

- [ ] **Channel.tsx** (`src/components/space/Channel.tsx:1214-1224`)
  - Change: `getEmojiUrl={(unified) => '/apple/64/' + unified + '.png'}` → `getEmojiUrl={(unified) => '/twitter/64/' + unified + '.png'}`
  - Keep: `lazyLoadEmojis={true}`

- [ ] **DirectMessage.tsx** (`src/components/direct/DirectMessage.tsx:899-909`)
  - Same change as Channel.tsx

- [ ] **EmojiPickerDrawer.tsx** (`src/components/message/EmojiPickerDrawer.tsx:84-94`)
  - Same change as Channel.tsx

- [ ] **Message.tsx** — 3 instances (`src/components/message/Message.tsx:642-708`)
  - Same change for all three reaction pickers

  Done when: Emoji picker renders Twemoji-style images from local `/twitter/64/` path
  Verify: Open emoji picker → emojis are Twemoji style, network tab shows requests to `/twitter/64/` not CDN

### Phase 2: Messages — Twemoji in message body (requires Phase 0)

- [ ] **Install `@twemoji/parser`**
  - Run: `yarn add @twemoji/parser`

- [ ] **Write custom remark plugin** (new file, e.g. `src/utils/remarkTwemoji.ts`)
  - Walk the MDAST, find text nodes
  - Use `@twemoji/parser` to detect emoji codepoints in text
  - Replace emoji with image nodes: `src="/twitter/64/{unified}.png"`, `alt="twemoji-{unified}"`
  - ~30 lines of code, no external plugin dependency
  - Reference: Follow existing remark plugin patterns in the project

- [ ] **Add plugin to MessageMarkdownRenderer.tsx**
  - Add custom plugin to the remark plugins array alongside `remark-gfm` and `remark-breaks`

- [ ] **Update `img` handler in MessageMarkdownRenderer.tsx** (line ~830)
  - Add explicit case for Twemoji images: check `alt` starts with `twemoji-`
  - Render `<img>` with local `src` constructed from the alt codepoint, NOT from the AST `src`
  - Apply inline sizing: `height: 1.2em; width: auto; vertical-align: middle;`
  - Keep existing `return null` for all other images

- [ ] **Add emoji sizing CSS**
  - Style for emoji `<img>` in different contexts: paragraphs, headings, blockquotes, list items
  - Emoji-only messages (no text) should render emojis larger

- [ ] **Verify edge cases**
  - Multi-codepoint ZWJ sequences (family emojis, professions)
  - Skin tone modifier sequences
  - Flag emojis (regional indicator pairs)
  - Historical messages render correctly with Twemoji

  Done when: Emoji characters in messages render as Twemoji `<img>` tags from local assets
  Verify: Send a message with emojis → rendered as Twemoji images, not native OS emojis

### Phase 3: Reactions — Twemoji in reaction badges (requires Phase 0)

- [ ] **Update ReactionsList.tsx** (`src/components/message/ReactionsList.tsx:84-89`)
  - Current: `<span className="text-3xl">{r.emojiName}</span>` for standard emojis
  - New: Convert `r.emojiName` unicode to unified code → render `<img src="/twitter/64/{unified}.png">`
  - Use `@twemoji/parser` to validate `r.emojiName` is a real emoji before constructing URL
  - If parser returns empty (invalid emoji), fall back to rendering raw text
  - Keep existing custom emoji path unchanged (already renders `<img>` from `imgUrl`)

- [ ] **Validate `r.emojiName` input**
  - `r.emojiName` comes from the network (remote peer reactions)
  - Always validate with `@twemoji/parser` before using to construct image paths
  - Never construct URL directly from `r.emojiName` — use only the parsed codepoint

- [ ] **Fix double `customEmojis.find()` anti-pattern**
  - Pre-existing issue: `customEmojis.find()` is called twice per reaction (badge + tooltip)
  - Move lookup to a `const customEmoji = customEmojis.find(...)` at top of `.map()` and reuse

  Done when: Reaction badges show Twemoji images from local assets
  Verify: Add a reaction → badge shows Twemoji, network tab shows `/twitter/64/` not CDN

### Phase 4: Cleanup — swap Apple for Twitter assets

- [ ] **Remove `emoji-datasource-apple` dependency**
  - Run: `yarn remove emoji-datasource-apple`

- [ ] **Add Twemoji attribution**
  - Twemoji CC-BY 4.0 requires attribution
  - Add to the About modal/screen where the app version is shown (we dont' have an about modal screen for now)
  - Also add to a bundled `THIRD_PARTY_LICENSES` file

- [ ] **Tighten CSP `img-src`** (security improvement)
  - Currently `img-src *` in `index.html` and `web/index.html`
  - With self-hosted emojis, can tighten to `img-src 'self' data: blob:` to prevent image-based exfiltration
  - Also add CSP header via `session.defaultSession.webRequest.onHeadersReceived` in Electron main process

  Done when: No Apple emoji PNGs bundled, Twemoji attribution added, CSP tightened
  Verify: Build completes, no `/apple/` directory in output, CSP blocks external image loads

## Surfaces affected

| Surface | Current | After migration |
|---------|---------|----------------|
| Emoji picker | Apple PNGs from `/apple/64/` | Twemoji PNGs from `/twitter/64/` (self-hosted) |
| Message body | Native OS emojis | Twemoji `<img>` via custom remark plugin (self-hosted) |
| Reactions | Native OS emojis | Twemoji `<img>` via `@twemoji/parser` (self-hosted) |
| Composer | Native OS emojis | Native OS emojis (unchanged — same as Discord) |

## Risks

- **Custom remark plugin**: ~30 lines of code, but must handle edge cases (ZWJ, skin tones, flags). `@twemoji/parser` does the heavy lifting
- **Emoji sizing CSS**: Inline `<img>` tags in message text need careful sizing across contexts (paragraphs, headings, blockquotes, code blocks). May need iteration
- **Composer mismatch**: The composer will still show native OS emojis since it's a textarea. This is the same trade-off Discord makes and is acceptable
- **Historical messages**: All existing messages will render with Twemoji after migration (this is desired, but edge cases in old messages could surface)
- **Bundle size**: `emoji-datasource-twitter` PNGs are ~7-10MB (vs ~28MB for Apple) — net reduction

## Dependencies

### Add:
- `emoji-datasource-twitter` — Twemoji PNG assets for self-hosting
- `@twemoji/parser` — Parse emoji codepoints from unicode text (MIT, actively maintained, jdecked fork v17+)

### Remove:
- `emoji-datasource-apple` — No longer needed

### NOT adding:
- ~~`remark-twemoji`~~ — Dead package (2018), incompatible with remark v14, supply chain risk
- ~~`EmojiStyle.TWITTER`~~ — Hardcodes CDN URLs, privacy leakage

## Verification

✅ **Zero external CDN requests for emoji**
   - Network tab shows no requests to jsdelivr, maxcdn, or any external domain for emoji images
   - All emoji loaded from `/twitter/64/` (same origin)

✅ **Emoji picker renders Twemoji**
   - Open picker → emojis are Twemoji style from self-hosted assets

✅ **Messages show Twemoji**
   - Send message with emojis → rendered as Twemoji `<img>` tags
   - Edge cases: ZWJ sequences, skin tones, flags all render correctly

✅ **Reactions show Twemoji**
   - Add reaction → badge shows Twemoji image, not native emoji

✅ **Custom space emojis still work**
   - Custom emojis (image-based) still load via their `imgUrl`

✅ **Emoji picker is fast**
   - `lazyLoadEmojis={true}` defers image loads until scroll

✅ **Apple assets removed**
   - Build output does not contain `/apple/` directory
   - `emoji-datasource-apple` not in dependencies

✅ **CSP tightened**
   - `img-src 'self' data: blob:` blocks external image loads

✅ **Malformed reaction emojis handled**
   - Invalid `emojiName` from network does not produce broken images or unexpected URL requests

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **Mobile drawer still works**
   - On small viewports, emoji drawer opens with Twemoji emojis

## Definition of Done

- [ ] Twemoji assets self-hosted via viteStaticCopy at `/twitter/64/`
- [ ] All 6 EmojiPicker instances use `getEmojiUrl` pointing to `/twitter/64/`
- [ ] Custom remark plugin renders emoji as Twemoji `<img>` in messages
- [ ] `img` handler in MessageMarkdownRenderer.tsx updated for Twemoji images
- [ ] Reactions render emoji as Twemoji `<img>` with input validation
- [ ] `emoji-datasource-apple` removed, `emoji-datasource-twitter` + `@twemoji/parser` added
- [ ] Twemoji CC-BY 4.0 attribution in About modal
- [ ] CSP `img-src` tightened to `'self' data: blob:`
- [ ] Zero external CDN requests for emoji assets
- [ ] TypeScript passes
- [ ] Edge cases tested (ZWJ, skin tones, flags, historical messages)
- [ ] No console errors

---

_Created: 2026-02-24_
_Updated: 2026-02-24 — Revised after feature-analyzer and security-analyst reviews: self-hosting mandatory (privacy), remark-twemoji replaced with custom plugin, img handler collision addressed, lazyLoadEmojis kept, CDN URLs eliminated, reaction input validation added, CSP tightening added. Updated asset source: emoji-datasource-twitter v16.0.0 (Sep 2025, Emoji v16.0) — drop-in replacement for emoji-datasource-apple. jdecked/twemoji parser for messages/reactions._
