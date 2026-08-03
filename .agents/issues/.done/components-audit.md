---
type: task
title: "Cross-Platform Component Audit"
status: done
created: 2026-01-09
updated: 2025-07-29
---

# Cross-Platform Component Audit

## Current Status

**✅ Phase 1 Complete**: Infrastructure built and 25 components analyzed

- Interactive dashboard available at `/dev/audit`
- Categorization system validated with real data
- Template patterns identified for migration
- **See**: `.agents/tasks/done/mobile-dev-audit-phase1-complete.md` for full Phase 1 results

**🔄 Phase 2 In Progress**: Full component discovery and analysis

## Quick Reference

**Dashboard**: Visit `/dev/audit` for live component status
**Architecture Guide**: `.agents/tasks/todo/mobile-dev/components-shared-arch-masterplan.md`
**Categorization Rules**: See section below for detailed criteria

## Component Categorization Rules

**⚠️ CRITICAL**: Follow these rules exactly to avoid categorization errors.

## Phase 2: Full Component Discovery

### **Current Goal**: Expand audit to remaining ~50+ components in codebase

**Process**:

1. **Scan all components** in `src/components/` and subdirectories
2. **Apply categorization rules** (see below) to classify each component
3. **Analyze primitive usage** and identify raw HTML elements
4. **Detect business logic** patterns for extraction opportunities
5. **Update audit dashboard** with comprehensive data

### **"Shared" Components Criteria (Single component works on both platforms)**

**MUST meet ALL of these requirements:**

✅ **100% Primitive Usage**:

- **NO raw HTML elements** whatsoever (`<div>`, `<span>`, `<button>`, `<input>`, `<a>`, `<img>`, etc.)
- **ALL layout must use Flex primitives**: FlexColumn, FlexRow, FlexCenter, FlexBetween, Container
- **ALL interactive elements** must use primitives: Button, Input, Modal, Select, etc.
- **ALL text must use Text primitive on native** (on web, use plain HTML + CSS typography classes)

✅ **NO Web-Specific Code**:

