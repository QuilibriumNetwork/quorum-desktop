# CSS Refactor Plan - Claude Code Execution Strategy

## 🎯 Objective Re-evaluation

### **Is This a Good Objective?**
**✅ YES - The objective is sound and achievable with proper execution**

**Verdict:** Proceed with phased approach - the current system is sophisticated but can be systematically improved with Tailwind utilities while preserving all functionality.

### **Original Objective:**
Migrate the existing SCSS-based styling system (using semantic class names and raw CSS) into a unified Tailwind-based system using `@apply`, Tailwind utility classes, and theme tokens. This refactor will preserve semantic class naming, reduce custom CSS, and align all design logic with the existing Tailwind configuration and design tokens.

### 🧱 Project Context

- The project uses SCSS for styling, with both shared and component-scoped `.scss` files.
- Tailwind CSS is already configured and includes semantic tokens (colors, backgrounds, borders, etc.) and a safelist for dynamic classes.
- There are already some semantic classes defined using Tailwind.
- Many raw SCSS files still use traditional CSS declarations (`display: flex`, `margin`, etc.) instead of `@apply`.

**Reference Documents:**
- Full analysis of the current situation: `.claude/tasks/todo/css-refactor/analysis.md`
- Inventory of the current css styles: `.claude/tasks/todo/css-refactor/css-inventory.md`

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

### **From css-inventory.md - Classification Breakdown:**
- **127 @apply-convertible selectors** (33.5%) - **Phase 1 targets**
- **163 theme-token selectors** (43.0%) - **Phase 2 integration**
- **42 custom-logic selectors** (11.1%) - **Preserve as-is**
- **38 responsive selectors** (10.0%) - **Phase 3 conversion**
- **9 semantic-class selectors** (2.4%) - **Phase 4 optimization**

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
- Requires careful build process: SCSS must be compiled *before* Tailwind's PostCSS processes `@apply`
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
  background-color: var(--color-bg-chat);  // Preserve theme colors
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
**Target:** 20 simplest @apply-convertible selectors
**Components affected:** Container, basic layout utilities, simple button variants

### **Phase 1 Inventory Context:**
From css-inventory.md, targeting these @apply-convertible selectors:
- `.container`, `.container-fluid`, `.container-centered` - Basic layout containers
- `.button-small`, `.button-medium`, `.button-large` - Simple button size variants
- `.close-button-icon`, `.unknown-avatar-icon` - Basic icon sizing
- `.tooltip-trigger`, `.tooltip-top`, `.tooltip-bottom`, `.tooltip-left`, `.tooltip-right` - Tooltip positioning
- `.chat-input-container`, `.chat-input-wrapper`, `.chat-messages`, `.chat-message-content` - Chat layout

### Phase 1 Subtasks:

#### 1.1 Setup and Preparation (this must be done manually by a humna dev)
- [ ] Create backup branch for Phase 1 (`css-refactor-phase-1`)
- [ ] Take screenshots of current state for comparison
- [ ] Document current build process functionality
- [ ] Test current application works correctly
- [ ] Run `yarn lint` and `yarn format` to ensure clean starting state

#### 1.2 Container Components Migration
- [ ] Migrate `src/components/Container.scss` - `.container` class
  - Convert `max-width: 1200px; margin: 0 auto; padding: 0 16px;` to `@apply max-w-6xl mx-auto px-4;`
- [ ] Migrate `src/components/Container.scss` - `.container-fluid` class
  - Convert basic width/padding to `@apply w-full px-4;`
- [ ] Migrate `src/components/Container.scss` - `.container-centered` class
  - Convert centering logic to `@apply mx-auto text-center;`
- [ ] Test container components in isolation
- [ ] Visual regression test - compare before/after screenshots

#### 1.3 Basic Button Utilities Migration
- [ ] Migrate `src/components/Button.scss` - `.button-small` class
  - Convert size/padding to appropriate Tailwind utilities
- [ ] Migrate `src/components/Button.scss` - `.button-medium` class
  - Convert size/padding to appropriate Tailwind utilities
