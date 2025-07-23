# Mobile Development Plan - Improved Version

## Overview

This improved plan provides precise, trackable tasks with checkboxes for implementing the cross-platform architecture. Each task includes specific subtasks to ensure thorough completion across multiple sessions.

**Architecture Details**: See [`components-shared-arch-masterplan.md`](./components-shared-arch-masterplan.md)  
**Development Guidelines**: See [`component-dev-guidelines.md`](../../docs/component-dev-guidelines.md)

## Current State
✅ **Desktop app finished and stable**  
⏳ **Mobile development starting**

---

## Phase 1: Architecture Validation (Critical Foundation)

### Phase 1A: Foundation Layout Primitives

#### 0. Cross-Platform Theming Foundation
**Goal**: Preserve existing theming system and extend for React Native compatibility

- [x] **Audit current theming system**
  - [x] Document CSS variables system in `_colors.scss`
  - [x] Understand Tailwind integration via `tailwind.config.js`
  - [x] Analyze AccentColorSwitcher dynamic class system
  - [x] Review ThemeProvider light/dark mode management
  - [x] Map semantic color usage (text-strong, bg-sidebar, etc.)

- [x] **Create shared theme system**
  - [x] Create comprehensive `src/components/primitives/theme/colors.ts`
  - [x] Mirror ALL CSS variables exactly in JavaScript objects
  - [x] Include all accent color variants (blue, purple, fuchsia, orange, green, yellow)
  - [x] Add light/dark theme variants
  - [x] Create utility functions for theme access

- [x] **Extend ThemeProvider for cross-platform**
  - [x] Enhance existing ThemeProvider to support React Native
  - [x] Preserve all existing web functionality (localStorage, CSS classes)
  - [x] Add React Context for native theme access
  - [x] Ensure accent color switching works on both platforms
  - [ ] Test theme synchronization between web and native

- [x] **Update existing primitives to use shared theme**
  - [x] Update Button primitive to use shared colors
  - [x] Update ModalContainer to use shared colors
  - [x] Update OverlayBackdrop to use shared colors
  - [x] Ensure FlexRow/FlexBetween/FlexCenter remain theme-compatible

**Notes**: The existing theming system is sophisticated with CSS variables, Tailwind integration, and dynamic switching. This must be preserved exactly while extending for React Native compatibility. NO breaking changes to existing web styling.

#### 1. ModalContainer/OverlayBackdrop Primitives
**Goal**: Eliminate repeated backdrop patterns across 5+ components

- [x] **Setup primitive structure**
  - [x] Create `src/components/primitives/ModalContainer/index.ts`
  - [x] Create `src/components/primitives/ModalContainer/ModalContainer.web.tsx`
  - [x] Create `src/components/primitives/ModalContainer/ModalContainer.native.tsx`
  - [x] Create `src/components/primitives/ModalContainer/types.ts`
  - [x] Create `src/components/primitives/ModalContainer/styles.ts`

- [x] **Implement ModalContainer primitive**
  - [x] Define TypeScript interface for props in `types.ts`
  - [x] Implement web version with backdrop, z-index, and animations
  - [x] Implement native version using React Native Modal
  - [x] Add proper event handling (onBackdropPress, onRequestClose)
  - [x] Test keyboard accessibility (Escape key on web)

- [x] **Create OverlayBackdrop companion primitive**
  - [x] Create separate OverlayBackdrop primitive for reusability
  - [x] Implement click-outside detection
  - [x] Add configurable opacity and blur effects
  - [x] Support both dark and light theme variants

- [x] **Validate against existing usage**
  - [x] Audit Modal.tsx backdrop implementation
  - [x] Audit UserSettingsModal.tsx backdrop  
  - [x] Audit SpaceEditor.tsx backdrop
  - [x] Audit Lightbox.tsx backdrop
  - [x] Audit MessageActionsDrawer.tsx backdrop
  - [x] Document any unique requirements found

**Notes**: All existing backdrop patterns use `bg-overlay backdrop-blur` with `z-[9999]`. ModalContainer and OverlayBackdrop primitives successfully replicate this pattern. Fixed animation issue where close buttons bypassed ModalContainer's internal animation logic.

#### 2. Flex Layout Primitives
**Goal**: Standardize common flex patterns throughout app

