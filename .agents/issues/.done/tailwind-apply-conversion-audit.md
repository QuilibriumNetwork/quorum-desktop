---
type: task
title: "Tailwind @apply Conversion Audit"
status: done
complexity: high
created: 2026-01-09
updated: 2025-10-12
---

# Tailwind @apply Conversion Audit

## Overview

This document audits all remaining `@apply` usage in the codebase to guide conversion to raw CSS with SCSS variables following our [styling guidelines](.agents/docs/styling-in-react.md).


**Remaining files**: 3 files with 110 @apply instances

---

## Summary Statistics

| File | @apply Count | Complexity | Priority |
|------|--------------|------------|----------|
| MessageComposer.scss | 64 | High | High |
| ExpandableNavMenu.scss | 0 | Medium | Medium |
| MessageActionsDrawer.scss | 0 | Low | Low |
| _modal_common.scss | 1 | Low | Medium |
| _components.scss | 0 | Low | Low |
| UserProfile.scss | 0 | Low | Low |
| UserInitials.scss | 0 | Low | Low |
| ColorSwatch.scss | 12 | Low | Low |
| RadioGroup.scss | 28 | Medium | Medium |

**Total**: 110 @apply instances across 5 files

---

## Conversion Priority

### Priority 1: High Impact (Convert First)

#### 1. MessageComposer.scss DONE
**Location**: `src/components/message/MessageComposer.scss`
**@apply count**: 64 instances

**Reason**: Most heavily used component, many instances

<details>
<summary>Detailed breakdown (64 instances)</summary>

**Lines 5-225**: All classes use @apply extensively

Key classes to convert:
- `.message-composer-textarea-container` (line 5): `flex-1`
- `.message-composer-textarea` (line 10): `bg-transparent border-0 outline-0 text-main`
- `.message-composer-container` (line 51): `w-full pr-6 lg:pr-8`
- `.message-composer-row` (line 58): `w-full items-center gap-2 ml-[11px] my-2 p-[6px] rounded-lg bg-chat-input`
- `.message-composer-row.has-reply` (line 72): `rounded-t-none mt-0`
- `.message-composer-upload-btn` (line 93): `w-7 h-7 rounded-full bg-surface-5 hover:bg-surface-6 cursor-pointer flex items-center justify-center flex-shrink-0`
- `.message-composer-sticker-btn` (line 98): `w-8 h-8 p-0 rounded-md cursor-pointer flex items-center justify-center flex-shrink-0 text-surface-9 hover:text-main`
- `.message-composer-send-btn` (line 103): `hover:bg-accent-400 cursor-pointer w-8 h-8 rounded-full bg-accent bg-center bg-no-repeat bg-[url('/send.png')] bg-[length:60%] flex-shrink-0`
- `.message-composer-signing-btn` (line 108): `w-8 h-8 p-0 rounded-md cursor-pointer flex items-center justify-center flex-shrink-0`
- `.message-composer-signing-btn.unsigned` (line 113): `text-warning`
- `.message-composer-signing-btn.signed` (line 117): `text-surface-9 hover:text-main`
- `.message-composer-disabled` (line 122): `w-full items-center gap-2 ml-[11px] my-2 py-2 pl-4 pr-[6px] rounded-lg flex justify-start bg-chat-input`
- `.message-composer-disabled-icon` (line 126): `text-muted flex-shrink-0`
- `.message-composer-disabled-text` (line 130): `text-base font-normal`
- `.message-composer-info-container` (line 136): `flex flex-col w-full ml-[11px] mt-2 mb-0`
- `.message-composer-callout` (line 140): `ml-1 mt-3 mb-1`
- `.message-composer-reply-bar` (line 145): `rounded-t-lg px-4 cursor-pointer py-1 text-xs flex flex-row justify-between items-center bg-surface-4`
- `.message-composer-reply-text` (line 149): `text-subtle`
- `.message-composer-reply-close` (line 153): `cursor-pointer hover:opacity-70`
- `.message-composer-file-preview` (line 158): `mx-3 mt-2`
- `.message-composer-file-container` (line 162): `p-2 relative rounded-lg bg-surface-3 inline-block`
- `.message-composer-file-close` (line 166): `absolute top-1 right-1 w-6 h-6 p-0 bg-surface-7 hover:bg-surface-8 rounded-full z-10 shadow-sm flex items-center justify-center`
- `.message-composer-gif-overlay` (line 175): `absolute inset-0 flex items-center justify-center`
- `.message-composer-play-icon` (line 179): `bg-black/50 rounded-full p-1`
- `.message-composer-play-svg` (line 183): `w-4 h-4 text-white`
- `.message-composer-mention-dropdown` (line 188): `ml-[11px] mb-2 w-[250px] sm:w-[300px]`
- `.message-composer-mention-container` (line 192): `bg-surface-0 border rounded-lg shadow-lg max-h-60 overflow-y-auto`
- `.message-composer-mention-item` (line 197): `flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-2`
- `.message-composer-mention-item.selected` (line 201): `bg-surface-3`
- `.message-composer-mention-item.first` (line 205): `rounded-t-lg`
- `.message-composer-mention-item.last` (line 209): `rounded-b-lg`
- `.message-composer-mention-avatar` (line 213): `w-8 h-8 rounded-full bg-cover bg-center flex-shrink-0`
- `.message-composer-mention-info` (line 217): `flex flex-col min-w-0`
- `.message-composer-mention-name` (line 221): `text-sm font-medium text-main truncate`
- `.message-composer-mention-address` (line 225): `text-xs text-subtle truncate`

