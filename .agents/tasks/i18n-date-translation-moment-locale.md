---
type: task
title: Date Translation with Moment.js Locale Configuration
status: open
complexity: low
created: 2025-01-14T00:00:00.000Z
updated: '2026-01-09'
---

# Date Translation with Moment.js Locale Configuration


**Priority**: Medium


## Problem Summary

Currently, dates in the application are **partially translated**. While custom strings like "Today" and "Yesterday" are translated through Lingui, the underlying date formatting from moment.js (month names, day names, relative times) remains in English regardless of the user's selected language.

**Examples of what's NOT translated:**
- Month names: "October 15, 2025" → Should be "Octubre 15, 2025" in Spanish
- Day names: "Monday" → Should be "Lunes" in Spanish
- Relative times: "3 days ago" → Should be "hace 3 días" in Spanish
- Month abbreviations: "11 Nov" → Should be "11 Nov" in Spanish

## Current Implementation Analysis

### What IS Currently Translated ✅

Located in `src/utils/dateFormatting.ts`:

```typescript
// These strings are translated via Lingui's t macro:
- "Today at {time}"        // Line 27
- "Yesterday at {time}"    // Line 30
- "Yesterday" (compact)    // Line 55
```

### What is NOT Translated ❌

All moment.js-generated strings:
- **Month names**: From `moment.format('MMMM')` → "October", "November", etc.
- **Day names**: From `moment.calendar()` → "Monday", "Tuesday", etc.
- **Relative times**: From `moment.fromNow()` → "3 days ago", "2 months ago", etc.
- **Date formats**: Time formats like "3:45 PM" (12h vs 24h varies by locale)

### Where Dates Are Displayed

1. **Message.tsx:254** - Message timestamps
2. **MessageList.tsx** - Date separators between messages
3. **DateSeparator.tsx:70** - Full date format (`MMMM D, YYYY`)
4. **DirectMessageContact.tsx:65** - DM list timestamps
5. **PinnedMessagesPanel.tsx** - Pinned message dates
6. **MessagePreview.tsx:46** - Message preview dates
7. **NotificationItem.tsx** - Notification dates
8. **SearchResultItem.tsx** - Search result dates

## Understanding Moment.js Locales

### How Moment.js Localization Works

Moment.js comes with built-in locale support that controls:

1. **Month and day names** - Full and abbreviated forms
2. **Relative time strings** - "a few seconds ago", "3 days ago", etc.
3. **Date format conventions** - Order of day/month/year, separators
4. **Time format conventions** - 12h vs 24h, AM/PM labels
5. **Week start day** - Sunday vs Monday (varies by culture)

**Key concept**: When you call `moment.locale('es')`, it switches ALL moment formatting to use Spanish conventions.

### Example of Locale Impact

```javascript
moment.locale('en'); // English
moment().format('MMMM D, YYYY');  // "January 14, 2025"
moment().fromNow();                // "3 days ago"
moment().calendar();               // "Last Monday"

moment.locale('es'); // Spanish
moment().format('MMMM D, YYYY');  // "enero 14, 2025"
moment().fromNow();                // "hace 3 días"
moment().calendar();               // "el lunes pasado"

moment.locale('ja'); // Japanese
moment().format('MMMM D, YYYY');  // "1月 14, 2025"
moment().fromNow();                // "3日前"
moment().calendar();               // "先週の月曜日"
```

### Locale Files and Bundle Size

**Important consideration**: Each moment locale adds to your bundle size.

- **English (default)**: ~0 KB (built-in)
- **Each additional locale**: ~2-4 KB gzipped per language
- **All locales**: ~200 KB gzipped (if you import everything)

**Best practice**: Only import the locales you support to minimize bundle size.

## Proposed Solution

### Implementation Steps

#### 1. Import Required Locale Files

In `src/i18n/i18n.ts`, import only the moment locales that match your supported languages:

```typescript
// Import moment locales (only for languages you support)
import 'moment/locale/es';  // Spanish
import 'moment/locale/fr';  // French
import 'moment/locale/de';  // German
import 'moment/locale/it';  // Italian
import 'moment/locale/ja';  // Japanese
import 'moment/locale/pt';  // Portuguese
import 'moment/locale/ru';  // Russian
import 'moment/locale/zh-cn';  // Chinese Simplified
// ... add more as needed
```

#### 2. Synchronize Moment Locale with Lingui

Modify the `dynamicActivate()` function in `src/i18n/i18n.ts`:

