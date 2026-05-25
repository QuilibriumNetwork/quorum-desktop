---
type: bug
title: "Vite + moment-timezone dual-instance prevents locale loading"
status: solved
priority: high
ai_generated: true
reviewed_by: null
created: 2026-02-10
updated: 2026-02-10
related_tasks:
  - "i18n-date-translation-moment-locale.md"
---

# Vite + moment-timezone dual-instance prevents locale loading

> **AI-Generated**: May contain errors. Verify before use.

## Symptoms

When switching the app language (e.g., to Spanish/Deutsch), all Lingui-translated UI strings update correctly, but **all moment.js-generated date strings remain in English**:

- "a month ago" stays English (should be "hace un mes" in Spanish)
- "February 10, 2026" stays English (should be "10. Februar 2026" in German)
- Day names like "Monday" stay English (should be "Montag" in German)
- Month abbreviations like "Jan 8" stay English

Calling `moment.locale('es')` returns `'en'` — the locale silently falls back because `'es'` was never registered on the moment-timezone instance.

## Root Cause

**Vite pre-bundles `moment` and `moment-timezone` as separate ESM module instances.**

This is a known, widely-reported issue:

- [Vite Issue #5359](https://github.com/vitejs/vite/issues/5359)
- [Vite Discussion #10879](https://github.com/vitejs/vite/discussions/10879)
- [Moment Issue #5926](https://github.com/moment/moment/issues/5926)
- [Moment-Timezone Issue #647](https://github.com/moment/moment-timezone/issues/647)

### How it happens

1. The app imports `moment-timezone` (`import moment from 'moment-timezone'`) — this is **Instance A**
2. Locale files (`moment/locale/es.js`) internally do `require('../moment')` and call `moment.defineLocale('es', ...)` — this registers on **Instance B** (bare `moment`)
3. When the app calls `moment.locale('es')` on Instance A, it has no `'es'` locale registered, so it falls back to `'en'`

In Vite's dev server, esbuild pre-bundles CJS dependencies as separate ESM wrappers. Since `moment-timezone` uses `require('moment')` internally (CJS UMD pattern), and `moment/locale/*.js` also uses `require('../moment')`, Vite creates two distinct module instances even though they resolve to the same `node_modules/moment` on disk.

### Why `resolve.dedupe` doesn't fix it

Adding `'moment'` to Vite's `resolve.dedupe` array is designed for cases where the same package appears multiple times in the dependency tree (common in monorepos). It does NOT fix this issue because `moment-timezone`'s internal moment reference goes through its own CJS `require('moment')` call, which esbuild pre-bundles independently.

## Attempted Solutions (All Failed)

### Attempt 1: Static side-effect imports

```typescript
import 'moment/locale/es';
import 'moment/locale/de';
// ... etc
```

**Result**: Locale registered on bare moment (Instance B), not on moment-timezone (Instance A). `moment.locale('es')` returned `'en'`.

### Attempt 2: Dynamic `import()` calls

```typescript
const loaders = { es: () => import('moment/locale/es'), ... };
await loaders['es']();
moment.locale('es');
```

**Result**: Same issue — dynamic imports still resolve `moment/locale/es` against bare moment. `moment.locale('es')` returned `'en'`.

### Attempt 3: `resolve.dedupe: ['moment']` in vite.config.ts

**Result**: No effect on the dual-instance problem. `moment.locale('es')` still returned `'en'`.

### Attempt 4: Raw file load with `@vite-ignore`

```typescript
await import(/* @vite-ignore */ `/node_modules/moment/locale/${code}.js`);
```

**Result**: `TypeError: Cannot read properties of undefined (reading 'moment')` — the UMD wrapper tries to access `global.moment` which doesn't exist in ESM context.

### Attempt 5: Cross-instance locale data copy

Import bare `moment`, load locale on it, read locale data back via `bareMoment.localeData('es')`, then re-register on moment-timezone via `moment.defineLocale('es', {...data})`.

**Result**: The approach is theoretically sound but the implementation produced no console output and no visible change. The `import('moment/locale/es')` step likely encountered the same instance isolation, preventing `bareMoment.localeData('es')` from returning valid data.

## Viable Solutions (From Research)

### Option A: Use `moment/dist/locale/` path (Quick Fix)

Multiple developers in [Vite Issue #5359](https://github.com/vitejs/vite/issues/5359) report that importing from `moment/dist/locale/es` instead of `moment/locale/es` works because the `dist/` files have a different module structure that Vite handles correctly.

```typescript
import 'moment/dist/locale/es';
```

**Pros**: Minimal change, keeps moment-timezone
**Cons**: Fragile — depends on moment's internal `dist/` structure; may break on version updates; moment.js is in maintenance mode (no new features/fixes)

### Option B: Migrate to Day.js (Recommended)

Day.js is a 2KB drop-in replacement for Moment.js with ESM-native architecture. No dual-instance issues. The app's moment API surface is small and contained in just 3 files:

- `src/utils/dateFormatting.ts` — `fromNow()`, `calendar()`, `format()`, `tz()`
- `src/utils/messageGrouping.ts` — `tz()`, `startOf('day')`, `format()`
- `src/components/message/DateSeparator.tsx` — imports `getDateLabel` from messageGrouping

Day.js equivalents exist for all used APIs: `dayjs.tz()`, `.fromNow()`, `.calendar()`, `.format()`, `.startOf()`, `.diff()`.

**Pros**: Eliminates root cause permanently; ~95% bundle reduction (2-7KB vs ~970KB for moment+moment-timezone); actively maintained; ESM-native; locale loading works correctly
**Cons**: Medium migration effort (3 files + test file); API is similar but not identical (Day.js is immutable); requires `dayjs/plugin/timezone`, `dayjs/plugin/relativeTime`, `dayjs/plugin/calendar`

### Option C: Migrate to Native Intl APIs (Zero Dependencies)

Use browser-native `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`. Zero bundle cost, locale data comes from the browser's ICU data (more comprehensive than any JS library).

```typescript
new Intl.DateTimeFormat('es', { month: 'long', day: 'numeric', year: 'numeric', timeZone })
  .format(new Date(timestamp)); // "10 de febrero de 2026"

new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  .format(-1, 'day'); // "ayer"
```

**Pros**: Zero bundle size; no library maintenance; locale data always up-to-date; full browser support (project targets es2022)
**Cons**: Higher implementation effort; no built-in `calendar()` or auto-unit-selection for relative time; need to build helper functions; more verbose

## Impact

- **Blocks**: Task `i18n-date-translation-moment-locale.md` — cannot translate moment.js dates regardless of approach while using moment-timezone in Vite
- **Affects**: All 10 components that display dates (Message, DateSeparator, DirectMessageContact, MessagePreview, PinnedMessagesPanel, EditHistoryModal, BookmarkItem, useSearchResultFormatting, Channel, messageGrouping)
- **Scope**: 31 supported languages, all non-English users see English dates

## Prevention

Avoid using libraries that rely on singleton module instances for configuration (like `moment.locale()`) in Vite projects. Prefer libraries with:
- ESM-native architecture (Day.js, date-fns, Luxon)
- Explicit locale passing per call (date-fns) or per instance (Day.js, Luxon)
- Or zero-dependency browser APIs (Intl)

## References

- [Vite Issue #5359: Problem with moment locales](https://github.com/vitejs/vite/issues/5359)
- [Vite Discussion #10879: How to use Moment.js with Vitejs](https://github.com/vitejs/vite/discussions/10879)
- [Moment Issue #5926: Vite.js configuration](https://github.com/moment/moment/issues/5926)
- [Moment-Timezone Issue #647: Setting locale does not work](https://github.com/moment/moment-timezone/issues/647)
- [Moment.js Project Status (maintenance mode)](https://momentjs.com/docs/#/-project-status/)
- [Day.js documentation](https://day.js.org/)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [MDN: Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)

---

_Created: 2026-02-10_
