---
type: report
title: "Emoji Picker Library Comparison: emoji-picker-react vs emoji-mart"
ai_generated: true
reviewed_by: null
created: 2026-02-24
updated: 2026-02-24
related_tasks:
  - "tasks/emoji-picker-performance-fix.md"
  - "tasks/emoji-picker-in-message-composer.md"
related_docs:
  - "docs/features/messages/emoji-picker-react-customization.md"
---

# Emoji Picker Library Comparison: emoji-picker-react vs emoji-mart

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary

Evaluated migrating from `emoji-picker-react` (current) to `emoji-mart` to solve slow emoji loading (3,785 individual HTTP requests for Apple PNGs). **Recommendation: stay with emoji-picker-react** and optimize via upgrade (virtualization) + caching. emoji-mart's sprite sheet architecture is superior for image loading but introduces significant risks: Shadow DOM breaks all our CSS customizations, it's not a true React component, TypeScript support is weak, and it hasn't had a release in ~22 months.

## Industry Context

Major messaging apps all use **image-based emojis** (not native OS emojis) for cross-platform consistency:

| App | Emoji Set | Loading Strategy |
|-----|-----------|-----------------|
| **Discord** | Twemoji (own fork) | Individual PNGs from CDN + aggressive caching + virtualized picker |
| **Telegram** | Apple emojis | WebP sprite sheets bundled in app binary (zero network requests) |
| **Slack** | Multiple sets | CSS sprite sheets + react-virtualized picker |
| **WhatsApp Web** | Custom set | CSS sprite sheets + browser caching |

None use native OS emojis. The performance problem is solved through sprite sheets (1 request) or CDN caching (images download once).

## Comparison

| | **emoji-picker-react** (v4.18.0) | **emoji-mart** (v5.6.0) |
|---|---|---|
| **Emoji rendering** | Individual `<img>` tags (1 request/emoji) | CSS sprite sheets (1 request for entire set) |
| **Bundle size** | ~2.59 MB (data bundled) | ~95 kB total (data decoupled into `@emoji-mart/data`) |
| **Virtualization** | Yes (since v4.18.0, ~30-50 DOM nodes) | Category-level lazy rendering via IntersectionObserver |
| **React integration** | True React component, proper re-rendering | Web component with React wrapper — props can be ignored after mount, duplicate instances possible |
| **Shadow DOM** | No (regular DOM, full CSS access) | Yes — CSS customization limited to exposed CSS variables only |
| **TypeScript** | Full, well-typed, exports like `CustomEmoji` | Weak/incomplete types, `@emoji-mart/data` has type issues |
| **Custom emojis** | `{id, names[], imgUrl}` — simple flat array | `{id, name, keywords[], skins[{src}]}` — richer format with multi-skin support |
| **Sprite sheet support** | No | Yes (Apple, Google, Twitter, Facebook) |
| **i18n** | 25+ built-in locales, UI strings configurable via props | 20+ locales via CLDR data, `i18n` prop object |
| **Reactions mode** | Built-in `reactionsDefaultOpen` prop | No built-in support |
| **Maintenance** | Active, v4.18.0 released recently | Last release April 2024 (~22 months ago), 160 open issues |
| **npm downloads** | ~450K/week | ~900K/week |
| **GitHub stars** | ~1,400 | ~9,300 |
| **License** | MIT | MIT |

## Migration Risk Assessment

### Why emoji-mart is risky for this project

1. **Shadow DOM breaks CSS customizations.** We have 118 lines of SCSS overrides in `_emoji-picker.scss` targeting `.EmojiPickerReact` internals. Shadow DOM prevents all external CSS from reaching internal elements — we'd lose all custom theming and need to rebuild using only emoji-mart's exposed CSS variables (fewer options).

2. **Not a true React component.** `@emoji-mart/react` creates a `<div ref>` and mounts a web component inside. Props are converted to attributes. This means props can be static after mount, re-rendering doesn't work as expected, and duplicate picker instances can appear in the DOM.

3. **TypeScript is incomplete.** We import `CustomEmoji` from `emoji-picker-react/dist/config/customEmojiConfig`. emoji-mart's `@types` are stubs for v5, and `@emoji-mart/data` has had type declaration issues (GitHub Issues #576, #733).

4. **Stale maintenance.** No release in 22 months. 160 open issues. The "Fix or Fork?" issue (#644) documented significant developer frustration with v5's web component approach.

5. **~14 files** would need changes plus a complete rewrite of emoji styling.

### Migration effort estimate

| Area | Effort |
|------|--------|
| Swap component + props in 6 picker instances | Low |
| Transform custom emoji data format | Low |
| Rewrite `_emoji-picker.scss` for Shadow DOM | **High** |
| Fix TypeScript types / add declarations | Medium |
| Test React integration quirks | Medium |
| Update `useEmojiPicker` hook | Low |

## Other Alternatives Evaluated

| Library | Verdict |
|---------|---------|
| **Frimousse** (by Liveblocks) | 12 kB, headless, virtualized — but native emoji only, **no custom emoji support** (deal-breaker) |
| **emoji-picker-element** (by Nolan Lawson) | 12.5 kB, IndexedDB-backed — but native emoji only, web component (Shadow DOM issues) |

## Recommendation

**Stay with emoji-picker-react.** Optimize via:
1. Upgrade to v4.18.0+ (virtualization — ~30-50 DOM nodes instead of 3,785)
2. Add `lazyLoadEmojis={true}` (only visible emojis trigger HTTP requests)
3. Service worker caching for `/apple/64/*.png` (images download once, then instant)

This addresses the performance problem without migration risk. See task: `tasks/emoji-picker-performance-fix.md`.

**Revisit emoji-mart only if**: after optimization, individual-image loading is still unacceptable AND emoji-mart gets active maintenance again AND we're willing to give up CSS customization control.

---

_Created: 2026-02-24_
