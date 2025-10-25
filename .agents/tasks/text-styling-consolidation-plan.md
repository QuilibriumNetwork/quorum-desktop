# Text Styling Consolidation

**Created:** 2025-10-25
**Status:** Text primitive enhanced with color override, 13 modals migrated, 5 high-priority modals remain
**Updated:** 2025-10-25

---

## Summary

Created global typography classes and enhanced Text primitive with cross-platform `typography` prop. Successfully migrated 13 modal files using CSS classes. Remaining modals can now use either CSS classes (web-only) or Text primitive with typography prop (cross-platform).

**Key Decision Update:** Two approaches now available:
1. **CSS Classes** (web-only, faster): `<div className="text-body">`
2. **Text Primitive with typography prop** (cross-platform): `<Text typography="body">`

---

## ✅ Completed Work

### 1. Typography Classes Created
- File: `src/styles/_typography.scss`
- Classes: `.text-title-large`, `.text-title`, `.text-subtitle`, `.text-subtitle-2`, `.text-label`, `.text-label-strong`, `.text-body`, `.text-small`, `.text-small-desktop`
- Each consolidates: font-size + weight + line-height + color
- Fix: Added `rgb()` wrapper to all color variables

### 2. Text Primitive Enhanced with Typography Prop ✨
- **Added `typography` prop** to Text primitive for cross-platform semantic styling
- **Color override support**: `variant` prop can override typography's default color
- **Implementation:**
  - Updated `types.ts` with 9 typography values
  - `Text.web.tsx`: Applies semantic class + optional variant color override
  - `Text.native.tsx`: Maps typography values to theme colors + variant override
- **Color priority**: `color` prop > `variant` prop > `typography` default color
- **Fully backwards compatible**: Existing variant/size/weight props still work
- **Documentation updated**: API-REFERENCE.md, primitives-quick-reference.md
- **Playground updated**: Added typography examples with color override examples

### 3. Mobile Readability Fixed
- Changed all `$text-xs` → `$text-xs-responsive` in interactive elements
- Files: Input.scss, _base.scss, _modal_common.scss
- Result: 14px on mobile (was 12px - too small)

### 4. Modals Fully Migrated (13 files) ✅
**Using CSS Classes (web-only approach):**

**✅ UserSettingsModal** - All 4 components
- General.tsx
- Appearance.tsx
- Privacy.tsx
- Notifications.tsx

**✅ SpaceSettingsModal** - All 7 components
- General.tsx
- Account.tsx
- Roles.tsx
- Emojis.tsx
- Stickers.tsx
- Invites.tsx
- Danger.tsx

**✅ Other Modals**
- ChannelEditorModal.tsx
- GroupEditorModal.tsx

---

## 🔄 Remaining Modals (5 High-Priority)

### Use Text Primitive with Typography Prop + Variant Override

Now that Text primitive supports both `typography` and `variant` props together, use them for cross-platform modals with full control over sizing and color.

#### 1. **ConfirmationModal.tsx**
```tsx
// ❌ Before
<Text>{message}</Text>

// ✅ After
<Text typography="body">{message}</Text>
```

#### 2. **KickUserModal.tsx**
```tsx
// ❌ Before
<Text variant="subtle">
  Use the below button to kick this user out of the Space
</Text>

// ✅ After (body sizing + subtle color)
<Text typography="body" variant="subtle">
  Use the below button to kick this user out of the Space
</Text>
```

#### 3. **LeaveSpaceModal.tsx**
```tsx
// ❌ Before
<Text variant="subtle">
  Are you sure you want to leave this Space?
</Text>

// ✅ After (body sizing + subtle color)
<Text typography="body" variant="subtle">
  Are you sure you want to leave this Space?
</Text>
```

#### 4. **NewDirectMessageModal.tsx**
```tsx
// ❌ Before (Line 93-97)
<Text className="text-sm text-subtle !text-left max-sm:!text-center !block">
  Enter a user's address to start messaging them.
</Text>

// ✅ After (body sizing + subtle color)
<Text typography="body" variant="subtle">
  Enter a user's address to start messaging them.
</Text>

// ❌ Before (Line 146)
<div className="text-label">Always sign messages</div>

// ✅ After
<Text typography="label-strong">Always sign messages</Text>
```

#### 5. **CreateSpaceModal.tsx**
```tsx
// ❌ Before
<div className="text-label">
  Upload an image and choose a name for your Space.
</div>

// ✅ After
<Text typography="label-strong">
  Upload an image and choose a name for your Space.
</Text>
```

---

## 📋 Migration Pattern Reference

### NEW: Two Approaches Available

#### Option A: CSS Classes (Web-Only, Faster)
Use for web-only modals that won't be used on mobile:
```tsx
<div className="text-title">Modal Title</div>
<div className="text-body">Description</div>
<div className="text-label-strong">Label</div>
```

#### Option B: Text Primitive with Typography Prop (Cross-Platform)
Use for modals that should work on mobile:
```tsx
<Text typography="title">Modal Title</Text>
<Text typography="body">Description</Text>
<Text typography="body" variant="subtle">Subtle description</Text>
<Text typography="label-strong">Label</Text>
```

**Color Override:** Add `variant` prop to override typography's default color:
```tsx
<Text typography="body" variant="subtle">   {/* body size + subtle color */}
<Text typography="title" variant="subtle">  {/* title size + subtle color */}
<Text typography="label-strong" color="#fff"> {/* custom color */}
```

