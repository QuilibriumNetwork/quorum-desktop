---
type: task
title: Primitive Migration Audit Report
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Primitive Migration Audit Report

**Created:** 2025-07-28
**Status:** Phase 4A - Web Component Migration
**Purpose:** Catalog remaining non-primitive form elements for systematic migration

---

## Executive Summary

This audit identifies components that still use div-based form elements or raw HTML elements instead of the primitive architecture. These need migration to ensure consistent cross-platform behavior and accessibility.

**Total Items Found:** 8 components/patterns
**High Priority:** 3 items
**Medium Priority:** 3 items
**Low Priority:** 2 items

---

## High Priority Items

### 1. Message Input TextAreas (CRITICAL)

**Impact:** Core messaging functionality, high usage frequency

#### Channel Message Input

- **File:** `src/components/space/Channel.tsx`
- **Pattern:** Raw `<textarea>` element for message composition
- **Location:** Approximately line 475
- **Migration:** Replace with `TextArea` primitive component
- **Complexity:** Medium (needs to maintain existing functionality like auto-resize, emoji handling)

#### Direct Message Input

- **File:** `src/components/direct/DirectMessage.tsx`
- **Pattern:** Raw `<textarea>` element for direct message composition
- **Location:** Approximately line 406
- **Migration:** Replace with `TextArea` primitive component
- **Complexity:** Medium (similar to Channel.tsx)

### 2. Search Input Element

**Impact:** Core search functionality

#### SearchBar Component

- **File:** `src/components/search/SearchBar.tsx`
- **Pattern:** Raw HTML `<input>` element
- **Location:** Lines 167-180
- **Migration:** Replace with `Input` primitive component
- **Complexity:** Low-Medium (needs to maintain search-specific behavior)

---

## Medium Priority Items

### 3. File Upload Trigger Divs

**Impact:** Accessibility and consistency

#### SpaceEditor File Upload Buttons

- **File:** `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`
- **Pattern:** `<div className="btn-secondary">` with onClick handlers
- **Usage:** Emoji and sticker upload triggers
- **Migration:** Replace with `Button` primitive components
- **Complexity:** Low (already using react-dropzone, just need to wrap triggers)

### 4. ToggleSwitch Component

**Impact:** Consistency with primitive architecture

#### Custom ToggleSwitch

- **File:** `src/components/ToggleSwitch.tsx`
- **Pattern:** Custom div-based toggle implementation
- **Location:** Lines 11-22
- **Migration:** Replace with existing `Switch` primitive component
- **Complexity:** Low (Switch primitive already exists)
- **Note:** Verify all usage sites support Switch primitive API

### 5. File Upload Areas in Modals

**Impact:** Accessibility improvement

#### Modal File Upload Patterns

- **Files:** Multiple modals (CreateSpaceModal, UserSettingsModal, etc.)
- **Pattern:** Dropzone areas using divs as click targets
- **Migration:** Ensure proper Button primitive usage for upload triggers
- **Complexity:** Low (mostly styling and accessibility improvements)

---

## Low Priority Items

### 6. AccentColorSwitcher Component

**Impact:** Accessibility and consistency

#### Color Picker Divs

- **File:** `src/components/ui/AccentColorSwitcher.tsx`
- **Pattern:** Color picker divs with onClick handlers
- **Location:** Lines 34-42
- **Migration:** Replace with `Button` primitive components with color styling
- **Complexity:** Low (cosmetic improvement)

### 7. Onboarding Button Classes

**Impact:** Consistency (already using Button primitive)

#### Onboarding Disabled State

- **File:** `src/components/onboarding/Onboarding.tsx`
- **Pattern:** Uses `btn-disabled-onboarding` className with Button primitive
- **Status:** Already using primitive, just needs class cleanup
- **Migration:** Verify disabled state handling in Button primitive
- **Complexity:** Very Low

---

## Migration Strategy

### Phase 1: Critical Path (Week 1)

1. **Message inputs** - Channel.tsx and DirectMessage.tsx textarea migrations
2. **Search input** - SearchBar.tsx input migration
3. **Testing** - Verify core functionality works

### Phase 2: Consistency (Week 2)

1. **ToggleSwitch** - Replace with Switch primitive
2. **File upload triggers** - Convert div buttons to Button primitives
3. **Testing** - Verify upload and toggle functionality

### Phase 3: Polish (Week 3)

1. **AccentColorSwitcher** - Convert to Button primitives
2. **Class cleanup** - Remove legacy button classes
3. **Final testing** - Complete cross-browser/device testing

---

## Implementation Notes

### TextArea Migration Considerations

- Preserve auto-resize functionality
- Maintain emoji picker integration
- Keep message sending on Enter behavior
- Ensure mobile keyboard handling works

### Input Migration Considerations

- Preserve search debouncing behavior
- Maintain focus/blur event handling
- Keep keyboard shortcut support

### Button Migration Considerations

- Ensure proper ARIA labels for accessibility
- Maintain existing click behaviors
- Preserve styling and hover states

---

## Testing Checklist

For each migrated component:

- [ ] **Functionality:** Core behavior unchanged
- [ ] **Styling:** Visual appearance matches original
- [ ] **Accessibility:** Screen reader compatible, proper focus handling
- [ ] **Mobile:** Touch targets appropriate size, keyboard behavior correct
- [ ] **Cross-browser:** Works in Chrome, Firefox, Safari, Edge
- [ ] **Performance:** No regression in rendering or interaction speed

---

## Risk Assessment

**Low Risk:**

- Button primitive migrations (well-tested primitive)
- Switch primitive migration (primitive exists)

**Medium Risk:**

- TextArea migrations (complex existing functionality)
- Search input migration (critical user flow)

**Mitigation:**

- Implement behind feature flags initially
- Thorough testing in development environment
- Staged rollout with quick rollback capability

---

## Status Tracking

- [ ] Phase 1: Critical Path
- [ ] Phase 2: Consistency
- [ ] Phase 3: Polish
- [ ] Final validation and cleanup

**Last Updated:** 2025-07-28
