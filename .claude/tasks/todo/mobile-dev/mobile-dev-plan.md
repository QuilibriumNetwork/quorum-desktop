# Mobile Development Plan

## Overview

This plan outlines the **execution timeline and phase-by-phase approach** for implementing the cross-platform architecture described in [`components-shared-arch-masterplan.md`](./components-shared-arch-masterplan.md).

**For detailed development workflows and code examples**, see [`component-dev-guidelines.md`](../../docs/component-dev-guidelines.md).

## Current State
✅ **Desktop app finished and stable**

## Development Phases

### Phase 1: Architecture Validation
🎯 **Goal**: Validate primitive architecture with minimal risk

**Architecture Rationale**: See the [masterplan](./components-shared-arch-masterplan.md) for detailed architecture reasoning and the Modal-to-Drawer transformation concept.

#### Phase 1A: Foundation Layout Primitives (Low Risk)
**Priority Order Based on Codebase Audit**:

1. **ModalContainer/OverlayBackdrop Primitives**
   - **Impact**: Eliminates repeated backdrop patterns across 5+ components
   - **Risk**: Low - purely layout consolidation

2. **Flex Layout Primitives (FlexRow/FlexBetween/FlexCenter)**
   - **Impact**: Standardizes common flex patterns throughout app
   - **Risk**: Low - simple layout primitives

3. **ResponsiveContainer Primitive**
   - **Impact**: Centralizes complex responsive width calculations
   - **Risk**: Low - extracts existing Container.tsx logic

#### Phase 1B: Critical Component Validation (Higher Risk)

4. **Convert Button.jsx to Primitive**
   - **Why Critical**: Most used component, validates entire approach
   - **Risk**: Medium - high usage requires careful testing

5. **Convert Modal.tsx to Primitive**  
   - **Why Critical**: Proves primitive composition + Modal-to-Drawer concept
   - **Risk**: Medium - complex transformation, multiple usage patterns

#### Success Criteria
- [ ] ModalContainer eliminates repeated backdrop patterns across 5+ components
- [ ] Flex primitives successfully replace inline flex classes
- [ ] ResponsiveContainer maintains current responsive behavior
- [ ] Button works identically on desktop after conversion
- [ ] Modal uses primitive composition successfully
- [ ] No regressions in existing functionality
- [ ] Foundation proves primitive architecture viability

#### Phase 1A Mobile Testing Strategy

**Important**: After Phase 1A, you'll have layout primitives ready for mobile but business components still contain raw HTML. Here's how to test the primitives without breaking the mobile build:

##### What You CAN Test on Mobile After Phase 1A

**✅ Layout Primitives Work Correctly**:
- ModalContainer → renders as proper mobile overlay
- FlexRow/FlexBetween → work as React Native Views
- ResponsiveContainer → adapts to mobile screen sizes

**❌ What WON'T Work Yet**:
- Raw HTML elements (`<button>`, `<input>`, `<div>`) cause React Native errors
- Business components (Message.tsx, Channel.tsx) won't render until HTML is replaced

##### Mobile Testing Environment Setup

```bash
# Create isolated mobile test environment
npx create-expo-app quorum-primitives-test
cd quorum-primitives-test
yarn start
```

**Copy primitives for testing**:
```bash
# Copy your completed primitives to test app
cp -r src/components/primitives/ quorum-primitives-test/components/primitives/
```

##### Testing Approach for Each Primitive

**1. Individual Primitive Testing**:
```tsx
// Test ModalContainer in isolation
import { ModalContainer } from '../primitives/ModalContainer';

function TestModalContainer() {
  return (
    <ModalContainer>
      <Text>Testing modal container on mobile!</Text>
    </ModalContainer>
  );
}
```

**2. Primitive Composition Testing**:
```tsx
// Test primitives working together
import { ModalContainer } from '../primitives/ModalContainer';
import { FlexRow } from '../primitives/FlexRow';

function TestComposition() {
  return (
    <ModalContainer>
      <FlexRow>
        <Text>Left</Text>
        <Text>Right</Text>
      </FlexRow>
    </ModalContainer>
  );
}
```

**3. Business Logic Integration Testing**:
```tsx
// Test shared business logic with mobile-safe UI
import { useMessageActions } from '../hooks/useMessageActions';

function TestBusinessLogic() {
  const { actions, handleAction } = useMessageActions();
  
  return (
    <FlexRow>
      {actions.map(action => (
        <Pressable key={action.id} onPress={() => handleAction(action)}>
          <Text>{action.label}</Text>
        </Pressable>
      ))}
    </FlexRow>
  );
}
```

##### Testing Checklist for Phase 1A