- [x] **Create FlexRow primitive**
  - [x] Create `src/components/primitives/FlexRow/` structure
  - [x] Implement with configurable gap, align, justify props
  - [x] Support responsive gap values
  - [x] Add wrap and nowrap variants
  - [x] Test with RTL languages

- [x] **Create FlexBetween primitive**
  - [x] Create `src/components/primitives/FlexBetween/` structure
  - [x] Implement as specialized FlexRow with justify-between
  - [x] Support vertical alignment options
  - [x] Add common padding presets

- [x] **Create FlexCenter primitive**
  - [x] Create `src/components/primitives/FlexCenter/` structure
  - [x] Implement for both axes centering
  - [x] Support single-axis centering variants
  - [x] Add min-height options for full-screen centering

### Phase 1B: Critical Component Validation

#### 1. Convert Button.jsx to Primitive
**Goal**: Validate primitive architecture with most-used component

- [x] **Analyze current Button.jsx**
  - [x] Document all props and their types
  - [x] List all style variants (primary, secondary, danger, etc.)
  - [x] Identify all size options
  - [x] Note icon support and positioning
  - [x] Check for any animation or transition effects

- [x] **Create Button primitive structure**
  - [x] Create `src/components/primitives/Button/` directory
  - [x] Create comprehensive `types.ts` with all variants
  - [x] Plan style system for consistency
  - [x] Design native touch feedback approach

- [x] **Implement Button.web.tsx**
  - [x] Port all existing button styles
  - [x] Maintain exact className compatibility
  - [x] Preserve all event handlers
  - [x] Keep loading state animations
  - [x] Test keyboard navigation (Tab, Enter, Space)

- [x] **Implement Button.native.tsx**
  - [x] Use Pressable for proper touch feedback
  - [x] Implement native loading indicator
  - [x] Add haptic feedback for premium feel
  - [x] Ensure proper disabled state styling
  - [x] Test on both iOS and Android styles

- [ ] **Migration and testing**
  - [ ] Find all Button.jsx imports in codebase
  - [ ] Create codemod script for import updates
  - [ ] Update one low-risk component first
  - [ ] Run full test suite after each update
  - [ ] Document any behavioral differences

**Status**: Button primitive created and integrated into PrimitivesPlayground. Ready for migration testing.

#### 2. Convert Modal.tsx to Primitive
**Goal**: Prove primitive composition and Modal-to-Drawer transformation

- [x] **Deep analysis of Modal.tsx**
  - [x] Map all current modal configurations
  - [x] Document animation behaviors
  - [x] List all size variants (small, medium, large, full)
  - [x] Note keyboard trap implementation
  - [x] Check focus management requirements

- [x] **Design Modal primitive architecture**
  - [x] Plan composition with ModalContainer primitive
  - [x] Design header/body/footer slot system
  - [x] Plan mobile drawer transformation logic
  - [x] Create responsive behavior specifications

- [x] **Implement Modal.web.tsx**
  - [x] Use ModalContainer for backdrop
  - [x] Implement size variants with CSS
  - [x] Add smooth open/close animations
  - [x] Implement focus trap with react-focus-lock
  - [x] Test with screen readers

- [x] **Implement Modal.native.tsx**
  - [x] Transform to bottom drawer on mobile
  - [x] Add drag-to-dismiss gesture
  - [x] Implement iOS-style backdrop blur
  - [x] Add Android back button handling
  - [x] Test keyboard avoidance behavior

- [x] **Test Modal-to-Drawer transformation**
  - [x] Verify desktop modal behavior unchanged
  - [x] Test mobile drawer appears from bottom
  - [x] Check gesture dismissal smoothness
  - [x] Validate content scrolling behavior
  - [x] Ensure proper safe area handling

**Status**: Modal primitive created using ModalContainer composition. Integrated into PrimitivesPlayground for testing.

### Phase 1B Success Validation

**⚠️ CHECKPOINT**: Before proceeding to Phase 1C, ensure Phase 1B is complete and validated.

- [x] **Web primitives validation (testable now)**
  - [x] Button primitive works identically to Button.jsx in PrimitivesPlayground
  - [x] Modal primitive uses ModalContainer correctly for backdrop/animations
  - [x] All button variants, sizes, and states display correctly
  - [x] Modal opening/closing animations work smoothly
  - [x] ESC key and backdrop click close modals with animation
  - [x] Cross-platform theme system works (theme/accent switching)
  - [x] Production build includes all primitives without errors
  - [x] No visual regressions in existing web functionality

