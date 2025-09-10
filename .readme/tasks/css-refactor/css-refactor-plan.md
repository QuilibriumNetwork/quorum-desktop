# CSS Refactor Plan - Claude Code Execution Strategy


## 📋 Document Information

**Last Updated:** January 19, 2025  
**Status:** Updated based on latest CSS inventory analysis  
**Context:** This plan reflects the current codebase state including the successful Button.scss conversion to Tailwind pattern.

## 🎯 Objective Re-evaluation

### **Is This a Good Objective?**

**✅ YES - The objective is sound and achievable with proper execution**

**Verdict:** Proceed with phased approach - the current system is sophisticated but can be systematically improved with Tailwind utilities while preserving all functionality.

**Important Context:** Mobile development may proceed in parallel or before this CSS refactor. The Tailwind conversion will enhance but not block mobile primitive development.

### **Original Objective:**

Migrate the existing SCSS-based styling system (using semantic class names and raw CSS) into a unified Tailwind-based system using `@apply`, Tailwind utility classes, and theme tokens. This refactor will preserve semantic class naming, reduce custom CSS, and align all design logic with the existing Tailwind configuration and design tokens.

### 🧱 Project Context

- The project uses SCSS for styling, with both shared and component-scoped `.scss` files.
- Tailwind CSS is already configured and includes semantic tokens (colors, backgrounds, borders, etc.) and a safelist for dynamic classes.
- There are already some semantic classes defined using Tailwind.
- Many raw SCSS files still use traditional CSS declarations (`display: flex`, `margin`, etc.) instead of `@apply`.

**Reference Documents:**

- Full analysis of the current situation: `.readme/tasks/todo/css-refactor/analysis.md`
- **Updated inventory** of current CSS styles: `.readme/tasks/todo/css-refactor/css-inventory.md` (January 19, 2025)
- Mobile development plan context: `.readme/tasks/todo/mobile-dev/mobile-dev-plan.md`

---

## 📊 Analysis Context & Critical Insights

### **From analysis.md - Key Risk Assessment:**

> **Complexity Score: 8/10** - This is a **high-complexity refactor** that requires careful planning and execution. The current system is more sophisticated than initially assessed, but the migration is still valuable and achievable with the right approach.

### **Critical Success Factors (from analysis.md):**

1. **Comprehensive testing strategy** before starting
2. **Screenshot comparison system** for visual regression testing
3. **Component-by-component approach** with rollback capability
4. **Preserve all semantic class names** and functionality
5. **Maintain build pipeline stability**

### **HIGH RISK AREAS to be extremely careful with:**

1. **Complex Responsive Behavior** - Sophisticated media query implementations
2. **Advanced Animation System** - Keyframe animations (`flash-highlight`, `createBox`, etc.)
3. **Sophisticated Modal System** - `_modal_common.scss` contains 200+ lines of complex modal logic
4. **Theme System Integration** - Extensive use of CSS custom properties for theming

### **What NOT to do (from analysis.md):**

1. **Don't migrate everything at once** - too risky given complexity
2. **Don't convert all SCSS to pure CSS** - would lose valuable nesting and organization
3. **Don't start with high-risk files** like `_modal_common.scss`

---

## 🗂️ CSS Inventory Context & Selector Classifications

### **From css-inventory.md - Updated Classification Breakdown (January 19, 2025):**

- **~135 @apply-convertible selectors** (30%) - **Phase 1 targets**
- **~200 theme-token selectors** (44%) - **Phase 2 integration**
- **~65 custom-logic selectors** (14%) - **Preserve as-is**
- **~40 responsive selectors** (9%) - **Phase 3 conversion**
- **~10 semantic-class selectors** (2%) - **Phase 4 optimization**

**Total:** ~450 CSS selectors across 40 SCSS files

### **Key Recent Changes:**

- **Button.scss successfully converted** - Now serves as reference pattern for `@apply` usage
- **Search components identified** - Clean, minimal CSS perfect for Phase 1 conversion
- **Mobile drawer system documented** - Well-architected modern components to preserve

### **Build Pipeline Reality Check (from analysis.md):**

- **Current setup works well** with Vite handling SCSS compilation
- **`@apply` in SCSS is supported** but requires careful order management
- **PostCSS processes Tailwind** after SCSS compilation - this is fine

---

## 🧩 Migration Philosophy & Technical Approach

### **Core Principles:**