**For Each Primitive**:
- [ ] Renders without errors on iOS Simulator
- [ ] Renders without errors on Android Emulator  
- [ ] Touch interactions work smoothly
- [ ] Styling matches desktop appearance
- [ ] Responsive behavior works on different screen sizes
- [ ] Performance is acceptable on device

**For Primitive Composition**:
- [ ] Multiple primitives work together
- [ ] No layout conflicts or overlapping
- [ ] Consistent spacing and alignment
- [ ] Proper z-index behavior for modals

**For Business Logic Integration**:
- [ ] Shared hooks work unchanged
- [ ] State management works correctly
- [ ] Event handlers function properly
- [ ] Data flow is consistent with desktop

##### Expected Testing Outcomes

**After Phase 1A Testing, You Should Have**:
- [ ] Validated that primitive architecture works on mobile
- [ ] Confirmed styling system translates correctly
- [ ] Identified any mobile-specific adjustments needed
- [ ] Documented performance characteristics
- [ ] Proved business logic can be shared
- [ ] Built confidence for Phase 1B conversion

**Phase 1A Testing Validates**:
- ✅ Architecture concept works
- ✅ Styling approach is sound  
- ✅ Primitives compose correctly
- ✅ Foundation is ready for Button/Modal conversion

This testing approach ensures Phase 1A work is validated before committing to full component conversion in Phase 1B.

#### Implementation Commands
```bash
# Create primitive structure based on audit findings
mkdir -p src/components/primitives/{ModalContainer,OverlayBackdrop,FlexRow,FlexBetween,FlexCenter,ResponsiveContainer,Button,Modal}

# Phase 1A: Foundation (low risk, immediate impact)
# 1. Create ModalContainer → replace repeated backdrop patterns
# 2. Create FlexRow/FlexBetween → replace common flex patterns  
# 3. Create ResponsiveContainer → replace Container.tsx logic

# Phase 1B: Critical validation (validates architecture)
# 4. Convert Button.jsx → primitives/Button/
# 5. Convert Modal.tsx → primitives/Modal/ (using ModalContainer)
```

**For detailed component creation workflows**, see [`component-dev-guidelines.md`](../../docs/component-dev-guidelines.md) - Workflow B: Converting Existing Components.

### Phase 2: Core Primitives Conversion
🎯 **Goal**: Eliminate raw HTML from business components

#### High Priority Conversions
1. **Input.tsx** → `primitives/Input/`
2. **ReactTooltip.tsx** → `primitives/Tooltip/`
3. **ToggleSwitch.tsx** → `primitives/Switch/`

#### Medium Priority Conversions
4. **Raw `<textarea>` elements** → `primitives/TextArea/`
5. **Raw `<select>` elements** → `primitives/Select/`
6. **Container/layout patterns** → `primitives/Container/`

#### Success Criteria
- [ ] 90%+ of raw HTML elements eliminated from business components
- [ ] All primitives have both .web.tsx and .native.tsx implementations
- [ ] Business components only import from primitives
- [ ] Desktop functionality remains unchanged

### Phase 3: Mobile Environment Setup
🎯 **Goal**: Test primitives in actual React Native environment

#### Setup Tasks
1. **Create React Native Test Environment**
   ```bash
   npx create-expo-app quorum-mobile-test
   cd quorum-mobile-test
   yarn start
   ```

2. **Import and Test Primitives**
   - Copy primitive components to test environment
   - Test each primitive on iOS Simulator
   - Test each primitive on Android Emulator
   - Verify styling matches design intentions

3. **Identify Required Adjustments**
   - Note touch target size issues
   - Document large tablet optimization needs
   - List styling inconsistencies
   - Record performance issues

#### Success Criteria
- [ ] All primitives render correctly in React Native
- [ ] Touch interactions work smoothly
- [ ] Styling is consistent with desktop design
- [ ] Performance is acceptable on devices

### Phase 4: Mobile-Specific Component Identification
🎯 **Goal**: Identify components needing different mobile behavior

#### Analysis Process
Test each major business component in mobile environment and document:

1. **Navigation Components**
   - Desktop: Sidebar navigation, expandable nav menu
   - Mobile: Bottom tabs, hamburger menu, or drawer navigation
   - **Decision Needed**: Navigation pattern for mobile

2. **Search Components**
   - Desktop: Always-visible search bar
   - Mobile: Expandable search, search modal, or dedicated search screen
   - **Decision Needed**: Search UX pattern for mobile

3. **Message Actions**
   - Desktop: Hover to reveal action buttons
   - Mobile: Long-press → action drawer, or always-visible buttons
   - **Current**: Already has MessageActionsDrawer for mobile

