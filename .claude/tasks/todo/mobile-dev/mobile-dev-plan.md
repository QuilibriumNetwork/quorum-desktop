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

- [ ] **Analyze current Button.jsx**
  - [ ] Document all props and their types
  - [ ] List all style variants (primary, secondary, danger, etc.)
  - [ ] Identify all size options
  - [ ] Note icon support and positioning
  - [ ] Check for any animation or transition effects

- [ ] **Create Button primitive structure**
  - [ ] Create `src/components/primitives/Button/` directory
  - [ ] Create comprehensive `types.ts` with all variants
  - [ ] Plan style system for consistency
  - [ ] Design native touch feedback approach

- [ ] **Implement Button.web.tsx**
  - [ ] Port all existing button styles
  - [ ] Maintain exact className compatibility
  - [ ] Preserve all event handlers
  - [ ] Keep loading state animations
  - [ ] Test keyboard navigation (Tab, Enter, Space)

- [ ] **Implement Button.native.tsx**
  - [ ] Use Pressable for proper touch feedback
  - [ ] Implement native loading indicator
  - [ ] Add haptic feedback for premium feel
  - [ ] Ensure proper disabled state styling
  - [ ] Test on both iOS and Android styles

- [ ] **Migration and testing**
  - [ ] Find all Button.jsx imports in codebase
  - [ ] Create codemod script for import updates
  - [ ] Update one low-risk component first
  - [ ] Run full test suite after each update
  - [ ] Document any behavioral differences

#### 2. Convert Modal.tsx to Primitive
**Goal**: Prove primitive composition and Modal-to-Drawer transformation

- [ ] **Deep analysis of Modal.tsx**
  - [ ] Map all current modal configurations
  - [ ] Document animation behaviors
  - [ ] List all size variants (small, medium, large, full)
  - [ ] Note keyboard trap implementation
  - [ ] Check focus management requirements

- [ ] **Design Modal primitive architecture**
  - [ ] Plan composition with ModalContainer primitive
  - [ ] Design header/body/footer slot system
  - [ ] Plan mobile drawer transformation logic
  - [ ] Create responsive behavior specifications

- [ ] **Implement Modal.web.tsx**
  - [ ] Use ModalContainer for backdrop
  - [ ] Implement size variants with CSS
  - [ ] Add smooth open/close animations
  - [ ] Implement focus trap with react-focus-lock
  - [ ] Test with screen readers

- [ ] **Implement Modal.native.tsx**
  - [ ] Transform to bottom drawer on mobile
  - [ ] Add drag-to-dismiss gesture
  - [ ] Implement iOS-style backdrop blur
  - [ ] Add Android back button handling
  - [ ] Test keyboard avoidance behavior

- [ ] **Test Modal-to-Drawer transformation**
  - [ ] Verify desktop modal behavior unchanged
  - [ ] Test mobile drawer appears from bottom
  - [ ] Check gesture dismissal smoothness
  - [ ] Validate content scrolling behavior
  - [ ] Ensure proper safe area handling

### Phase 1B Success Validation

**⚠️ CHECKPOINT**: Before proceeding to Phase 1C, ensure Phase 1B is complete and validated.

- [ ] **Desktop regression testing**
  - [ ] Run full application test suite
  - [ ] Manual test all Button and Modal usage throughout app
  - [ ] Check for any visual differences in converted components
  - [ ] Verify no performance degradation
  - [ ] Get team approval on Button and Modal primitive implementations

- [ ] **Primitive composition validation**
  - [ ] Confirm Button primitive works identically to Button.jsx
  - [ ] Verify Modal primitive uses ModalContainer correctly
  - [ ] Test Modal-to-Drawer transformation on mobile viewport
  - [ ] Check that primitive composition approach is sound
  - [ ] Document any architectural lessons learned

- [ ] **Mobile proof of concept testing**
  - [ ] Create minimal React Native test app
  - [ ] Import and test Button and Modal primitives
  - [ ] Verify touch interactions and animations work
  - [ ] Test drawer behavior on mobile
  - [ ] Document any platform-specific issues found

**Success Criteria**: Button and Modal primitives working in production with zero regressions before continuing to Phase 1C.

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