- 🟢 **Preserve semantic class names** (e.g. `.modal-body`, `.btn-primary`)
- ⚪ **Replace raw CSS declarations with `@apply`** using Tailwind classes
- 🔴 **Avoid writing new raw CSS unless absolutely necessary**
- 🟡 **Keep SCSS files** - Use `@apply` within existing .scss files
- 🔵 **Preserve all CSS custom properties** - Don't break theme system

### **Technical Implementation Notes:**

#### **SCSS + @apply Strategy:**

When converting a raw SCSS file to use Tailwind's utility classes via `@apply`, we're keeping SCSS files and using `@apply` within them:

**Pros:**

- Retain SCSS features like nesting, variables, and `@extend` for modular, maintainable styles
- Combine Tailwind utilities with SCSS logic for flexibility
- Preserve existing file structure and imports

**Cons:**

- Requires careful build process: SCSS must be compiled _before_ Tailwind's PostCSS processes `@apply`
- Debugging can be harder due to interplay of two preprocessors
- Team members need to understand both systems

#### **Example Conversion Pattern:**

```scss
// Before
.modal-body {
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  text-align: center;
  background-color: var(--color-bg-chat);
  color: var(--color-text-main);

  @media (max-width: 768px) {
    gap: 16px;
  }
}

// After
.modal-body {
  @apply flex justify-between flex-col text-center;
  background-color: var(--color-bg-chat); // Preserve theme colors
  color: var(--color-text-main);

  @screen max-md {
    @apply gap-4;
  }
}
```

#### **Conversion Guidelines:**

- Use `@screen sm`, `md`, `lg`, etc. instead of raw media queries
- Map spacing to closest Tailwind values (`gap-4`, `mx-4`, etc.)
- For `max-width: 500px`, use `max-w-[500px]` (Tailwind allows arbitrary values)
- **Always preserve CSS custom properties** for theming

---

## 🚀 Execution Strategy for Claude Code

### **Phase Structure:**

- Each phase has specific subtasks with checkboxes
- User must manually test frontend after each phase completion
- Clear indication of which components/sections need testing
- Rollback capability at each checkpoint

---

## 📋 Phase 1: Foundation & Quick Wins (Low Risk)

**Target:** ~35 simplest @apply-convertible selectors (updated count)
**Components affected:** Search components, layout utilities, user status indicators, space layouts

### **Phase 1 Inventory Context (Updated):**

From css-inventory.md, targeting the **highest priority @apply-convertible selectors**:

**Priority 1: Search Components (Clean, minimal CSS)**

- `.search-bar` - Search input → `@apply flex items-center gap-2 p-2`
- `.search-results` - Results container → `@apply absolute w-full bg-white shadow-lg`
- `.search-result-item` - Result item → `@apply p-2 hover:bg-gray-100 cursor-pointer`
- `.global-search` - Global search layout → `@apply fixed inset-0 bg-black/50`

**Priority 2: Basic Layout Utilities**

- `.chat-input-container` - Container → `@apply flex items-center gap-2 p-2`
- `.chat-input-wrapper` - Wrapper → `@apply flex-1 relative`
- `.chat-messages` - Messages container → `@apply flex flex-col gap-2 overflow-y-auto`
- `.chat-message-content` - Message content → `@apply flex flex-col gap-1`

**Priority 3: User Status & Simple Components**

- `.user-status` - Status indicator → `@apply flex items-center gap-1`
- `.status-dot` - Status dot → `@apply w-2 h-2 rounded-full`
- `.user-avatar` - Avatar sizing → `@apply w-10 h-10 rounded-full`
- `.user-details` - Details layout → `@apply flex flex-col gap-1`

**Priority 4: Space Layout Components**

- `.space-header` - Header layout → `@apply flex justify-between items-center p-4`
- `.space-content` - Content area → `@apply flex-1 overflow-hidden`
- `.channel-header` - Header layout → `@apply flex justify-between items-center p-2`
- `.channel-messages` - Messages area → `@apply flex-1 overflow-y-auto`

### Phase 1 Subtasks:

#### 1.1 Setup and Preparation (this must be done manually by a humna dev)

- [ ] Create backup branch for Phase 1 (`css-refactor-phase-1`)
- [ ] Take screenshots of current state for comparison
- [ ] Document current build process functionality
- [ ] Test current application works correctly
- [ ] Run `yarn lint` and `yarn format` to ensure clean starting state

#### 1.2 Search Components Migration (Highest Priority)

- [ ] Migrate `src/components/search/SearchBar.scss` - `.search-bar` class
  - Convert layout to `@apply flex items-center gap-2 p-2;`
- [ ] Migrate `src/components/search/SearchResults.scss` - `.search-results` class
  - Convert positioning to `@apply absolute w-full shadow-lg;` (preserve theme background)
