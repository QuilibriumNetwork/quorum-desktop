---
type: task
title: "Migrate moment-timezone to Day.js for i18n date translation"
status: completed
complexity: medium
ai_generated: true
reviewed_by: null
created: 2025-01-14T00:00:00.000Z
updated: '2026-02-10'
related_bugs:
  - "vite-moment-timezone-dual-instance-locale-bug.md"
---

# Migrate moment-timezone to Day.js for i18n date translation

> **AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/utils/dateFormatting.ts` (rewrite)
- `src/utils/messageGrouping.ts` (rewrite moment calls)
- `src/i18n/i18n.ts` (add Day.js locale sync)
- `src/dev/tests/utils/messageGrouping.unit.test.ts` (update test imports)
- `src/components/message/DateSeparator.tsx` (no changes — already imports from messageGrouping)
- `package.json` (add dayjs, remove moment-timezone)

## What & Why

Dates in the app are partially translated. Lingui handles UI strings ("Today", "Yesterday"), but moment.js-generated strings (month names, day names, relative times like "3 days ago") remain in English for all 31 non-English locales. This affects 10 components.

The straightforward fix (import `moment/locale/*` + call `moment.locale()`) **cannot work** because Vite pre-bundles `moment` and `moment-timezone` as separate ESM instances. Locale side-effect imports register on the wrong instance. See bug report: `.agents/bugs/vite-moment-timezone-dual-instance-locale-bug.md`.

**Solution**: Replace `moment-timezone` with Day.js + plugins. Day.js is ESM-native (no dual-instance issue), 2KB core (vs ~970KB for moment+moment-timezone), and has a near-identical API. The migration surface is small — only 2 utility files + 1 test file.

## Context

- **Existing pattern**: All date formatting is centralized in `dateFormatting.ts` and `messageGrouping.ts`
- **Constraints**: Day.js is immutable (returns new instances) unlike moment which mutates. The current code uses `.clone()` which is already immutable-safe
- **Day.js calendar plugin limitation**: Does not support callback functions for format values (only strings). Our code uses callbacks for `sameDay` and `sameElse` — these must be refactored to compute the value before calling `.calendar()`

## Implementation

### Phase 1: Install Day.js and Configure

- [ ] **Install packages**
  ```bash
  yarn add dayjs
  yarn remove moment-timezone
  ```

- [ ] **Create Day.js setup file** (`src/utils/dayjs.ts`)
  ```typescript
  import dayjs from 'dayjs';
  import utc from 'dayjs/plugin/utc';
  import timezone from 'dayjs/plugin/timezone';
  import relativeTime from 'dayjs/plugin/relativeTime';
  import calendar from 'dayjs/plugin/calendar';

  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(relativeTime);
  dayjs.extend(calendar);

  export default dayjs;
  ```

### Phase 2: Add Locale Sync to i18n (requires Phase 1)

- [ ] **Update `src/i18n/i18n.ts`** — add Day.js locale loading to `dynamicActivate()`
  ```typescript
  import dayjs from '../utils/dayjs';

  // Locale loaders — dynamic import loads only the locale needed
  const dayjsLocaleLoaders: Record<string, () => Promise<unknown>> = {
    ar: () => import('dayjs/locale/ar'),
    cs: () => import('dayjs/locale/cs'),
    da: () => import('dayjs/locale/da'),
    de: () => import('dayjs/locale/de'),
    el: () => import('dayjs/locale/el'),
    es: () => import('dayjs/locale/es'),
    fi: () => import('dayjs/locale/fi'),
    fr: () => import('dayjs/locale/fr'),
    he: () => import('dayjs/locale/he'),
    id: () => import('dayjs/locale/id'),
    it: () => import('dayjs/locale/it'),
    ja: () => import('dayjs/locale/ja'),
    ko: () => import('dayjs/locale/ko'),
    nb: () => import('dayjs/locale/nb'),
    nl: () => import('dayjs/locale/nl'),
    pl: () => import('dayjs/locale/pl'),
    pt: () => import('dayjs/locale/pt'),
    ro: () => import('dayjs/locale/ro'),
    ru: () => import('dayjs/locale/ru'),
    sk: () => import('dayjs/locale/sk'),
    sl: () => import('dayjs/locale/sl'),
    sr: () => import('dayjs/locale/sr'),
    sv: () => import('dayjs/locale/sv'),
    th: () => import('dayjs/locale/th'),
    tr: () => import('dayjs/locale/tr'),
    uk: () => import('dayjs/locale/uk'),
    vi: () => import('dayjs/locale/vi'),
    'zh-cn': () => import('dayjs/locale/zh-cn'),
    'zh-tw': () => import('dayjs/locale/zh-tw'),
  };

  export async function dynamicActivate(locale: string) {
    if (!locales[locale]) locale = defaultLocale;

    const { messages } = await import(`./${locale}/messages.ts`);
    i18n.load(locale, messages);
    i18n.activate(locale);

    // Sync Day.js locale
    const dayjsLocale = mapToDayjsLocale(locale);
    const loader = dayjsLocaleLoaders[dayjsLocale];
    if (loader) await loader();
    dayjs.locale(dayjsLocale);
  }

  function mapToDayjsLocale(linguiLocale: string): string {
    const map: Record<string, string> = {
      'en-PI': 'en',
      'no': 'nb',
      'zh-CN': 'zh-cn',
      'zh-TW': 'zh-tw',
    };
    return map[linguiLocale] || linguiLocale.toLowerCase();
  }
  ```

### Phase 3: Migrate dateFormatting.ts (requires Phase 1)

- [ ] **Rewrite `src/utils/dateFormatting.ts`** — replace moment with dayjs

  **API mapping** (line-by-line):
  | Current (moment) | New (dayjs) | Notes |
  |---|---|---|
  | `moment.tz(ts, tz)` | `dayjs.tz(ts, tz)` | Identical API |
  | `time.fromNow()` | `time.fromNow()` | Identical (relativeTime plugin) |
  | `time.format('HH:mm')` | `time.format('HH:mm')` | Identical |
  | `time.format('MMM D')` | `time.format('MMM D')` | Identical |
  | `time.format('MMM D, YYYY')` | `time.format('MMM D, YYYY')` | Identical |
  | `moment()` | `dayjs()` | Current time |
  | `now.startOf('day')` | `now.startOf('day')` | Day.js is immutable — returns new instance (no `.clone()` needed) |
  | `now.startOf('day').diff(time.clone().startOf('day'), 'days')` | `now.startOf('day').diff(time.startOf('day'), 'day')` | Note: `'day'` not `'days'` in dayjs |
  | `time.year()` | `time.year()` | Identical |
  | `time.calendar(null, {...})` with callbacks | Pre-compute values, then pass format strings | See below |

  **Calendar callback workaround** — Day.js calendar plugin doesn't support callbacks. Refactor to:
  ```typescript
  // BEFORE (moment — uses callbacks):
  time.calendar(null, {
    sameDay: function () { return `[${timeFormatted}]`; },
    lastDay: `[${t`Yesterday at ${timeFormatted}`}]`,
    lastWeek: 'dddd',
    sameElse: function () { return `[${fromNow}]`; },
  });

  // AFTER (dayjs — format strings only, pre-computed):
  time.calendar(null, {
    sameDay: `[${timeFormatted}]`,
    lastDay: `[${t`Yesterday at ${timeFormatted}`}]`,
    lastWeek: 'dddd',
    sameElse: `[${fromNow}]`,
  });
  ```
  This is safe because `timeFormatted` and `fromNow` are already computed before the `.calendar()` call — the callbacks were unnecessary closures.

### Phase 4: Migrate messageGrouping.ts (requires Phase 1)

- [ ] **Update `src/utils/messageGrouping.ts`** — replace moment with dayjs

  Changes needed:
  - `import * as moment from 'moment-timezone'` → `import dayjs from './dayjs'`
  - `moment.tz(ts, tz).startOf('day').valueOf()` → `dayjs.tz(ts, tz).startOf('day').valueOf()`
  - `moment.tz(ts, tz).format('MMMM D, YYYY')` → `dayjs.tz(ts, tz).format('MMMM D, YYYY')`

### Phase 5: Update Tests (requires Phase 4)

- [ ] **Update `src/dev/tests/utils/messageGrouping.unit.test.ts`**

  Changes needed:
  - `import * as moment from 'moment-timezone'` → `import dayjs from '../../../utils/dayjs'`
  - `moment.tz(dateStr, format, tz)` → `dayjs.tz(dateStr, tz)` — Day.js timezone plugin parses ISO-like strings without a format param; verify test dates work
  - `.clone().subtract(1, 'day').valueOf()` → `.subtract(1, 'day').valueOf()` (no `.clone()` needed, dayjs is immutable)
  - `.clone().subtract(2, 'days').valueOf()` → `.subtract(2, 'day').valueOf()` (singular `'day'`)
  - May need `customParseFormat` plugin added to `src/utils/dayjs.ts` if `dayjs.tz('2024-11-10 15:30:00', tz)` doesn't parse the space-separated format

### Phase 6: Cleanup (requires all above)

- [ ] **Remove moment-timezone** — run `yarn remove moment-timezone` and `yarn remove moment` (if a standalone dep)
- [ ] **Check for any remaining `moment` imports** — `grep -r "from 'moment" src/` should return zero results
- [ ] **Verify no other files import moment** — the only consumers should be the files listed above

## Verification

**Date translation works**
- Test: Switch language to Spanish → month names show "enero", "febrero"; relative times show "hace 3 días"; day names show "lunes"
- Test: Switch to German → "Februar", "vor einem Monat", "Montag"
- Test: Switch back to English → all dates revert to English

**All date formats preserved**
- Test: Message timestamps show "HH:mm" for today, "Yesterday at HH:mm" for yesterday, day name for last week, relative time for older
- Test: DM contact list shows "HH:mm" for today, "1d"/"2d" for recent, "MMM D" for older, "MMM D, YYYY" for different year
- Test: Date separators show "MMMM D, YYYY" format

**TypeScript compiles**
- Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

**Tests pass**
- Run: `npx vitest run src/dev/tests/utils/messageGrouping.unit.test.ts`

**Bundle size reduced**
- Verify: moment-timezone no longer in bundle (was ~970KB); dayjs + plugins should be ~4-7KB

## Definition of Done

- [ ] All moment-timezone usage replaced with Day.js
- [ ] Locale sync works in `dynamicActivate()`
- [ ] Date formatting verified in 3+ languages (en, es, de minimum)
- [ ] TypeScript passes
- [ ] Unit tests pass
- [ ] No remaining moment imports in src/
- [ ] Bug report `.agents/bugs/vite-moment-timezone-dual-instance-locale-bug.md` updated to status: done

---

**Last updated**: 2026-02-10 by Claude Code