**Conversion notes**:
- Heavy use of flexbox utilities
- Many spacing utilities can use SCSS variables
- Color classes need mapping to CSS custom properties
- Some arbitrary values like `ml-[11px]` will remain as-is

</details>

---

### Priority 2: Medium Impact - DONE

#### 2. RadioGroup.scss
**Location**: `src/components/primitives/RadioGroup/RadioGroup.scss`
**@apply count**: 28 instances

**Reason**: Primitive component used throughout app

<details>
<summary>Detailed breakdown (28 instances)</summary>

Lines with @apply:
- Line 2: `flex gap-3`
- Line 6: `flex-row`
- Line 10: `flex-col max-w-[300px]`
- Line 15: `opacity-60 cursor-not-allowed`
- Line 21: `cursor-pointer`
- Line 65: `cursor-pointer`
- Line 178: `flex items-center justify-between cursor-pointer`
- Line 183: `flex items-center gap-2`
- Line 188: `text-surface-9`
- Line 199: `capitalize mr-3`

**Conversion notes**:
- Standard flexbox patterns
- Simple spacing and display utilities
- Good candidate for SCSS variables

</details>

#### 3. ExpandableNavMenu.scss - DONE
**Location**: `src/components/navbar/ExpandableNavMenu.scss`
**@apply count**: 14 instances

**Reason**: Navigation component

<details>
<summary>Detailed breakdown (14 instances)</summary>

Lines with @apply:
- Line 56: `fixed bottom-0 flex flex-col items-center justify-end`
- Line 73: `w-[40px] h-[40px] flex items-center justify-center rounded-full`
- Line 74: `bg-surface-4 text-main`
- Line 75: `transition-all duration-200 lg:hover:bg-surface-6`
- Line 76: `cursor-pointer`
- Line 81: `w-[32px] h-[32px]` (media query)
- Line 87: `w-[40px] h-[40px] rounded-full`
- Line 88: `transition-all duration-200 lg:hover:opacity-80`
- Line 89: `cursor-pointer`
- Line 96: `w-[32px] h-[32px]` (media query)

**Conversion notes**:
- Position and layout utilities
- Transition properties can use SCSS variables
- Responsive variants need special handling

</details>

#### 4. _modal_common.scss
**Location**: `src/styles/_modal_common.scss`
**@apply count**: 1 instance