- [ ] Migrate `src/components/search/SearchResultItem.scss` - `.search-result-item` class
  - Convert layout to `@apply p-2 cursor-pointer;` (preserve theme hover)
- [ ] Migrate `src/components/search/GlobalSearch.scss` - `.global-search` class
  - Convert overlay to `@apply fixed inset-0;` (preserve theme background)
- [ ] Test search functionality across all components
- [ ] Visual regression test - verify search interface unchanged

#### 1.3 Basic Layout Utilities Migration

- [ ] Migrate `src/styles/_chat.scss` - `.chat-input-container` class
  - Convert layout to `@apply flex items-center gap-2 p-2;`
- [ ] Migrate `src/styles/_chat.scss` - `.chat-input-wrapper` class
  - Convert wrapper to `@apply flex-1 relative;`
- [ ] Migrate `src/styles/_chat.scss` - `.chat-messages` class
  - Convert messages container to `@apply flex flex-col gap-2 overflow-y-auto;`
- [ ] Migrate `src/styles/_chat.scss` - `.chat-message-content` class
  - Convert message content to `@apply flex flex-col gap-1;`
- [ ] Test chat layout and message display
- [ ] Visual regression test - verify chat interface unchanged

#### 1.4 User Status & Simple Components Migration

- [ ] Migrate `src/components/user/UserStatus.scss` - `.user-status` class
  - Convert layout to `@apply flex items-center gap-1;`
- [ ] Migrate `src/components/user/UserStatus.scss` - `.status-dot` class
  - Convert sizing to `@apply w-2 h-2 rounded-full;`
- [ ] Migrate `src/components/user/UserProfile.scss` - `.user-avatar` class
  - Convert sizing to `@apply w-10 h-10 rounded-full;`
- [ ] Migrate `src/components/user/UserProfile.scss` - `.user-details` class
  - Convert layout to `@apply flex flex-col gap-1;`
- [ ] Test user status indicators and profile components
- [ ] Visual regression test - verify user components unchanged

#### 1.5 Space Layout Components Migration

- [ ] Migrate `src/components/space/Space.scss` - `.space-header` class
  - Convert layout to `@apply flex justify-between items-center p-4;`
- [ ] Migrate `src/components/space/Space.scss` - `.space-content` class
  - Convert layout to `@apply flex-1 overflow-hidden;`
- [ ] Migrate `src/components/channel/Channel.scss` - `.channel-header` class
  - Convert layout to `@apply flex justify-between items-center p-2;`
- [ ] Migrate `src/components/channel/Channel.scss` - `.channel-messages` class
  - Convert layout to `@apply flex-1 overflow-y-auto;`
- [ ] Test space and channel layout components
- [ ] Visual regression test - verify space/channel interfaces unchanged

#### 1.6 Phase 1 Verification

- [ ] Run `yarn lint` and `yarn format` - ensure no errors
- [ ] Run build process - verify no build errors
- [ ] Test all migrated components work correctly
- [ ] Compare screenshots - verify no visual regressions
- [ ] Document Phase 1 completion and patterns established
- [ ] Create git commit with Phase 1 completion

### 🧪 Phase 1 Testing Requirements for User:

**Components to test manually:**

- [ ] **Search interface** - Test search bar, results display, result item interactions, global search overlay
- [ ] **Chat interface** - Test chat input container, message layout, message content display
- [ ] **User components** - Test user status indicators, status dots, user avatars, user details layout
- [ ] **Space/Channel layouts** - Test space headers, content areas, channel headers, message areas
- [ ] **Theme switching** - Verify all converted components work in light/dark mode + all 6 accent colors
- [ ] **Responsive behavior** - Test converted components on mobile, tablet, desktop breakpoints

**Specific app sections to test:**

- **Global search functionality** - Search bar, results, global search modal
- **Chat interface and messaging** - Input areas, message display, content layout
- **User profile areas** - Status indicators, avatars, user details
- **Space management interface** - Headers, content areas, navigation
- **Channel interface** - Headers, message areas, layout consistency

---

---

## 🎯 Reference Success Pattern: Button.scss Conversion

**Already Completed:** `src/components/Button.scss` has been successfully converted to Tailwind using the `@apply` pattern with semantic classes. This serves as the **proven reference pattern** for all future conversions.

**Key learnings from Button.scss conversion:**

