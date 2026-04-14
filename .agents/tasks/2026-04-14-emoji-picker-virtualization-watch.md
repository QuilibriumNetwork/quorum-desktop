---
type: task
title: "Watch: emoji-picker-react virtualization PR"
status: pending
complexity: low
created: 2026-04-14
related_docs:
  - "tasks/.done/emoji-picker-performance-fix.md"
  - "reports/emoji-picker-library-comparison_2026-02-24.md"
---

# Watch: emoji-picker-react virtualization PR

## Context

The emoji picker currently renders ~3,785 individual `<img>` DOM nodes (one per emoji), firing ~3,785 HTTP requests on open. This is the core performance problem — `lazyLoadEmojis={true}` was added and the package was upgraded to 4.18.0, but neither fixed it meaningfully.

The real fix is **DOM virtualization**: only render the ~30-50 emojis visible in the viewport at a time.

## Action required

**Periodically check**: https://github.com/ealush/emoji-picker-react/pull/439

PR #439 (`feat: added virtualization and added headless search hook`) is the pending fix. When it merges into a release:

1. Run `yarn upgrade emoji-picker-react --latest`
2. Verify the `CustomEmoji` deep import still resolves: `emoji-picker-react/dist/config/customEmojiConfig` (used in `src/components/message/EmojiPickerDrawer.tsx`)
3. Inspect DOM after opening the picker — should see ~30-50 `<img>` elements, not ~3,785
4. Run `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Fallback (only if PR stalls 6+ months)

Switch emoji picker library — see the [library comparison report](../reports/emoji-picker-library-comparison_2026-02-24.md). High effort due to 118 lines of SCSS overrides and 8 files importing `CustomEmoji`. Don't do this until virtualization is confirmed stuck.

---

_Created: 2026-04-14_