**Priority**: Medium (high visibility component)

<details>
<summary>Detailed breakdown (1 instance)</summary>

Line 526: `.modal-list-item`
```scss
@apply transition-colors odd:bg-surface-4 even:bg-surface-3;
```

**Conversion**:
```scss
transition: background-color $duration-200 $ease-in-out;

&:nth-child(odd) {
  background-color: var(--surface-4);
}

&:nth-child(even) {
  background-color: var(--surface-3);
}
```

</details>

---

### Priority 3: Low Impact (Convert Last)

#### 5. MessageActionsDrawer.scss - DONE
**Location**: `src/components/message/MessageActionsDrawer.scss`
**@apply count**: 14 instances

**Reason**: Mobile-only drawer component

<details>
<summary>Detailed breakdown (14 instances)</summary>

Lines with @apply:
- Line 5: `py-2`
- Line 9: `flex items-center justify-center gap-1`
- Line 16: `w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all`
- Line 17: `bg-surface-2 hover:bg-surface-3 hover:scale-110 active:scale-95`
- Line 20: `bg-accent-100 border-2 border-accent-500`
- Line 27: `w-11 h-11 rounded-full flex items-center justify-center`
- Line 28: `bg-transparent border-2 border-dashed border-surface-4 ml-1`
- Line 29: `transition-all hover:bg-surface-2 hover:border-surface-5 hover:scale-110 active:scale-95`
- Line 34: `flex flex-col gap-1 pb-2 px-2`
- Line 39: `min-h-[44px] py-2 rounded-xl transition-all`
- Line 40: `hover:bg-surface-2 active:scale-[0.98]`
- Line 41: `text-left justify-start flex items-center`
- Line 42: `text-main text-base`
- Line 54: `text-danger hover:bg-danger/10`

**Conversion notes**:
- Standard spacing and flexbox utilities
- Transform effects easy to convert
- Color and surface variables straightforward

</details>

#### 6. _components.scss - DONE
**Location**: `src/styles/_components.scss`
**@apply count**: 5 instances


<details>
<summary>Detailed breakdown (5 instances)</summary>

Lines with @apply:
- Line 12: `.info-icon-tooltip`: `text-subtle hover:text-main cursor-pointer`
- Line 49: `.header-icon-button`: `w-6 h-6 p-2 rounded-md cursor-pointer flex items-center justify-center`
- Line 53: `.header-icon-button .quorum-button-icon-element`: `text-base text-subtle !important`
- Line 59: `.header-icon-button:hover .quorum-button-icon-element`: `text-main !important`

**Conversion notes**:
- Simple utilities
- Quick conversion

</details>

#### 7. UserProfile.scss - DONE
**Location**: `src/components/user/UserProfile.scss`
**@apply count**: 1 instance


<details>
<summary>Detailed breakdown (1 instance)</summary>

Line 116: `.user-profile-role-tag`
```scss
@apply inline-flex items-center py-[3px] px-3 rounded-full font-medium text-xs text-center select-none;
```

**Conversion**:
```scss
display: inline-flex;
align-items: center;
padding: 3px $spacing-3;
border-radius: $rounded-full;
font-weight: $font-medium;
font-size: $text-xs;
text-align: center;
user-select: none;
```

</details>

#### 8. UserInitials.scss - DONE
**Location**: `src/components/user/UserInitials/UserInitials.scss`
**@apply count**: 5 instances


<details>
<summary>Detailed breakdown (5 instances)</summary>

Lines with @apply:
- Line 3: `rounded-full flex items-center justify-center`
- Line 4: `text-white font-medium select-none`
- Line 5: `transition-all duration-200`
- Line 28: `cursor-pointer`
- Line 31: `shadow-md scale-105`

**Conversion notes**:
- Simple utilities
- Straightforward conversion

</details>

#### 9. ColorSwatch.scss- DONE
**Location**: `src/components/primitives/ColorSwatch/ColorSwatch.scss`
**@apply count**: 12 instances