- ✅ **Semantic class names preserved** (`.btn-primary`, `.btn-secondary`, etc.)
- ✅ **Theme colors preserved** using CSS custom properties
- ✅ **@apply usage works perfectly** for layout/spacing properties
- ✅ **SCSS placeholder pattern** (`%btn-base`) provides efficient shared styles
- ✅ **No functionality regressions** - all button variants work identically

**Mobile Development Context:**
This refactor can proceed in parallel with or after mobile development. The Tailwind conversion will enhance but not block mobile primitive development, as both raw CSS and Tailwind-converted classes map equally well to React Native StyleSheet patterns.

---

## 📋 Phase 2: Theme Integration (Medium Risk)

**Target:** ~65 theme-token selectors (subset of ~200)
**Components affected:** Input components, message layouts, navigation elements, modal utilities

### **Phase 2 Inventory Context (Updated):**

From css-inventory.md, targeting theme-token selectors **following Button.scss pattern** while preserving CSS custom properties:

**Priority 1: Input Components (Following Button Pattern)**

- `.input-base` - Base input → `@apply px-3 py-2 border rounded-md` (preserve theme background/colors)
- `.input-error` - Error state → `@apply border-red-500`
- `.input-disabled` - Disabled state → `@apply opacity-50 cursor-not-allowed`

**Priority 2: Message Layout Components**

- `.message-content` - Content layout → `@apply flex flex-col gap-1` (preserve theme background)
- `.message-actions` - Actions container → `@apply flex gap-1 opacity-0 group-hover:opacity-100`
- `.message-actions-grid` - Action grid → `@apply grid grid-cols-3 gap-2`

**Priority 3: Navigation Layout Elements**

- `.nav-item` - Nav item → `@apply flex items-center gap-2 p-2` (preserve theme background/colors)
- `.space-button-icon` - Icon sizing → `@apply w-6 h-6`

**Priority 4: Modal Layout Utilities**

- `.modal-container` - Layout container → `@apply fixed inset-0 flex items-center justify-center` (preserve theme backdrop)
- `.modal-header` - Header layout → `@apply flex justify-between items-center p-4`
- `.modal-body` - Body layout → `@apply flex flex-col gap-4 p-4`
- `.modal-footer` - Footer layout → `@apply flex gap-2 p-4`

### **Critical Theme Integration Notes:**

- **NEVER remove CSS custom properties** like `var(--color-text-main)`
- **Only convert layout/spacing properties** to @apply
- **Preserve all theming functionality** - this is critical for the 6 accent colors + light/dark modes
- **Test across ALL theme combinations** after each change

### Phase 2 Subtasks:

#### 2.1 Setup and Preparation

- [ ] Create backup branch for Phase 2 (`css-refactor-phase-2`)
- [ ] Take screenshots of current state across all themes
- [ ] Document theme switching functionality
- [ ] Test all 6 accent color themes work correctly (blue, purple, fuchsia, orange, green, yellow)
- [ ] Test light/dark mode switching

#### 2.2 Base Elements Migration

- [ ] Migrate `src/styles/_base.scss` - `#root` class (preserve theme vars)
  - Convert layout properties to @apply, preserve all color/theme properties
- [ ] Migrate `src/styles/_base.scss` - `h1, h2, h3, h4, h5, h6` classes (preserve theme colors)
  - Convert typography spacing to @apply, preserve `color: var(--color-text-strong)`
- [ ] Migrate `src/styles/_base.scss` - `p` class (preserve theme colors)
  - Convert spacing to @apply, preserve `color: var(--color-text-main)`
- [ ] Migrate `src/styles/_base.scss` - `a` class (preserve theme colors)
  - Convert layout to @apply, preserve `color: var(--color-text-main)`
- [ ] Test base typography and root layout
- [ ] Visual regression test - verify base elements unchanged across themes

#### 2.3 Message Components Migration

- [ ] Migrate `src/components/message/Message.scss` - `.message-actions` class
  - Convert layout properties to @apply, preserve any theme colors
- [ ] Migrate `src/components/message/Message.scss` - enhance other classes with @apply where safe
  - Only convert layout/spacing, never color properties
- [ ] Test message display and actions functionality
- [ ] Visual regression test - verify message components work in all themes

#### 2.4 Navigation Elements Migration

- [ ] Migrate `src/components/navbar/NavMenu.scss` - layout utilities (preserve theme colors)
  - Convert layout properties to @apply, preserve all color variables
- [ ] Migrate `src/components/navbar/SpaceIcon.scss` - `.space-icon-image` class
  - Convert sizing to @apply utilities
- [ ] Test navigation menu and space icons
- [ ] Visual regression test - verify navigation unchanged across themes