- [ ] Migrate `src/components/Button.scss` - `.button-large` class
  - Convert size/padding to appropriate Tailwind utilities
- [ ] Test button size variants functionality
- [ ] Visual regression test - verify button appearance unchanged

#### 1.4 Simple Layout Utilities Migration
- [ ] Migrate `src/components/CloseButton.scss` - `.close-button-icon` class
  - Convert icon sizing to `@apply w-4 h-4;` or similar
- [ ] Migrate `src/components/UnknownAvatar.scss` - `.unknown-avatar-icon` class
  - Convert icon sizing to appropriate Tailwind utilities
- [ ] Migrate `src/components/Tooltip.scss` - `.tooltip-trigger` class
  - Convert positioning to `@apply relative inline-block;` or similar
- [ ] Migrate `src/components/Tooltip.scss` - position classes (`.tooltip-top`, `.tooltip-bottom`, `.tooltip-left`, `.tooltip-right`)
  - Convert absolute positioning to Tailwind utilities
- [ ] Test tooltip positioning and close button functionality
- [ ] Visual regression test - verify layout utilities work correctly

#### 1.5 Chat Layout Utilities Migration
- [ ] Migrate `src/styles/_chat.scss` - `.chat-input-container` class
  - Convert flex layout to `@apply flex items-center;` or similar
- [ ] Migrate `src/styles/_chat.scss` - `.chat-input-wrapper` class
  - Convert wrapper layout to appropriate Tailwind utilities
- [ ] Migrate `src/styles/_chat.scss` - `.chat-messages` class
  - Convert messages container to flex utilities
- [ ] Migrate `src/styles/_chat.scss` - `.chat-message-content` class
  - Convert message content layout to Tailwind utilities
- [ ] Test chat layout and message display
- [ ] Visual regression test - verify chat interface unchanged

#### 1.6 Phase 1 Verification
- [ ] Run `yarn lint` and `yarn format` - ensure no errors
- [ ] Run build process - verify no build errors
- [ ] Test all migrated components work correctly
- [ ] Compare screenshots - verify no visual regressions
- [ ] Document Phase 1 completion and patterns established
- [ ] Create git commit with Phase 1 completion

### 🧪 Phase 1 Testing Requirements for User:
**Components to test manually:**
- [ ] **Container layouts** - Check main app container, centered content, fluid layouts
- [ ] **Button variants** - Test small, medium, large buttons across the app
- [ ] **Close buttons** - Test modal close buttons, dismissible elements
- [ ] **Avatar icons** - Check unknown user avatars display correctly
- [ ] **Tooltips** - Test tooltip positioning (top, bottom, left, right) on various elements
- [ ] **Chat interface** - Test chat input container, message layout, message content display
- [ ] **Theme switching** - Verify all components work in light/dark mode
- [ ] **Responsive behavior** - Test on mobile, tablet, desktop breakpoints

**Specific app sections to test:**
- Main application container
- Chat interface and messaging
- Modal dialogs with close buttons
- User profile areas with avatars
- Tooltip interactions throughout app
- Button interactions across all components

---

## 📋 Phase 2: Theme Integration (Medium Risk)
**Target:** 25 theme-token selectors (subset of 163)
**Components affected:** Base elements, message components, navigation elements

### **Phase 2 Inventory Context:**
From css-inventory.md, targeting these theme-token selectors while preserving CSS custom properties:
- Base elements: `html`, `body`, `#root`, headings, paragraphs, links
- Message components: `.message-actions` and layout utilities
- Navigation elements: layout utilities in nav components
- Modal utilities: `.modal-container`, `.modal-body`, `.modal-footer`

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

### **Project Completion Checklist:**
- [ ] All 5 phases completed successfully
- [ ] All subtasks checked off
- [ ] User manual testing completed for all phases
- [ ] Documentation created and reviewed
- [ ] Performance verified and documented
- [ ] Migration guide created for future development

**Total estimated timeline:** 4-6 weeks with user testing checkpoints

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

**Ready to begin Phase 1 when you give the go-ahead!**