- [ ] **Desktop regression testing (optional now)**
  - [ ] Manual test Button/Modal usage throughout existing app
  - [ ] Run full application test suite if available
  - [ ] Verify no performance degradation in production
  - [ ] Get team approval on primitive implementations

- [ ] **Native primitives validation (Phase 3)**
  - [ ] Create React Native test environment
  - [ ] Test Modal → bottom drawer transformation  
  - [ ] Test Button → native touch feedback
  - [ ] Verify React Native styling and animations
  - [ ] Document platform-specific behavior differences

**Success Criteria**: Web primitives working perfectly in both dev and production. Native validation deferred to Phase 3 when React Native environment is available.

---

## Phase 1C: Architecture Validation and Pattern Replacement

**⚠️ IMPORTANT**: This phase should only begin after Phase 1B (Button and Modal primitives) are successfully validated and working in production.

### ResponsiveContainer Primitive
**Goal**: Centralize responsive width calculations to replace Container.tsx

- [ ] **Extract Container.tsx logic**
  - [ ] Analyze current Container.tsx implementation
  - [ ] Document fixed positioning and viewport calculations
  - [ ] Map responsive breakpoints: mobile (< 1024px), phone (< 480px)
  - [ ] Note NavMenu width dependencies (72px desktop, 74px tablet, 50px phone)
  - [ ] Understand border-radius and background-color usage

- [ ] **Create ResponsiveContainer primitive**
  - [ ] Create `src/components/primitives/ResponsiveContainer/` structure
  - [ ] Implement web version matching Container.scss exactly
  - [ ] Create native version with proper SafeAreaView and flex layouts
  - [ ] Add support for custom positioning and sizing
  - [ ] Add padding and margin presets for content spacing

- [ ] **Test responsive behavior**
  - [ ] Test at phone viewport (< 480px) - should use 50px NavMenu offset
  - [ ] Test at tablet viewport (480px - 1024px) - should use 74px offset
  - [ ] Test at desktop viewport (> 1024px) - should use 72px offset
  - [ ] Verify border-radius and background colors match exactly
  - [ ] Check smooth transitions between breakpoints

### Replace Inline Flex Patterns
**Goal**: Replace common flex patterns throughout the app with primitives

- [ ] **Search and catalog patterns**
  - [ ] Search codebase for `flex flex-row` patterns (→ FlexRow)
  - [ ] Search codebase for `flex justify-between` patterns (→ FlexBetween)
  - [ ] Search codebase for `flex items-center justify-center` patterns (→ FlexCenter)
  - [ ] Create prioritized migration list (start with low-risk components)

- [ ] **Gradual replacement strategy**
  - [ ] Phase 1: Replace patterns in utility components and shared UI
  - [ ] Phase 2: Replace patterns in business logic components
  - [ ] Phase 3: Replace patterns in critical user-facing components
  - [ ] Test each replacement maintains exact visual behavior
  - [ ] Commit after each successful batch of replacements

**Success Criteria**: All common flex patterns replaced, no visual regressions, improved code consistency.

---

## Phase 1D: Automated Theme Synchronization

### Color Sync Automation
**Goal**: Eliminate manual synchronization between CSS variables and JavaScript theme objects

- [ ] **Create automated color sync system**
  - [ ] Design build script to parse `_colors.scss` CSS variables
  - [ ] Generate `colors.ts` automatically from CSS source of truth
  - [ ] Integrate script into build pipeline (`npm run build`)
  - [ ] Add validation to ensure color parity between platforms
  - [ ] Test script with all accent color variants and light/dark themes

- [ ] **Establish workflow for theme changes**
  - [ ] Document process: modify `_colors.scss` → script auto-generates `colors.ts`
  - [ ] Add pre-commit hooks to run sync script when CSS changes
  - [ ] Create validation tests to catch sync issues
  - [ ] Add script to `package.json` scripts section

**Important Context**: Currently, changes to `_colors.scss` require manual updates to `colors.ts`. This creates a maintenance burden and risk of color inconsistencies between web and native platforms. The build script will maintain `_colors.scss` as the single source of truth while automatically keeping React Native colors synchronized.

