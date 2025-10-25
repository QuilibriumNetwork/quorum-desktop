# Text Styling Consolidation

**Created:** 2025-10-25
**Status:** In Progress - Partial migration complete, 13 modals need updates
**Updated:** 2025-10-25

---

## Summary

Created global typography classes to replace modal-specific text classes and improve mobile readability. Analyzed all 27 modal files - 8 are complete, 13 need migration.

**Key Decision:** Use plain `<div>` with typography classes instead of `<Text>` primitive (conflicts with defaults).

---

## ✅ Completed Work

### 1. Typography Classes Created
- File: `src/styles/_typography.scss`
- Classes: `.text-title-large`, `.text-title`, `.text-subtitle`, `.text-subtitle-2`, `.text-label`, `.text-label-strong`, `.text-body`, `.text-small`, `.text-small-desktop`
- Each consolidates: font-size + weight + line-height + color
- Fix: Added `rgb()` wrapper to all color variables

### 2. Mobile Readability Fixed
- Changed all `$text-xs` → `$text-xs-responsive` in interactive elements
- Files: Input.scss, _base.scss, _modal_common.scss
- Result: 14px on mobile (was 12px - too small)

### 3. Modals Fully Migrated (8 files)
**✅ UserSettingsModal** - All 4 components
- General.tsx
- Appearance.tsx
- Privacy.tsx
- Notifications.tsx

**✅ SpaceSettingsModal** - 2 components
- General.tsx
- Account.tsx

**✅ Other Modals**
- ChannelEditorModal.tsx
- GroupEditorModal.tsx

---

## 🔄 Modals Needing Migration (13 files)

### High Priority (User-Facing Text)

#### 1. **ConfirmationModal.tsx**
- **Line 50-52**: `<Text>{message}</Text>` → `<div className="text-body">{message}</div>`

#### 2. **KickUserModal.tsx**
- **Line 74-76**: `<Text variant="subtle">` → `<div className="text-body">`

#### 3. **LeaveSpaceModal.tsx**
- **Line 39-44**: `<Text variant="subtle">` → `<div className="text-body">`

#### 4. **NewDirectMessageModal.tsx**
- **Line 93-97**: `<Text className="text-sm text-subtle...">` → `<div className="text-body">`
- **Line 146**: `text-label` → `text-label-strong`

#### 5. **CreateSpaceModal.tsx**
- **Lines 101-105, 106-109**: `text-label` → `text-label-strong`

---

### Medium Priority (Settings Modals)

#### 6. **SpaceSettingsModal/Roles.tsx**
- **Line 41**: `text-xl font-bold` → `text-title`
- **Line 44**: `text-sm text-main` → `text-label-strong`

#### 7. **SpaceSettingsModal/Emojis.tsx**
- **Line 40**: `text-xl font-bold` → `text-title`
- **Line 43**: `text-sm text-main` → `text-label-strong`

#### 8. **SpaceSettingsModal/Stickers.tsx**
- **Line 40**: `text-xl font-bold` → `text-title`
- **Line 43**: `text-sm text-main` → `text-label-strong`

#### 9. **SpaceSettingsModal/Invites.tsx**
- **Line 46**: `text-xl font-bold` → `text-title`
- **Line 49**: `text-sm text-main` → `text-label-strong`
- **Line 150**: `text-sm text-subtle` → `text-label`

#### 10. **SpaceSettingsModal/Danger.tsx**
- **Line 26**: `text-xl font-bold text-danger` → `text-title text-danger`
- **Line 29**: `text-sm text-main` → `text-label-strong`

---

### Low Priority

#### 11. **AddSpaceModal.tsx**
- **Line 273**: `<Text className="px-3 text-subtle text-sm">` → `<div className="px-3 text-label">`

---

### ⚠️ Needs Review

#### 12. **JoinSpaceModal.tsx**
- **Line 124-131**: Uses `<Text variant="strong" size="lg">` for validated space name display
- **Review**: Special case - displaying space name as prominent element. May be appropriate to keep `<Text>` component here.

---

## 📊 Migration Statistics

- **Total Modal Files Analyzed**: 27
- **✅ Fully Migrated**: 8 files (30%)
- **🔄 Needs Migration**: 13 files (48%)
- **⚠️ Needs Review**: 1 file (4%)
- **No Text Content**: 5 files (18%) - ImageModal, ModalSaveOverlay, Navigation files

---

## 📋 Migration Pattern Reference

### Rule: `.text-body` ONLY for text directly below main modal title

