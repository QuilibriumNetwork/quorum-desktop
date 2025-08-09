# Mobile Component Development Roadmap

*Generated: 2025-08-09*

## Overview

This roadmap guides the creation of mobile components using a bottom-up dependency approach. Components are organized into 6 levels based on their dependency complexity, ensuring simpler components are built first before being used by more complex ones.

## Dependency Levels Summary

| Level | Description | Count | Status | Priority |
|-------|-------------|--------|---------|----------|
| **Level 0** | Primitive components | 20 | ✅ **COMPLETE** | HIGHEST |
| **Level 1** | Simple components (primitives only) | 8 | 🟡 **IN PROGRESS** | HIGH |
| **Level 2** | Moderate complexity | 12 | ❌ **NOT STARTED** | MEDIUM-HIGH |
| **Level 3** | Complex components | 15 | 🟡 **PARTIAL** | MEDIUM |
| **Level 4** | Very complex components | 9 | 🟡 **PARTIAL** | LOW-MEDIUM |
| **Level 5** | Super complex (layout/coordination) | 10 | 🟡 **PARTIAL** | LOWEST |

## Phase-by-Phase Development Plan

### Phase 1: Foundations ✅ COMPLETE
**All primitive components (Level 0)**
- **Status**: All 20 primitives have both `.web.tsx` and `.native.tsx` implementations
- **Components**: Button, Container, FlexRow, FlexColumn, Text, Icon, Input, TextArea, Modal, etc.
- **Next Action**: Verify all primitives work correctly in mobile playground

### Phase 2: Simple Components 🟡 IN PROGRESS
**Level 1 - Components that only depend on primitives**

#### Already Complete ✅
- `ThemeRadioGroup` (shared, mobile-ready)
- `AccentColorSwitcher` (shared, mobile-ready) 
- `Maintenance` (mobile-ready)

#### Ready to Build Next 🚀
1. **CloseButton** - Only depends on Icon primitive  - I think it's only used for Electron?
2. **Loading** - No dependencies, just animation - Not sure it's used at all
3. **UserOnlineStateIndicator** - Simple colored dot - Used?
4. **QuickReactionButton** - Touch-friendly button - Not necessary on mobile native?
5. **ClickToCopyContent** - Uses 4 primitives 



### Phase 3: Moderate Components 
**Level 2 - Components with moderate dependencies**

#### High Priority (Build First)
1. **SpaceIcon** - Depends on Tooltip (needed by 4+ components)
2. **InviteLink** - Only primitive dependencies
3. **MessageComposer** - Critical for messaging (5 primitive deps)
4. **KickUserModal** - Shared modal (5 primitive deps)
5. **NewDirectMessageModal** - Shared modal (5 primitive deps)

#### Medium Priority 
- MessageActions, SearchResultItem, EmptyDirectMessage, LeaveSpaceModal

**Estimated Time**: 2-3 weeks

### Phase 4: Complex Components
**Level 3 - Multiple dependencies**

#### Authentication (Already Complete ✅)
- `Login.native.tsx` 
- `Onboarding.native.tsx`

#### Next Priority
1. **UserProfile** - Depends on multiple Level 1 & 2 components
2. **SpaceButton** - Depends on SpaceIcon (Level 2)
3. **JoinSpaceModal** - Shared component
4. **GlobalSearch** - Search system foundation

**Estimated Time**: 3-4 weeks

### Phase 5: Very Complex Components
**Level 4 - Deep dependency chains**

These are the main feature components:
- **Message** - Core message display
- **MessageList** - Virtualized list (needs React Native FlatList)
- **NavMenu** - Main navigation
- **ChannelList** - Channel management
- **DirectMessageContactsList** - DM list

**Estimated Time**: 4-5 weeks

### Phase 6: Integration Components  
**Level 5 - Layout and coordination**

Final integration components:
- **Channel** - Main chat view
- **DirectMessage** - DM conversation view  
- **Layout** - Main app layout
- **ModalProvider** - Modal coordination

**Estimated Time**: 2-3 weeks

## Immediate Next Actions

### This Week - Ready to Build
Focus on completing **Level 1** components:

```bash
# Priority order for this week:
1. CloseButton (1-2 hours)
2. UserOnlineStateIndicator (1 hour)  
3. Loading (2-3 hours)
4. QuickReactionButton (2-3 hours)
5. ClickToCopyContent (3-4 hours)
```

### Key Patterns for Mobile Components

1. **File Structure**: Create `.native.tsx` versions alongside `.web.tsx`
2. **Styling**: Use React Native styling instead of SCSS
3. **Platform Detection**: Use `isNative()` from `src/utils/platform.ts`
4. **Primitives**: Always use primitives instead of raw HTML elements
5. **Business Logic**: Reuse existing hooks (already extracted)

### Dependencies to Watch

**Most Imported Components** (build these early):
- `SpaceIcon` - Used by 4+ components
- `ClickToCopyContent` - Used by 4+ components  
- All primitive components - Used by 50+ components

**Problematic Patterns**:
- SCSS dependencies (35 components) - Need different styling approach
- Platform-specific libraries (FontAwesome, react-virtuoso) - Need React Native alternatives

## Development Strategy

✅ **Advantages of This Approach:**
- No broken dependencies during development
- Each component can be tested independently
- Clear progress tracking
- Reuses shared business logic hooks

⚠️ **Considerations:**
- Some components may need platform-specific UX patterns (drawers vs hover menus)
- Virtualization libraries differ (react-virtuoso vs FlatList)
- Touch interactions vs mouse interactions

## Total Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 | ✅ Complete | - |
| Phase 2 | 1 week | 1 week |
| Phase 3 | 2-3 weeks | 3-4 weeks |
| Phase 4 | 3-4 weeks | 6-8 weeks | 
| Phase 5 | 4-5 weeks | 10-13 weeks |
| Phase 6 | 2-3 weeks | **12-16 weeks total** |

*Updated: 2025-08-09*