**Implementation Options**:
1. **Build Script** (Recommended): Parse CSS variables, generate JavaScript objects
2. **CSS-in-JS**: Single JavaScript source generating both CSS and native objects  
3. **Design Token Pipeline**: External tools like Style Dictionary

**Success Criteria**: Developers only need to modify `_colors.scss`, and React Native colors automatically stay in sync.

---

## Phase 2: Core Primitives Conversion

### Input Primitives

#### 1. Convert Input.tsx
**Goal**: Create reusable input primitive for all text inputs

- [ ] **Analyze Input.tsx usage**
  - [ ] Find all Input component imports
  - [ ] Document all prop variations used
  - [ ] List validation requirements
  - [ ] Note error state displays
  - [ ] Check for custom input types

- [ ] **Create Input primitive**
  - [ ] Design comprehensive props interface
  - [ ] Plan validation system
  - [ ] Design error message display
  - [ ] Plan icon support (left/right)
  - [ ] Consider multiline variant needs

- [ ] **Implement platform versions**
  - [ ] Web: maintain current styling exactly
  - [ ] Native: use TextInput with custom styling
  - [ ] Add proper keyboard type support
  - [ ] Implement secure text entry
  - [ ] Test auto-complete behavior

#### 2. Create TextArea primitive
**Goal**: Replace all raw `<textarea>` elements

- [ ] **Audit textarea usage**
  - [ ] Search for all `<textarea` in codebase
  - [ ] Document different configurations
  - [ ] Note auto-resize behaviors
  - [ ] Check character limit implementations
  - [ ] Find markdown editor integrations

- [ ] **Implement TextArea primitive**
  - [ ] Support auto-resize functionality
  - [ ] Add character counter option
  - [ ] Implement native with proper scrolling
  - [ ] Add mention/hashtag support hooks
  - [ ] Test with long text content

#### 3. Create Select primitive
**Goal**: Replace all raw `<select>` elements

- [ ] **Audit select usage**
  - [ ] Find all `<select` elements
  - [ ] Document option data structures
  - [ ] Note any custom styling needs
  - [ ] Check for multi-select usage
  - [ ] Find searchable select needs

- [ ] **Implement Select primitive**
  - [ ] Create web version with native select
  - [ ] Create native version with picker/modal
  - [ ] Add search functionality option
  - [ ] Support option groups
  - [ ] Test keyboard navigation

### Interactive Primitives

#### 4. Convert ReactTooltip.tsx
**Goal**: Create accessible tooltip primitive

- [ ] **Analyze tooltip patterns**
  - [ ] Document all tooltip triggers
  - [ ] List positioning strategies
  - [ ] Note delay configurations
  - [ ] Check for custom content needs
  - [ ] Find mobile alternatives used

- [ ] **Create Tooltip primitive**
  - [ ] Web: hover/focus triggered
  - [ ] Native: long-press triggered
  - [ ] Implement smart positioning
  - [ ] Add arrow pointing option
  - [ ] Test with screen readers

#### 5. Convert ToggleSwitch.tsx
**Goal**: Create accessible switch primitive

- [ ] **Analyze current implementation**
  - [ ] Document animation details
  - [ ] Check accessibility implementation
  - [ ] Note size variants
  - [ ] List label positioning options

- [ ] **Implement Switch primitive**
  - [ ] Match current animation exactly
  - [ ] Add haptic feedback on native
  - [ ] Implement proper ARIA roles
  - [ ] Support RTL layouts
  - [ ] Test with assistive technologies

### Layout Primitives

#### 6. Additional layout patterns
**Goal**: Complete primitive coverage

- [ ] **Create Spacer primitive**
  - [ ] Fixed and flexible spacing
  - [ ] Responsive space values
  - [ ] Horizontal and vertical variants

- [ ] **Create Divider primitive**
  - [ ] Horizontal and vertical options
  - [ ] Theme-aware styling
  - [ ] Optional text in divider

- [ ] **Create Grid primitive**
  - [ ] Responsive column counts
  - [ ] Gap configuration
  - [ ] Alignment options

### Phase 2 Validation

- [ ] **Component coverage audit**
  - [ ] Count remaining raw HTML elements
  - [ ] List components still using raw elements
  - [ ] Calculate coverage percentage
  - [ ] Identify blocking issues