4. **User Interaction Patterns**
   - Desktop: Hover tooltips, right-click context menus
   - Mobile: Tap actions, long-press menus, swipe gestures
   - **Review**: All hover-dependent interactions

5. **Settings and Configuration**
   - Desktop: Modal with sidebar navigation (UserSettingsModal, SpaceEditor)
   - Mobile: Full-screen navigation or tabbed interface
   - **Decision Needed**: Complex modal → mobile navigation pattern

#### Documentation Output
Create list of components requiring mobile-specific behavior:
- Component name
- Current desktop behavior  
- Required mobile behavior
- Implementation approach (shared logic + platform UI)

### Phase 5: Mobile-Specific Implementation
🎯 **Goal**: Build components with different mobile behavior

#### Implementation Strategy
For each identified component:

1. **Keep Shared Business Logic**
   ```tsx
   // Shared hook or context
   export function useMessageActions() {
     // All business logic here
     return { actions, handleAction, ... };
   }
   ```

2. **Create Platform-Specific UI**
   ```tsx
   // MessageActions.web.tsx - hover buttons
   // MessageActions.native.tsx - long-press drawer
   ```

3. **Use Primitives for All Rendering**
   - Both platforms use same Button, Modal, etc.
   - Different layout and interaction patterns
   - Consistent visual design

#### Key Components to Implement
Based on common mobile UX patterns:

1. **Navigation System**
   - Mobile-specific navigation primitives
   - Bottom tab bar or drawer navigation
   - Integration with existing routing

2. **Search Experience**
   - Mobile-optimized search interface
   - Touch-friendly search results
   - Search history and suggestions

3. **Complex Modals → Mobile Navigation**
   - UserSettingsModal → Settings screen stack
   - SpaceEditor → Multi-screen editor flow
   - Responsive layout detection (`useResponsiveLayout`)

### Phase 6: Full Mobile Application
🎯 **Goal**: Complete, shippable mobile application

#### Mobile App Structure
```
mobile-app/
├── App.tsx                 # Root component
├── navigation/             # Mobile navigation
│   ├── TabNavigator.tsx
│   ├── StackNavigator.tsx
│   └── DrawerNavigator.tsx
├── screens/                # Mobile-specific screens
│   ├── MessagesScreen.tsx
│   ├── SpacesScreen.tsx
│   ├── SettingsScreen.tsx
│   └── SearchScreen.tsx
└── components/             # Shared primitives & business components
    ├── primitives/         # Platform-specific primitives
    └── shared/             # Business logic components
```

#### Integration Tasks
1. **Mobile Navigation Setup**
   - React Navigation or similar
   - Tab bar with Messages, Spaces, Profile
   - Stack navigation for detailed views

2. **Mobile-Specific Screens**
   - Adapt existing business components to mobile layout
   - Full-screen implementations of complex modals
   - Touch-optimized interactions

3. **Platform Services Integration**
   - Push notifications
   - Deep linking
   - App state management
   - Background task handling

4. **Performance Optimization**
   - Image optimization
   - Bundle size optimization
   - Lazy loading of screens
   - Memory usage optimization

5. **Testing and Polish**
   - Device testing on various screen sizes
   - Performance testing
   - Accessibility testing
   - User acceptance testing

## Risk Mitigation

### Phase 1 Validation is Critical
- If Button or Modal conversion fails, pause and reassess approach
- Small scope allows for quick iteration and fixes
- Validates entire primitive architecture concept

### Rollback Plans
- Keep original components until primitive versions are fully tested
- Gradual import updates allow for easy reversion
- Desktop functionality must never be broken

### Testing Strategy
- Test each primitive immediately after creation
- Maintain desktop functionality throughout process
- Use React Native test environment early and often

## Success Metrics

### Architecture Success
- [ ] 95%+ code sharing between desktop and mobile
- [ ] Zero breaking changes to existing desktop functionality
- [ ] Clean separation between primitives and business logic

### Development Velocity
- [ ] New features can be built for both platforms simultaneously
- [ ] Bug fixes apply to both platforms automatically
- [ ] Mobile-specific features don't impact desktop

### User Experience
- [ ] Mobile app feels native, not like "web in app"
- [ ] Consistent design language across platforms
- [ ] Platform-appropriate interactions and patterns

## Next Steps

1. **Start with Phase 1**: Convert Button.jsx to primitive
2. **Validate approach**: Test thoroughly on desktop
3. **Continue systematically**: Follow phase order
4. **Document learnings**: Update this plan based on discoveries
5. **Maintain quality**: Never sacrifice desktop stability for mobile progress

The key to success is the incremental approach - validating the architecture early with Button and Modal before committing to full conversion.