### Typography Values Reference

| Typography | Size | Weight | Default Color | Use Case |
|------------|------|--------|---------------|----------|
| `title-large` | 24px | bold | strong | Large page headers |
| `title` | 20px | bold | strong | Modal/section titles |
| `subtitle` | 18px | bold | main | Sub-headings |
| `subtitle-2` | 14px | bold | subtle | Small headers (uppercase) |
| `body` | 16px | normal | main | Main content (below title) |
| `label` | 14px | normal | subtle | Subtle labels |
| `label-strong` | 14px | normal | main | Form labels, emphasized text |
| `small` | 14px/12px | normal | subtle | Small text (responsive) |
| `small-desktop` | 12px | normal | subtle | Always small text |

**Note:** Default color can be overridden with `variant` or `color` prop.

### Rule: `.text-body` or `typography="body"` ONLY for text directly below main modal title

```tsx
// ✅ CORRECT - Main description below title
<Modal title="Settings">
  <Text typography="body">
    Configure your preferences here.
  </Text>
</Modal>

// ❌ WRONG - Description below sub-section
<Text typography="subtitle-2">Advanced</Text>
<Text typography="body">These are advanced options.</Text>
// Should be: <Text typography="label-strong">These are advanced options.</Text>
```

---

## Architecture Decisions

### Updated: Text Primitive with Typography Prop (Cross-Platform)

**Decision:** Use Text primitive with `typography` prop for cross-platform modals.

**When to Use Typography Prop:**
- ✅ Cross-platform modals (ConfirmationModal, simple dialogs)
- ✅ Components that may be used on mobile
- ✅ New modal development

**When to Use CSS Classes:**
- ✅ Web-only complex modals (Settings, advanced features)
- ✅ Already migrated modals (no need to change)
- ✅ Performance-critical scenarios

**Benefits of Typography Prop:**
- ✅ Cross-platform: Same API works on web and native
- ✅ No className conflicts: Bypasses Text primitive defaults
- ✅ Semantic: Clear intent (`typography="body"` vs combining props)
- ✅ Type-safe: TypeScript autocomplete for typography values
- ✅ Flexible color: `variant` prop overrides typography's default color

**Example Comparison:**
```tsx
// CSS Classes (Web-Only)
<div className="text-body">Description</div>

// Typography Prop (Cross-Platform)
<Text typography="body">Description</Text>

// Typography + Color Override (Cross-Platform)
<Text typography="body" variant="subtle">Subtle description</Text>

// Legacy (Still Works, Backwards Compatible)
<Text variant="subtle" size="base">Description</Text>
```

**Color Priority:** `color` prop > `variant` prop > `typography` default color

---

## Next Steps

### 1. Migrate Remaining 5 High-Priority Modals
Use **Text primitive with typography prop** for cross-platform support:
- ConfirmationModal.tsx
- KickUserModal.tsx
- LeaveSpaceModal.tsx
- NewDirectMessageModal.tsx
- CreateSpaceModal.tsx

### 2. Optional: Migrate Already-Completed Modals to Typography Prop
Consider migrating the 13 CSS-based modals to use `<Text typography="...">` for future mobile compatibility. Low priority since CSS classes work fine on web.

### 3. Update Documentation
- Add entry to `.agents/AGENTS.md` about typography prop
- Update `.agents/docs/guidelines/when-to-use-primitives.md` with typography prop guidance

### 4. Optional: Clean Up Old Classes
Once all modals confirmed working:
- Remove `.modal-text-label` from `_modal_common.scss` (unused)
- Remove `.modal-text-small` from `_modal_common.scss` (replaced)
- Remove `.modal-text-section-header` from `_modal_common.scss` (replaced)
- Keep `.modal-text-section` (layout class, still used)

---

## Files Modified

**Created:**
- `src/styles/_typography.scss`

**Enhanced:**
- `src/components/primitives/Text/types.ts` (added typography prop)
- `src/components/primitives/Text/Text.web.tsx` (typography support)
- `src/components/primitives/Text/Text.native.tsx` (typography mappings)

**Documentation:**
- `.agents/docs/features/primitives/API-REFERENCE.md`
- `.agents/docs/features/primitives/02-primitives-quick-reference.md`
- `src/dev/primitives-playground/examples/Text.tsx`
- `src/dev/primitives-playground/primitivesConfig.json`

**Styling:**
- `src/index.scss` (import)
- `src/components/primitives/Input/Input.scss`
- `src/styles/_base.scss`
- `src/styles/_modal_common.scss`

**Modals (13 files migrated with CSS classes):**
- `src/components/modals/UserSettingsModal/` (4 files)
- `src/components/modals/SpaceSettingsModal/` (7 files)
- `src/components/modals/ChannelEditorModal.tsx`
- `src/components/modals/GroupEditorModal.tsx`

---

## Migration Statistics

- **Total Modal Files Analyzed**: 27
- **✅ Fully Migrated**: 13 files (48%)
- **🔄 Remaining High-Priority**: 5 files (19%)
- **⚠️ Low Priority**: 4 files (15%) - AddSpaceModal, JoinSpaceModal, etc.
- **No Text Content**: 5 files (18%) - ImageModal, ModalSaveOverlay, Navigation files

---

_Last updated: 2025-10-25_