#### 2.5 Direct Message Components Migration

- [ ] Migrate `src/components/direct/DirectMessage.scss` - `.direct-message-content` class
  - Convert layout to @apply, preserve theme colors
- [ ] Migrate `src/components/direct/DirectMessageContact.scss` - `.direct-message-contact-avatar` class
  - Convert sizing to @apply utilities
- [ ] Test direct message layout and contact display
- [ ] Visual regression test - verify direct messaging unchanged

#### 2.6 Modal Layout Utilities Migration

- [ ] Migrate `src/styles/_modal_common.scss` - `.modal-container` class (preserve theme colors)
  - Convert layout to @apply, preserve any theme background/color properties
- [ ] Migrate `src/styles/_modal_common.scss` - `.modal-body` class (preserve theme colors)
  - Convert layout to @apply, preserve theme background/text colors
- [ ] Migrate `src/styles/_modal_common.scss` - `.modal-footer` class (preserve theme colors)
  - Convert layout to @apply, preserve theme colors
- [ ] Test modal layout and functionality
- [ ] Visual regression test - verify modals work correctly

#### 2.7 Phase 2 Verification

- [ ] Test all 6 accent color themes (blue, purple, fuchsia, orange, green, yellow)
- [ ] Test light/dark mode switching
- [ ] Run `yarn lint` and `yarn format` - ensure no errors
- [ ] Run build process - verify no build errors
- [ ] Compare screenshots across all themes - verify no visual regressions
- [ ] Document Phase 2 completion and theme integration patterns
- [ ] Create git commit with Phase 2 completion

### 🧪 Phase 2 Testing Requirements for User:

**Components to test manually across ALL themes:**

- [ ] **Base typography** - Test headings, paragraphs, links in all accent colors
- [ ] **Message components** - Test message display, actions, sender info
- [ ] **Navigation elements** - Test nav menu, space icons, space buttons
- [ ] **Direct messaging** - Test DM layout, contact avatars, message content
- [ ] **Modal dialogs** - Test modal containers, body content, footer actions
- [ ] **Theme switching** - Switch between all 6 accent colors + light/dark modes
- [ ] **Root layout** - Verify main app container works in all themes

**Specific app sections to test:**

- Main navigation sidebar
- Chat/messaging interface
- Direct message conversations
- Modal dialogs (create space, join space, settings)
- User profile areas
- Space management interface

**Theme testing matrix:**

- Light mode: Blue, Purple, Fuchsia, Orange, Green, Yellow
- Dark mode: Blue, Purple, Fuchsia, Orange, Green, Yellow
- Total: 12 theme combinations to test

---

## 📋 Phase 3: Responsive Conversion (Medium-High Risk)

**Target:** 15 responsive selectors (subset of 38)
**Components affected:** Modal system, navigation, layout containers

### **Phase 3 Inventory Context:**

From css-inventory.md, targeting these responsive selectors:

- Modal responsive system: `.modal-2-column`, `.modal-mobile-nav`
- Container responsive patterns
- Navigation responsive behavior
- Component responsive utilities

### **Critical Responsive Notes:**

- **Map breakpoints carefully** - Ensure Tailwind breakpoints match current behavior
- **Test across devices** - Mobile, tablet, desktop breakpoints
- **Preserve mobile-first approach** - Current system is mobile-first
- **Use @screen directives** - Convert media queries to `@screen md:` etc.

### Phase 3 Subtasks:

#### 3.1 Setup and Preparation

- [ ] Create backup branch for Phase 3 (`css-refactor-phase-3`)
- [ ] Take screenshots across mobile, tablet, desktop breakpoints
- [ ] Document current responsive breakpoints and behavior
- [ ] Test current responsive functionality across devices
- [ ] Verify Tailwind breakpoints match current media queries

#### 3.2 Modal Responsive System Migration

- [ ] Migrate `src/styles/_modal_common.scss` - `.modal-2-column` responsive layout
  - Convert media queries to `@screen md:` and `@screen lg:` directives
- [ ] Migrate `src/styles/_modal_common.scss` - `.modal-mobile-nav` responsive behavior
  - Convert mobile navigation media queries to Tailwind responsive utilities
- [ ] Test modal responsive behavior across breakpoints
- [ ] Visual regression test - verify modal layout responsive across devices

#### 3.3 Container Responsive Migration

- [ ] Migrate `src/components/Container.scss` - `.container` responsive max-width
  - Convert responsive max-width to Tailwind responsive utilities
- [ ] Test container responsive behavior
- [ ] Visual regression test - verify container responsive layout