<details>
<summary>Detailed breakdown (12 instances)</summary>

Lines with @apply:
- Line 2: `rounded-full cursor-pointer border-2 flex items-center justify-center transition-all relative`
- Line 7: `scale-110`
- Line 11: `outline-none ring-2 ring-offset-2`
- Line 18: `w-6 h-6`
- Line 22: `w-8 h-8`
- Line 26: `w-10 h-10`
- Line 39: `cursor-not-allowed opacity-50`
- Line 44: `text-white absolute`

**Conversion notes**:
- Mostly layout and sizing
- Simple patterns

</details>

---

## Conversion Guidelines

### Reference Implementation

See `src/components/primitives/Button/Button.scss` for the conversion pattern:

**Before (with @apply)**:
```scss
.btn-primary {
  @apply flex items-center justify-center px-4 py-2;
  @apply rounded-full shadow-sm;
  @apply font-medium text-sm;
}
```

**After (raw CSS with SCSS variables)**:
```scss
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-2 $spacing-4;
  border-radius: $rounded-full;
  box-shadow: $shadow-sm;
  font-weight: $font-medium;
  font-size: $text-sm;
}
```

### Conversion Rules

1. **Use SCSS variables from `_variables.scss`**:
   - Spacing: `$spacing-4` instead of `1rem`
   - Typography: `$text-sm` instead of `0.875rem`
   - Border radius: `$rounded-lg` instead of `0.5rem`
   - Transitions: `$duration-200` and `$ease-in-out`
   - Shadows: `$shadow-md` instead of explicit shadow values

2. **Use CSS custom properties for colors**:
   - `var(--surface-4)` for surface colors
   - `var(--accent)` for accent colors
   - `var(--color-text-main)` for text colors

3. **Keep arbitrary values as-is**:
   - `ml-[11px]` → `margin-left: 11px;`
   - `py-[3px]` → `padding-top: 3px; padding-bottom: 3px;`

4. **Handle pseudo-classes properly**:
   ```scss
   // Before
   @apply hover:bg-surface-3

   // After
   &:hover {
     background-color: var(--surface-3);
   }
   ```

5. **Handle responsive utilities**:
   ```scss
   // Before
   @apply lg:pr-8

   // After
   @media (min-width: $screen-lg) {
     padding-right: $spacing-8;
   }
   ```

6. **Handle nth-child selectors**:
   ```scss
   // Before
   @apply odd:bg-surface-4 even:bg-surface-3

   // After
   &:nth-child(odd) {
     background-color: var(--surface-4);
   }
   &:nth-child(even) {
     background-color: var(--surface-3);
   }
   ```

---

## Testing Strategy

After each conversion:

1. **Visual regression**: Compare before/after screenshots
2. **Build verification**: Run `yarn build` to ensure no syntax errors
3. **Type check**: Run `cmd.exe /c "cd /d D:\\GitHub\\Quilibrium\\quorum-desktop && npx tsc --noEmit"`
4. **Cross-platform test**: Verify on both web and mobile if applicable

---

## Conversion Checklist

Use this checklist when converting each file:

- [ ] Read the original file and understand the styles
- [ ] Identify all @apply instances
- [ ] Map Tailwind utilities to SCSS variables
- [ ] Map color classes to CSS custom properties
- [ ] Handle pseudo-classes and responsive variants
- [ ] Test the conversion visually
- [ ] Run build and type check
- [ ] Update this document to mark file as converted

---

## Notes

- **Do not convert** styles that are tightly coupled with utility-first patterns (like arbitrary values)
- **Prioritize readability** - if the raw CSS becomes harder to read than @apply, consider keeping @apply
- **Document decisions** - add comments explaining why certain patterns were chosen
- **Maintain consistency** - follow the Button.scss pattern throughout

---

_Last updated: 2025-10-12_
_Initial audit completed: 2025-10-12_