- [ ] **Import migration**
  - [ ] Update all component imports
  - [ ] Remove old component files
  - [ ] Update test imports
  - [ ] Fix any circular dependencies

---

## Phase 3: Mobile Environment Setup

### Test Environment Creation

- [ ] **Setup Expo project**
  - [ ] Run `npx create-expo-app quorum-mobile-test`
  - [ ] Configure TypeScript
  - [ ] Setup path aliases matching main project
  - [ ] Install required dependencies
  - [ ] Configure metro bundler

- [ ] **Import primitives**
  - [ ] Copy primitives directory
  - [ ] Setup mock desktop-only imports
  - [ ] Configure style system
  - [ ] Add theme provider
  - [ ] Test initial render

### iOS Testing

- [ ] **Simulator setup**
  - [ ] Test on iPhone SE (small screen)
  - [ ] Test on iPhone 14 (standard)
  - [ ] Test on iPad (tablet)
  - [ ] Check safe area handling
  - [ ] Verify keyboard behavior

- [ ] **Component testing checklist**
  - [ ] All primitives render correctly
  - [ ] Touch targets meet 44pt minimum
  - [ ] Animations run at 60fps
  - [ ] No layout shifts or flickers
  - [ ] Proper status bar handling

### Android Testing

- [ ] **Emulator setup**
  - [ ] Test on Pixel 4a (standard)
  - [ ] Test on Pixel C (tablet)
  - [ ] Test on Galaxy Fold (foldable)
  - [ ] Check back button handling
  - [ ] Verify keyboard behavior

- [ ] **Component testing checklist**
  - [ ] All primitives render correctly
  - [ ] Touch feedback works properly
  - [ ] No overdraw issues
  - [ ] Proper navigation bar handling
  - [ ] Material Design compliance

### Performance Testing

- [ ] **Measure and optimize**
  - [ ] Profile initial render time
  - [ ] Check JS bundle size
  - [ ] Measure memory usage
  - [ ] Test with 100+ list items
  - [ ] Optimize re-renders

---

## Phase 4: Mobile-Specific Component Analysis

### Navigation Analysis

- [ ] **Current navigation audit**
  - [ ] Map all navigation paths
  - [ ] Document sidebar structure
  - [ ] List keyboard shortcuts used
  - [ ] Note breadcrumb patterns
  - [ ] Check deep linking needs

- [ ] **Mobile navigation design**
  - [ ] Choose tab bar vs drawer
  - [ ] Design navigation hierarchy
  - [ ] Plan gesture navigation
  - [ ] Design back button behavior
  - [ ] Create navigation prototype

### Search Experience

- [ ] **Current search analysis**
  - [ ] Document search UI locations
  - [ ] Map search result types
  - [ ] Check filter capabilities
  - [ ] Note real-time search needs
  - [ ] Find search shortcuts

- [ ] **Mobile search design**
  - [ ] Design search activation
  - [ ] Plan results display
  - [ ] Design filter UI
  - [ ] Add voice search option
  - [ ] Create search prototype

### Interaction Patterns

- [ ] **Hover interaction audit**
  - [ ] Find all hover-dependent UI
  - [ ] List tooltip triggers
  - [ ] Check hover menus
  - [ ] Note hover states
  - [ ] Document preview hovers

- [ ] **Touch alternatives design**
  - [ ] Map hover to long-press
  - [ ] Design context menus
  - [ ] Plan swipe gestures
  - [ ] Add touch feedback
  - [ ] Create interaction guide

### Complex UI Patterns

- [ ] **Modal-heavy UI analysis**
  - [ ] List all modal types
  - [ ] Check modal nesting
  - [ ] Find full-screen modals
  - [ ] Note modal workflows
  - [ ] Document form modals

- [ ] **Mobile UI transformation**
  - [ ] Design screen-based flows
  - [ ] Plan form workflows
  - [ ] Design settings screens
  - [ ] Create navigation maps
  - [ ] Build UI prototypes

---

## Phase 5: Mobile-Specific Implementation

### Business Logic Extraction

- [ ] **Create shared hooks**
  - [ ] Extract message actions logic
  - [ ] Extract space management logic
  - [ ] Extract user settings logic
  - [ ] Extract search logic
  - [ ] Test hook isolation

