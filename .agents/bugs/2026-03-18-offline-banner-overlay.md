---
type: bug
title: "Offline Banner Overlays Content Instead of Pushing Down"
status: open
priority: low
tags: [UX, layout, offline]
ai_generated: true
created: 2026-03-18
updated: 2026-03-18
---

# Offline Banner Overlays Content Instead of Pushing Down

> **Warning AI-Generated**: May contain errors. Verify before use.

## Symptoms

When the app goes offline, the banner at the top of the page ("You're offline") overlays/sits on top of other UI elements instead of pushing everything down. Content behind the banner is hidden and inaccessible.

## Root Cause

The offline banner uses `position: fixed` with `z-index: 1001` ([OfflineBanner.scss:7-18](src/components/ui/OfflineBanner.scss#L7-L18)), removing it from document flow. The component correctly adds a `body.offline-banner-visible` class to trigger CSS layout adjustments, but those adjustments target the wrong selector.

The CSS at [OfflineBanner.scss:48-66](src/components/ui/OfflineBanner.scss#L48-L66) adjusts:
1. `header` (NavMenu) - **correct**, shifts down by 32px
2. `.responsive-container` - **wrong selector**, this class doesn't exist in the app

The actual main content container is `.main-content` ([_base.scss:335-352](src/styles/_base.scss#L335-L352)), which uses `position: fixed` with hardcoded `top: 14px` (browser) / `top: 38px` (Electron). This container is **never adjusted** when the offline banner is visible, so the banner sits directly on top of the content area.

## Solution

Replace `.responsive-container` with `.main-content` in the `body.offline-banner-visible` rules:

```scss
// OfflineBanner.scss - line 56
body.offline-banner-visible {
  header {
    top: $offline-banner-height;
    height: calc(100% - #{$offline-banner-height});
  }

  .main-content {
    top: calc(14px + #{$offline-banner-height});
    height: calc(100vh - 14px - #{$offline-banner-height});

    .electron & {
      top: calc(38px + #{$offline-banner-height});
      height: calc(100vh - 38px - #{$offline-banner-height});
    }
  }
}
```

**Key files:**
- [OfflineBanner.scss](src/components/ui/OfflineBanner.scss) - Wrong CSS selector for layout adjustment
- [_base.scss:335-352](src/styles/_base.scss#L335-L352) - `.main-content` definition that needs to be targeted

## Prevention

- When adding layout-shifting components, verify the CSS selectors match actual class names in the DOM
- Test the offline banner with DevTools network throttling to confirm layout adjusts correctly

---
_Created: 2026-03-18_