#### 3.4 Navigation Responsive Migration

- [ ] Migrate navigation responsive patterns from identified files
  - Convert navigation media queries to Tailwind responsive utilities
- [ ] Test navigation responsive behavior
- [ ] Visual regression test - verify navigation responsive layout

#### 3.5 Component Responsive Utilities Migration

- [ ] Migrate remaining responsive utilities from component files
  - Convert component media queries to Tailwind responsive utilities
- [ ] Test component responsive behavior
- [ ] Visual regression test - verify component responsive layout

#### 3.6 Phase 3 Verification

- [ ] Test responsive behavior on mobile (320px-768px)
- [ ] Test responsive behavior on tablet (768px-1024px)
- [ ] Test responsive behavior on desktop (1024px+)
- [ ] Run `yarn lint` and `yarn format` - ensure no errors
- [ ] Run build process - verify no build errors
- [ ] Compare screenshots across breakpoints - verify no responsive regressions
- [ ] Document Phase 3 completion and responsive patterns
- [ ] Create git commit with Phase 3 completion

### 🧪 Phase 3 Testing Requirements for User:

**Responsive breakpoints to test:**

- [ ] **Mobile (320px-480px)** - Test all converted components
- [ ] **Mobile Large (480px-768px)** - Test all converted components
- [ ] **Tablet (768px-1024px)** - Test all converted components
- [ ] **Desktop (1024px+)** - Test all converted components

**Components to test across breakpoints:**

- [ ] **Modal dialogs** - Test 2-column layout, mobile navigation, responsive behavior
- [ ] **Main containers** - Test max-width constraints, responsive padding
- [ ] **Navigation** - Test mobile menu, responsive nav behavior
- [ ] **Layout components** - Test responsive grid, flex layouts

**Specific responsive behaviors to verify:**

- Modal 2-column layout switches to single column on mobile
- Mobile navigation menu appears/disappears at correct breakpoints
- Container max-width adjusts correctly across breakpoints
- All interactive elements remain accessible on touch devices

---

## 📋 Phase 4: Semantic Class Optimization (Low Risk)

**Target:** 9 semantic-class selectors
**Components affected:** Utility classes, background utilities, semantic helpers

### **Phase 4 Inventory Context:**

From css-inventory.md, targeting these semantic-class selectors:

- Typography: `.small-caps`, `.error-label`
- Layout: `.invisible-dismissal`, `.card`
- Background: `.bg-mobile-overlay`, `.bg-mobile-sidebar`, `.bg-radial--accent-noise`

### Phase 4 Subtasks:

#### 4.1 Setup and Preparation

- [ ] Create backup branch for Phase 4 (`css-refactor-phase-4`)
- [ ] Take screenshots of current semantic class usage
- [ ] Document current semantic class functionality
- [ ] Test current semantic classes work correctly

#### 4.2 Typography Semantic Classes Migration

- [ ] Optimize `src/styles/_base.scss` - `.small-caps` class with @apply
  - Convert to `@apply text-xs uppercase tracking-wide;` or similar
- [ ] Optimize `src/styles/_base.scss` - `.error-label` class with @apply
  - Convert layout/spacing to @apply, preserve error colors
- [ ] Test typography semantic classes functionality
- [ ] Visual regression test - verify typography utilities unchanged

#### 4.3 Layout Semantic Classes Migration

- [ ] Optimize `src/styles/_base.scss` - `.invisible-dismissal` class with @apply
  - Convert positioning/sizing to @apply utilities
- [ ] Optimize `src/styles/_base.scss` - `.card` class with @apply
  - Convert layout/spacing to @apply, preserve theme background colors
- [ ] Test layout semantic classes functionality
- [ ] Visual regression test - verify layout utilities unchanged

#### 4.4 Background Semantic Classes Migration

- [ ] Optimize `src/styles/_components.scss` - `.bg-mobile-overlay` class with @apply
  - Convert positioning/sizing to @apply, preserve background colors
- [ ] Optimize `src/styles/_components.scss` - `.bg-mobile-sidebar` class with @apply
  - Convert positioning/sizing to @apply, preserve background colors
- [ ] Optimize `src/styles/_components.scss` - `.bg-radial--accent-noise` class with @apply
  - Convert positioning to @apply, preserve complex background patterns
- [ ] Test background semantic classes functionality
- [ ] Visual regression test - verify background utilities unchanged

#### 4.5 Phase 4 Verification