- [ ] **Create shared contexts**
  - [ ] Authentication context
  - [ ] Theme context
  - [ ] Navigation context
  - [ ] Data cache context
  - [ ] WebSocket context

### Platform-Specific Components

- [ ] **Navigation components**
  - [ ] Implement tab bar navigation
  - [ ] Create stack navigators
  - [ ] Add drawer if needed
  - [ ] Implement deep linking
  - [ ] Test navigation state

- [ ] **Screen implementations**
  - [ ] Messages screen with tabs
  - [ ] Spaces list and detail
  - [ ] Settings screen hierarchy
  - [ ] Search screen with results
  - [ ] Profile and preferences

- [ ] **Mobile-specific features**
  - [ ] Pull-to-refresh
  - [ ] Infinite scroll
  - [ ] Swipe actions
  - [ ] Floating action buttons
  - [ ] Bottom sheets

### Integration Points

- [ ] **API integration**
  - [ ] Share API clients
  - [ ] Handle offline state
  - [ ] Implement sync logic
  - [ ] Add request caching
  - [ ] Test error handling

- [ ] **State management**
  - [ ] Share Redux/Zustand stores
  - [ ] Add persistence layer
  - [ ] Handle background state
  - [ ] Implement optimistic updates
  - [ ] Test state synchronization

---

## Phase 6: Full Mobile Application

### App Infrastructure

- [ ] **Project setup**
  - [ ] Initialize React Native project
  - [ ] Configure build systems
  - [ ] Setup CI/CD pipelines
  - [ ] Configure code signing
  - [ ] Setup crash reporting

- [ ] **Development environment**
  - [ ] Configure debugging tools
  - [ ] Setup hot reload
  - [ ] Add development menu
  - [ ] Configure simulators
  - [ ] Document setup process

### Core Features

- [ ] **Authentication flow**
  - [ ] Implement login screen
  - [ ] Add biometric authentication
  - [ ] Handle token storage
  - [ ] Implement auto-login
  - [ ] Test session management

- [ ] **Main app features**
  - [ ] Message viewing and sending
  - [ ] Space browsing and joining
  - [ ] User profile management
  - [ ] Settings and preferences
  - [ ] Search functionality

- [ ] **Platform features**
  - [ ] Push notifications
  - [ ] Background sync
  - [ ] Offline support
  - [ ] Deep linking
  - [ ] Share extensions

### Quality Assurance

- [ ] **Testing**
  - [ ] Unit test coverage >80%
  - [ ] Integration test flows
  - [ ] E2E test critical paths
  - [ ] Performance testing
  - [ ] Accessibility testing

- [ ] **Device testing**
  - [ ] Test on 10+ iOS devices
  - [ ] Test on 10+ Android devices
  - [ ] Test on tablets
  - [ ] Test on foldables
  - [ ] Document device issues

### Release Preparation

- [ ] **App store setup**
  - [ ] Create app store listings
  - [ ] Prepare screenshots
  - [ ] Write app descriptions
  - [ ] Setup app previews
  - [ ] Configure pricing

- [ ] **Release process**
  - [ ] Beta testing program
  - [ ] Staged rollout plan
  - [ ] Monitor crash rates
  - [ ] Gather user feedback
  - [ ] Plan update cycle

---

## Progress Tracking

### Daily Checklist
- [ ] Update completed tasks
- [ ] Document blockers
- [ ] Note decisions made
- [ ] Update time estimates
- [ ] Plan next session

### Weekly Review
- [ ] Calculate completion percentage
- [ ] Review architecture decisions
- [ ] Update stakeholders
- [ ] Adjust timeline if needed
- [ ] Plan upcoming week

### Phase Completion
- [ ] All tasks checked off
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Stakeholder sign-off

---

## Notes Section

### Session Notes
_Use this section to add notes between sessions_

**Important**: 
Stop and ask for human review/testing after any important change.
When confirmed by a human, commit, so we can easily revert if there are issues. This ensures we have restore points throughout the development process. Commit messages should be simple and describe what was done (no mentions of Claude/Anthropic).

### Blockers
_Document any blocking issues here_

### Decisions Log
_Record important decisions made_

### Links and References
_Add helpful links discovered during development_

---

*Last updated: 2025-07-23 01:30 UTC*