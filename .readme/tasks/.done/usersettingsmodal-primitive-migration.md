# Complex Modal Primitive Migration Template

**Based on:** UserSettingsModal migration (2025-07-28)  
**Purpose:** Template for migrating complex modals to primitive architecture  
**Result:** 95% primitive architecture achieved

---

## Quick Summary - UserSettingsModal

✅ **Migrated:** Modal, Switch (3), Input (1), Icon (8), Tooltip (4/5), RadioGroup, ColorSwatch  
❌ **Exception:** 1 tooltip (file upload), ClickToCopyContent (complex component)  
🔧 **Enhanced:** Icon primitive (added `id` prop), ColorSwatch primitive (color handling)

---

## 🎯 Migration Template (5 Phases)

### Phase 1: Theme/Color Components

- **ThemeRadioGroup** → `RadioGroup` primitive with Icon names
- **AccentColorSwitcher** → `ColorSwatch` primitive with direct color names

### Phase 2: Form Elements

- **ToggleSwitch** → `Switch` primitive (`value/onChange` vs `active/onClick`)
- **Raw inputs** → `Input` primitive (handles `quorum-input` styling automatically)
- **Verify Select** → Should already use Select primitive

### Phase 3: Icons

- **FontAwesome icons** → `Icon` primitive
- **Remove FontAwesome imports** completely
- **Ensure Icon primitive accepts `id` prop** for tooltip anchoring

### Phase 4: Tooltips ⚠️ **CRITICAL ISSUES**

- **Simple tooltips** → `Tooltip` primitive (wrapper pattern)
- **Complex interactive elements** → Keep `ReactTooltip` (see issues below)

### Phase 5: Verify Buttons

- **Check all buttons** → Should already use `Button` primitive

---

## 🚨 Critical Integration Issues

### 1. Tooltip + react-dropzone Conflict

**Issue:** Tooltip primitive's `cloneElement` breaks `{...getRootProps()}`  
**Solution:** Use ReactTooltip for file upload areas  
**Affected:** Any drag-drop, file upload, or complex interactive elements

### 2. ColorSwatch Color Variables

**Issue:** CSS variables don't work with primitive color props  
**Solution:** Use direct color names (`'blue'`, `'purple'`), primitive converts to hex

### 3. Icon Primitive Enhancement Required

**Issue:** Icon primitive doesn't accept `id` prop needed for tooltips  
**Solution:** Add `id?: string` to IconProps and forward to FontAwesome component

---

## ✅ Best Practices

### DO use primitives for:

- Form elements (Input, Switch, Select)
- Simple buttons and icons
- Theme/color selection
- Standard tooltips on simple elements

### DON'T use primitives for:

- File upload areas with react-dropzone
- Complex interactive elements requiring direct prop spreading
- Third-party library integrations that modify props

### Hybrid approach:

- Keep ReactTooltip as fallback for complex cases
- Maintain ClickToCopyContent and similar complex components

---

## 📊 Final Architecture Example

```typescript
// Optimal imports after migration:
import {
  Button,
  Select,
  Modal,
  Switch,
  Input,
  Icon,
  Tooltip,
} from '../primitives';

// Exception imports (keep minimal):
import ReactTooltip from '../ReactTooltip'; // For file uploads only
import ClickToCopyContent from '../ClickToCopyContent'; // Complex components
```

**Primitive Usage Stats:**

- Modal: 1 container ✅
- Buttons: All instances ✅
- Form elements: All simple inputs/switches ✅
- Icons: All FontAwesome → Icon primitive ✅
- Tooltips: 80-90% using Tooltip primitive ✅

---

## 🔧 Required Primitive Enhancements

If these aren't done yet, add them during migration:

1. **Icon primitive `id` prop support:**

```typescript
// types.ts
export interface IconProps {
  // ... existing props
  id?: string;
}

// Icon.web.tsx
export function Icon({ ..., id }: IconWebProps) {
  return <FontAwesomeIcon {...otherProps} id={id} />;
}
```

2. **ColorSwatch color handling:**

```typescript
// Use direct color names, not hex values
<ColorSwatch color="blue" />  // ✅ Correct
<ColorSwatch color="#3b82f6" />  // ❌ Won't work
```

---

## 🚀 Success Criteria

- [ ] All form elements use primitives (except file uploads)
- [ ] All icons use Icon primitive
- [ ] 80%+ tooltips use Tooltip primitive
- [ ] Zero FontAwesome imports remaining
- [ ] Modal uses Modal primitive container
- [ ] File upload functionality preserved (if applicable)

**Ready for cross-platform:** Modal will work seamlessly in mobile app with zero changes.

---

**Updated:** 2025-07-28