```tsx
// ✅ CORRECT - Main description below title
<Modal title="Settings">
  <div className="text-body">
    Configure your preferences here.
  </div>
</Modal>

// ❌ WRONG - Description below sub-section
<div className="text-subtitle-2">Advanced</div>
<div className="text-body">These are advanced options.</div>
// Should be: <div className="text-label-strong">These are advanced options.</div>
```

### Common Substitutions

| Pattern | Before | After | Use Case |
|---------|--------|-------|----------|
| **Title** | `<div className="text-xl font-bold">` | `<div className="text-title">` | Main section headers |
| **Sub-title** | `<div className="text-sm font-bold uppercase">` | `<div className="text-subtitle-2">` | Sub-section headers |
| **Body** | `<Text variant="subtle">` | `<div className="text-body">` | Main description (title only!) |
| **Label** | `<div className="text-sm text-main">` | `<div className="text-label-strong">` | All other labels/descriptions |
| **Label** | `<div className="text-label">` | `<div className="text-label-strong">` | Upgrade weak labels |
| **Text primitive** | `<Text className="...">` | `<div className="...">` | Avoid primitive defaults |

### Complete Examples

**Modal Title + Description:**
```tsx
// ❌ Before
<div className="modal-text-section">
  <div className="text-xl font-bold">Privacy/Security</div>
  <div className="pt-2 text-sm text-subtle">
    Manage your privacy settings.
  </div>
</div>

// ✅ After
<div className="modal-text-section">
  <div className="text-title">Privacy/Security</div>
  <div className="pt-2 text-body">
    Manage your privacy settings.
  </div>
</div>
```

**Sub-section + Description:**
```tsx
// ❌ Before
<div className="text-sm font-bold uppercase">Security</div>
<div className="pt-2 text-sm text-main">
  Adjust security-related settings.
</div>

// ✅ After
<div className="text-subtitle-2">Security</div>
<div className="pt-2 text-label-strong">
  Adjust security-related settings.
</div>
```

**Switch Label:**
```tsx
// ❌ Before
<Text className="modal-text-small text-main">
  Enable notifications
</Text>

// ✅ After
<div className="text-label-strong">
  Enable notifications
</div>
```

---

## Architecture Decisions

### Text Primitive vs Typography Classes

**Decision:** Hybrid approach - primitives for layout, classes for text.

**Use Primitives:**
- ✅ Layout (FlexRow, Container, Spacer)
- ✅ Interactive elements (Button, Input, Switch)
- ✅ Cross-platform code

**Use Typography Classes:**
- ✅ Text content styling
- ✅ Semantic patterns (titles, labels, body)
- ✅ Web-only fine

**Don't:**
- ❌ Mix Text primitive with typography classes (conflicts)

### Why Classes Instead of Text Primitive

Text primitive adds defaults that conflict with typography classes:

```tsx
<Text className="text-label">  // ❌ Bad
// Rendered as: <span class="text-main text-base font-normal text-left text-label">
// Defaults override typography class!

<div className="text-label">   // ✅ Good
// Rendered as: <div class="text-label">
// Clean, no conflicts
```

---

## Next Steps

### 1. Complete Modal Migration
Work through the 13 modals in priority order:
- High priority: ConfirmationModal, KickUserModal, LeaveSpaceModal, NewDirectMessageModal, CreateSpaceModal
- Medium priority: 5 SpaceSettingsModal components
- Low priority: AddSpaceModal
- Review: JoinSpaceModal (edge case)

### 2. Update Documentation
- Add entry to `.agents/AGENTS.md` about typography classes
- Create `.agents/docs/guidelines/when-to-use-primitives.md`

### 3. Optional: Clean Up Old Classes
Once all modals confirmed working:
- Remove `.modal-text-label` from `_modal_common.scss` (unused)
- Remove `.modal-text-small` from `_modal_common.scss` (replaced)
- Remove `.modal-text-section-header` from `_modal_common.scss` (replaced)
- Keep `.modal-text-section` (layout class, still used)

---

## Files Modified So Far

**Created:**
- `src/styles/_typography.scss`

**Updated:**
- `src/index.scss` (import)
- `src/components/primitives/Input/Input.scss`
- `src/styles/_base.scss`
- `src/styles/_modal_common.scss`
- `src/components/modals/UserSettingsModal/` (4 files)
- `src/components/modals/SpaceSettingsModal/General.tsx`
- `src/components/modals/SpaceSettingsModal/Account.tsx`
- `src/components/modals/ChannelEditorModal.tsx`
- `src/components/modals/GroupEditorModal.tsx`

---

_Last updated: 2025-10-25_
