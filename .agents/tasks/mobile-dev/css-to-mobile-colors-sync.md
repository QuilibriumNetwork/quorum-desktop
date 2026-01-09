---
type: task
title: CSS to Mobile Colors Sync Script
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# CSS to Mobile Colors Sync Script

**Goal**: Auto-sync color changes from `src/styles/_colors.scss` to `src/components/primitives/theme/colors.ts` while preserving mobile-specific overrides.

## Problem

- Web uses CSS variables in `_colors.scss`
- Mobile uses TypeScript objects in `colors.ts`
- Need to keep them in sync when CSS colors change
- Must preserve mobile-specific colors (like `field.*` for modal backgrounds)

## High-Level Plan

### 1. Parse CSS Variables

- Read `_colors.scss`
- Extract CSS custom properties (`--surface-*`, `--color-text-*`, etc.)
- Parse both `:root` (light theme) and `html.dark` (dark theme) sections

### 2. Map CSS → TypeScript

- Surface colors: `--surface-0` → `surface['0']`
- Text colors: `--color-text-main` → `text.main`
- Background colors: `--color-bg-sidebar` → `bg.sidebar`
- Border colors: `--color-border-strong` → `border.strong`
- Utility colors: `--danger` → `utilities.danger` (RGB values)

### 3. Preserve Mobile-Specific Sections

- **Don't sync**: `field.*` (mobile modal optimized colors)
- **Don't sync**: Any sections marked with `// MOBILE-SPECIFIC` comments
- **Do sync**: All standard theme colors that exist in CSS

### 4. Update colors.ts

- Read existing `colors.ts`
- Replace syncable sections with CSS-derived values
- Keep mobile-specific sections untouched
- Maintain proper TypeScript formatting

### 5. Validation

- Ensure TypeScript compiles
- Verify mobile-specific sections remain intact
- Test color changes propagate correctly

## Implementation Notes

- Could be a Node.js script in `scripts/sync-colors.js`
- Run manually or as part of build process
- Add comments to `colors.ts` to mark sync boundaries:

  ```typescript
  // === AUTO-SYNCED FROM CSS ===
  surface: { ... },

  // === MOBILE-SPECIFIC (DO NOT SYNC) ===
  field: { ... },
  ```

## Future Considerations

- Could extend to sync other mobile-specific overrides
- Might need more sophisticated parsing for complex CSS values
- Consider watching `_colors.scss` for changes and auto-running

---