```typescript
import moment from 'moment-timezone';

export async function dynamicActivate(locale: string) {
  // if the locale is not supported, use the default locale
  if (!locales[locale]) {
    locale = defaultLocale;
  }

  // dynamically compile the messages file
  const { messages } = await import(`./${locale}/messages.ts`);
  i18n.load(locale, messages);
  i18n.activate(locale);

  // NEW: Synchronize moment.js locale with Lingui locale
  // Map Lingui locales to moment locales (they usually match, but handle special cases)
  const momentLocale = mapLinguiToMomentLocale(locale);
  moment.locale(momentLocale);
}

// Helper function to map Lingui locale codes to moment locale codes
function mapLinguiToMomentLocale(linguiLocale: string): string {
  const localeMap: Record<string, string> = {
    'en': 'en',
    'zh-CN': 'zh-cn',
    'zh-TW': 'zh-tw',
    'pt': 'pt',
    'pt-BR': 'pt-br',
    // Add other mappings as needed (most match 1:1)
  };

  return localeMap[linguiLocale] || linguiLocale.toLowerCase();
}
```

#### 3. Verify Locale Loading

Add a console log or check to verify the locale is loaded:

```typescript
console.log('Moment locale activated:', moment.locale()); // Should return the locale code
```

### Potential Drawbacks and Considerations

#### Bundle Size Impact ⚠️

**Trade-off**: Each locale adds 2-4 KB to your bundle.

**Mitigation strategies**:
1. ✅ **Recommended**: Only import locales you actively support (you have ~30+ languages, so ~60-120 KB total)
2. ⚠️ **Not recommended**: Import all moment locales indiscriminately
3. 💡 **Advanced**: Dynamic import moment locales on-demand (adds complexity)

#### Locale Code Mismatches ⚠️

Some Lingui locale codes may not match moment locale codes exactly:
- Lingui: `zh-CN` vs Moment: `zh-cn` (case sensitivity)
- Lingui: `pt` (generic) vs Moment: `pt-br` vs `pt` (Brazilian vs European Portuguese)

**Solution**: Use a mapping function (shown above) to handle these cases.

#### Format Differences Across Cultures ℹ️

Different locales have different conventions:
- **12h vs 24h time**: English uses "3:45 PM", many European languages use "15:45"
- **Date order**: US uses "MM/DD/YYYY", Europe uses "DD/MM/YYYY"
- **Week start**: Sunday in US, Monday in Europe

**Impact**: Your date displays will automatically adapt to cultural norms, which is usually desirable but might surprise users expecting consistency.

#### Testing Requirements 🧪

You'll need to test date formatting across all supported locales to ensure:
1. Locale files are correctly imported
2. Dates display correctly in each language
3. No unexpected format changes break your UI (e.g., very long month names)

## Implementation Checklist

- [ ] Review your supported languages in `src/i18n/locales.ts`
- [ ] Import corresponding moment locale files in `src/i18n/i18n.ts`
- [ ] Create locale mapping function for any mismatched codes
- [ ] Modify `dynamicActivate()` to call `moment.locale()`
- [ ] Test date formatting in at least 3-5 different languages
- [ ] Verify bundle size impact (should be < 150 KB for all locales)
- [ ] Check for UI layout issues with long month/day names
- [ ] Update documentation with locale configuration

## Alternative: Replace Moment.js with date-fns

**Optional consideration**: If bundle size becomes a concern, consider migrating from moment.js to date-fns.

**Pros of date-fns**:
- Tree-shakeable (only import functions you use)
- More modern API
- Better performance
- Smaller bundle size overall

**Cons**:
- Requires refactoring all date formatting code
- More work upfront
- Moment.js works fine for most use cases

**Recommendation**: Stick with moment.js for now, since it's already integrated and the bundle size impact is manageable.

## Success Criteria

After implementation, verify:

1. ✅ Month names appear in the user's selected language
2. ✅ Day names appear in the user's selected language
3. ✅ Relative time strings ("3 days ago") appear in the user's selected language
4. ✅ Date format follows cultural conventions (DD/MM vs MM/DD, 12h vs 24h)
5. ✅ Changing language in settings immediately updates all displayed dates
6. ✅ Bundle size increase is acceptable (< 150 KB for all locales)
7. ✅ No layout/UI breaks from longer translated strings

## References

- [Moment.js i18n documentation](https://momentjs.com/docs/#/i18n/)
- [Moment.js locale files](https://github.com/moment/moment/tree/develop/locale)
- [Lingui documentation](https://lingui.dev/ref/core)
- Current implementation: `src/utils/dateFormatting.ts`
- i18n setup: `src/i18n/i18n.ts`

---

**Last updated**: 2025-01-14 by Claude Code