- [ ] Test all semantic classes work correctly
- [ ] Run `yarn lint` and `yarn format` - ensure no errors
- [ ] Run build process - verify no build errors
- [ ] Compare screenshots - verify no visual regressions
- [ ] Document Phase 4 completion and semantic class patterns
- [ ] Create git commit with Phase 4 completion

### 🧪 Phase 4 Testing Requirements for User:

**Semantic classes to test:**

- [ ] **Typography utilities** - Test small-caps text, error labels
- [ ] **Layout utilities** - Test invisible dismissal overlays, card components
- [ ] **Background utilities** - Test mobile overlays, sidebar backgrounds, accent noise patterns
- [ ] **Cross-component usage** - Verify semantic classes work across all components that use them

**Specific app sections to test:**

- Form validation (error labels)
- Card-based layouts
- Mobile interface (overlays, sidebar backgrounds)
- Accent-based background patterns
- Typography emphasis (small-caps usage)

---

## 📋 Phase 5: Documentation & Cleanup (Low Risk)

**Target:** Documentation, cleanup, performance verification
**Components affected:** Development documentation, build process

### Phase 5 Subtasks:

#### 5.1 Documentation Creation

- [ ] Create `conversion-patterns.md` - Document established @apply patterns and best practices
- [ ] Consolidate `testing-results.md` - Document all visual regression test results from all phases
- [ ] Create `migration-guide.md` - Comprehensive guide for future Tailwind/SCSS development
- [ ] Update `CLAUDE.md` - Document new styling approach and patterns
- [ ] Create `performance-analysis.md` - Document bundle size and performance metrics

#### 5.2 Performance Verification

- [ ] Run build process - measure bundle size changes
- [ ] Test application performance - verify no runtime regressions
- [ ] Document performance metrics comparison
- [ ] Verify PurgeCSS still works correctly

#### 5.3 Code Cleanup

- [ ] Remove any unused CSS after migration
- [ ] Clean up commented-out code
- [ ] Ensure consistent formatting across all modified files
- [ ] Update any documentation references to old patterns

#### 5.4 Final Verification

- [ ] Run complete test suite across all components
- [ ] Verify all phases work together correctly
- [ ] Test application end-to-end functionality
- [ ] Document final refactor completion

### 🧪 Phase 5 Testing Requirements for User:

**Final comprehensive testing:**

- [ ] **Full application test** - Test all features across all themes and breakpoints
- [ ] **Performance verification** - Verify app feels as fast as before
- [ ] **Build verification** - Confirm build process works correctly
- [ ] **Documentation review** - Review all new documentation for accuracy

---

## 🚨 Critical Notes for Claude Code Execution

### **Before Starting Each Phase:**

1. **Always create a backup branch** - Name it `css-refactor-phase-X`
2. **Take screenshots** - Use appropriate tools for before/after comparison
3. **Test current functionality** - Ensure starting point works correctly
4. **Run lint and format** - Ensure clean starting state

### **During Each Phase:**

1. **Work on one subtask at a time** - Check off each completed subtask
2. **Test after each subtask** - Don't accumulate untested changes
3. **Use @apply within existing SCSS files** - Don't convert to pure CSS
4. **Preserve all CSS custom properties** - Don't break theme system
5. **Document any issues encountered** - Note problems for future reference

### **After Each Phase:**

1. **Complete all subtasks** - Ensure all checkboxes are checked
2. **Run comprehensive tests** - Verify phase completion
3. **Create git commit** - Document phase completion
4. **Wait for user approval** - Don't proceed until user tests manually

### **Emergency Rollback Procedure:**

If any phase causes issues:

1. **Stop immediately** - Don't proceed with broken functionality
2. **Switch to backup branch** - Use the phase backup branch
3. **Document the issue** - Note what went wrong
4. **Discuss with user** - Determine how to proceed

### **Success Criteria for Each Phase:**

- [ ] All subtasks completed and checked off
- [ ] No visual regressions in screenshots
- [ ] No functional regressions in testing
- [ ] Clean lint and format results
- [ ] Successful build process
- [ ] User approval after manual testing

---

## 🎯 Final Success Metrics

### **Must-Have Outcomes:**

- [ ] **Zero visual regressions** - All screenshots match across themes/breakpoints
- [ ] **Zero functional regressions** - All interactions work identically
- [ ] **Maintained performance** - No significant bundle size increase
- [ ] **Improved maintainability** - Reduced CSS duplication, clearer patterns
- [ ] **Complete documentation** - Clear guide for future development
- [ ] **Mobile compatibility maintained** - Tailwind classes map cleanly to React Native primitives

### **Project Completion Checklist:**