- **NO Tailwind classes** (React Native doesn't support them)
- **NO raw CSS classes** or inline styles
- **NO web-specific APIs** (DOM manipulation, localStorage without abstraction)
- **NO third-party web libraries** (unless they have React Native equivalents)

✅ **Platform-Agnostic Logic**:

- **Business logic works identically** on both platforms
- **NO platform-specific interaction patterns** (hover states, drag/drop)
- **Data handling is identical** on both platforms

**Examples**: Components that use only primitives with shared business logic

### **"Platform Specific" Components Criteria (Shared logic, different UI)**

**Characteristics**:

- **Shared business logic** can be extracted to hooks
- **Different UI layouts** needed for optimal UX per platform
- **Different interaction patterns**: hover vs touch, drag vs swipe, sidebar vs tabs
- **Platform-specific features**: drag/drop (web), gestures (mobile), navigation patterns

**Implementation Pattern**:

- `Component.web.tsx` - Desktop-optimized UI
- `Component.native.tsx` - Mobile-optimized UI
- `useComponentLogic.ts` - Shared business logic hook

**Examples**:

- Navigation with drag/drop (web) vs touch navigation (mobile)
- Complex modals with sidebar (web) vs tabs (mobile)
- Animations using CSS (web) vs React Native Animated (mobile)

### **"Complex Refactor" Components Criteria (Need breakdown first)**

**Characteristics**:

- **Large components** (typically 200+ lines)
- **Multiple responsibilities** mixed in one component
- **Hard to categorize** as shared vs platform-specific due to complexity
- **Mix UI and business logic** extensively

**Required Action**: Break down into smaller components first, then categorize each piece

**Examples**: Channel.tsx (800+ lines), Message.tsx with many features

### **Primitive Usage Assessment Rules**

**`primitives: "done"`** - Component uses ONLY primitives:

- ✅ Zero raw HTML elements
- ✅ All layout uses Flex primitives
- ✅ All interactions use primitives
- ✅ Ready for primitive categorization

**`primitives: "todo"`** - Component uses ANY raw HTML:

- ❌ ANY `<div>`, `<span>`, `<button>`, `<input>`, `<a>`, `<img>`, etc.
- ❌ ANY Tailwind classes or CSS classes
- ❌ ANY web-specific styling or APIs

**`primitives: "unknown"`** - Needs code inspection to determine

### **Native Readiness Assessment Rules**

**`native: "ready"`** - Component can work on React Native:

- ✅ `primitives: "done"` (100% primitives)
- ✅ No Tailwind classes or web-specific CSS
- ✅ No web-specific APIs or libraries
- ✅ Platform-agnostic business logic

**`native: "todo"`** - Component needs work for React Native:

- ❌ Uses any raw HTML elements
- ❌ Uses Tailwind classes or web CSS
- ❌ Uses web-specific APIs
- ❌ Has platform-specific code that needs extraction

### **Common Categorization Mistakes to Avoid**

❌ **Assuming Flexbox = Ready**: Just because a component uses flexbox layout doesn't mean it's ready - it must use FlexColumn/FlexRow primitives, not `<div className="flex">`

❌ **Partial Primitive Usage = Done**: If a component uses some primitives (Button, Icon) but still has raw `<div>` elements, it's `primitives: "todo"`

❌ **Simple = Shared**: Simple components can still be platform-specific if they use animations, hover states, or web-specific features

❌ **Modal = Automatic**: Modals aren't automatically shared just because Modal primitive exists - the content must also be 100% primitives

### **Logic Extraction Guidelines for Shared Components**

**Extract to Hooks When:**

- Logic is >10 lines
- Has multiple useState/useEffect calls
- Makes API calls or external data fetching
- Has complex business rules or validation
- Could be reused elsewhere in the app

**Keep in Component When:**

- Simple event handlers (`onClick`, `onChange`)
- Pure UI state (show/hide, toggle visibility)
- No external dependencies
- <5 lines of logic
- Simple form validation

**Examples:**

- **Extract**: `useSearchSuggestions` (API calls), `useAccentColor` (localStorage + theme)
- **Keep**: Close button onClick, simple form toggles

### **Quick Categorization Checklist**

For each component, ask:

1. **Any raw HTML?** → If yes: `primitives: "todo"`
2. **Any Tailwind classes?** → If yes: `native: "todo"`
3. **Any web-specific APIs?** → If yes: needs platform-specific handling
4. **Complex/large (200+ lines)?** → Consider "complex_refactor"
5. **Different UX needed per platform?** → "platform_specific"
6. **100% primitives + platform-agnostic?** → "shared"
7. **Complex business logic?** → `logic_needs: "extract"`, else `logic_needs: "keep"`

#### **2.2.2 Special Case: Modal Components**

**Modal-to-Drawer Architecture**: The Modal primitive automatically transforms:

- **Web** (`Modal.web.tsx`): Traditional centered modal with backdrop
- **Native** (`Modal.native.tsx`): Native bottom drawer implementation

**Modal Categorization Rules**:

- **Shared Modals**: Simple content that works well in both modal and drawer formats
  - Forms, confirmations, simple settings
  - Must still meet ALL "shared" criteria (100% primitives, no Tailwind, etc.)
  - Example: KickUserModal - confirmation dialog works identically
- **Platform-Specific Modals**: Complex layouts needing different arrangements
  - Desktop: Side-by-side layouts, wide content, sidebar navigation
  - Mobile: Stacked layouts, full-width, tab navigation
  - Example: UserSettingsModal - desktop sidebar vs mobile tabs

**Also identify component types**:

- **Primitive**: Already our new primitive components (skip these)
- **Simple**: Basic UI components, minimal logic
- **Business**: Components with significant business logic
- **Layout**: Components focused on layout/navigation
- **Complex**: Large components mixing multiple concerns

#### **2.3 Usage Detection**

**Critical for Migration Planning**: Identify unused components that can be deleted instead of migrated.

**Usage Status Values**:

- **`yes`** - Component is actively imported and used in the codebase
- **`no`** - Component exists but is not referenced anywhere (dead code)
- **`unknown`** - Usage status needs to be determined

**Detection Method**:

1. **Search for imports**: `grep -r "import.*ComponentName" src/`
2. **Search for direct usage**: `grep -r "ComponentName" src/ --exclude-dir=node_modules`
3. **Check export patterns**: Look for re-exports in index files
4. **Verify actual usage**: Ensure imports are actually used, not just imported

**Benefits**:

- **Reduce migration scope**: Skip unused components entirely
- **Clean up codebase**: Identify dead code for deletion
- **Prioritize work**: Focus on components that actually matter
- **Accurate estimates**: Get realistic migration effort calculations

## Migration Workflow

### **Phase 3: Component Implementation**

1. **Migrate "shared" components**: Replace raw HTML with primitives
2. **Extract platform-specific logic**: Create shared hooks for business logic
3. **Implement native versions**: Build .native.tsx for platform-specific components
4. **Refactor complex components**: Break down large components first

### **Priority Order**

**High Priority**: Components with no dependencies, frequently used, simple primitive replacements
**Medium Priority**: Moderate complexity, clear logic extraction opportunities
**Low Priority**: Complex refactoring, unclear strategy, edge cases

## Current Progress

**25 Components Analyzed** | **~50+ Remaining**

### **Key Metrics**

- **24% primitive adoption** already achieved (6/25 components)
- **52% shared component potential** (13/25 components)
- **100% usage verification** - all analyzed components are actively used

### **Template Examples Available**

- **Shared**: SearchBar, KickUserModal, AccentColorSwitcher
- **Platform-Specific**: UserSettingsModal, Loading, SpaceButton
- **Complex Refactor**: Channel.tsx, Layout.tsx, AppWithSearch.tsx

### **Next Actions**

1. **Continue component discovery** to remaining codebase
2. **Apply categorization rules** consistently
3. **Prioritize migration work** based on audit data

---

---

_Last updated: 2025-07-29_