- [ ] All 5 phases completed successfully (or paused for mobile development)
- [ ] All subtasks checked off for completed phases
- [ ] User manual testing completed for all completed phases
- [ ] Documentation created and reviewed
- [ ] Performance verified and documented
- [ ] Migration guide created for future development
- [ ] **Mobile development compatibility verified** (if proceeding in parallel)

**Total estimated timeline:** 4-6 weeks with user testing checkpoints (flexible based on mobile development priorities)

---

## 🚨 Important Note: Mobile Development Priority

**This CSS refactor can be paused or run in parallel with mobile development.** The current CSS state (hybrid Tailwind + raw CSS) is perfectly suitable for mobile primitive development. Key considerations:

### **If Mobile Development Proceeds First:**

- ✅ **Current CSS works fine** for React Native conversion
- ✅ **Semantic class names** provide perfect abstraction layer
- ✅ **Button.scss pattern** already established for future reference
- ✅ **No blocking dependencies** - mobile primitives work with any CSS implementation

### **If CSS Refactor Proceeds First:**

- ✅ **Enhanced mobile development** with cleaner Tailwind patterns
- ✅ **Better design token consistency** across platforms
- ✅ **Proven conversion patterns** for mobile primitive styling

### **Recommended Approach:**

**Start mobile development with current CSS state. Complete CSS refactor later with mobile learnings for better-informed Tailwind patterns.**

---

## 📐 Naming & Convention Guidelines

### **Semantic Class Guidelines:**

- Use `kebab-case` for semantic class names (`.modal-footer`, `.chat-input`, `.btn-primary`)
- Keep semantic classes grouped in `src/styles/*.scss` files
- Avoid redefining Tailwind tokens in SCSS
- Always map to Tailwind values (spacing, color, radius) where possible

### **@apply Usage Guidelines:**

- Use `@apply` for layout, spacing, sizing, and positioning
- Preserve CSS custom properties for colors and theming
- Use `@screen md:` instead of raw media queries
- Group related @apply statements logically

### **File Organization:**

- Preserve current SCSS file structure
- Keep component-specific SCSS files
- Maintain existing import patterns
- Don't create new CSS files unless necessary

---

## ⚙️ Tailwind Config Alignment

The existing `tailwind.config.js` already includes:

- Semantic tokens for color, surface, text, and borders
- A `safelist` for dynamic classes
- Responsive utility support with `@screen`
- Custom theme extensions for project-specific needs

**No config changes needed** - the existing configuration supports our migration strategy.

---

## 📁 Files to Deliver

### **Ongoing Deliverables (Updated throughout phases):**

- ✅ `css-inventory.md` - Complete selector analysis
- ✅ `analysis.md` - Detailed current state assessment
- 🔄 `refactor-status.md` - Progress tracking (updated after each phase)
- 🔄 `testing-results.md` - Visual regression test results (consolidated from all phases)

### **Phase 5 Final Deliverables:**

- 🔄 `conversion-patterns.md` - Best practices documentation and @apply patterns
- 🔄 `migration-guide.md` - Comprehensive guide for future Tailwind/SCSS development
- 🔄 `performance-analysis.md` - Bundle size and performance metrics analysis
- 🔄 Updated `CLAUDE.md` - New styling approach and patterns
- 🔄 Updated SCSS files with @apply integration (completed across all phases)

---

## ⚠️ CRITICAL WARNING: PasskeyModal Styles - Special Handling Required

**IMPORTANT ADDITION - January 22, 2025:**

The file `src/styles/_passkey-modal.scss` contains styles for PasskeyModal component imported from `@quilibrium/quilibrium-js-sdk-channels` package. **THIS FILE MUST BE HANDLED WITH EXTREME CARE** during CSS refactoring:

**DO NOT CONVERT TO TAILWIND:**

- This file contains ~30 CSS selectors for an external SDK component
- Originally created as pure CSS in SDK and copied here to avoid Tailwind purging issues
- Converting to Tailwind would break the modal styling completely
- File can be edited directly for immediate style changes but should not be migrated to `@apply` patterns

**Why it's in the main repo:**

- SDK uses pure CSS to avoid Tailwind dependency conflicts
- Main app imports these styles to ensure proper bundling
- Provides self-contained modal styling that works reliably

**Classification:** All selectors are **custom-logic** and must remain as raw CSS
**Impact on refactor:** -30 selectors from conversion targets, +30 to preserve-as-is list

This represents a **critical exception** to the Tailwind migration strategy and must be documented in all refactoring phases.

---

**Ready to begin Phase 1 when you give the go-ahead!**
