---
type: task
title: Mobile/Desktop Behavioral Differences Audit Plan
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Mobile/Desktop Behavioral Differences Audit Plan

## Objective

Systematically audit the codebase to identify elements that behave differently between desktop and mobile platforms, and categorize them for potential extraction into platform-specific primitive components.

## Instructions for Claude Code

### Phase 1: Repository Analysis

1. **Scan all React components** (.tsx, .jsx files) in the `src/` directory
2. **Identify interactive elements** that may have different behaviors on mobile vs desktop
3. **Analyze CSS/SCSS files** for responsive patterns and media queries
4. **Document current responsive patterns** and behavioral differences

### Phase 2: Element Classification

For each identified element, categorize using this decision tree:

#### A. Visual-Only Differences (CSS/SCSS)

- Elements that only change size, spacing, or colors
- Responsive design handled purely through media queries
- **Action**: Keep as-is, no extraction needed

#### B. Interaction Differences (Primitive Candidates)

- Elements with hover states vs touch states
- Different event handlers (click vs long-press)
- Platform-specific user interactions
- **Action**: Extract to platform-specific primitive components

#### C. Layout Rearrangement (Layout Component Candidates)

- Elements that change position or structure
- Components that show/hide different child elements
- Different arrangements of the same content
- **Action**: Extract to platform-specific layout components

#### D. Complex Behavioral Differences (Business Logic)

- Components with fundamentally different state management
- Different workflows or user flows
- **Action**: Consider platform-specific business logic components

### Phase 3: Specific Patterns to Look For

#### Input/Form Elements

- [ ] Text inputs and textareas (expansion behavior)
- [ ] File upload interfaces
- [ ] Form layouts and button arrangements
- [ ] Search inputs and their associated controls

#### Navigation/Interaction Elements

- [ ] Menu systems (hover menus vs touch menus)
- [ ] Sidebar behaviors (slide vs fixed)
- [ ] Modal/drawer positioning and sizing
- [ ] Context menus and action sheets

#### Layout Components

- [ ] Header/toolbar arrangements
- [ ] Content containers that stack vs inline
- [ ] Grid/list view toggles
- [ ] Chat/message interfaces

#### Visual Feedback Elements

- [ ] Tooltip systems
- [ ] Loading states and spinners
- [ ] Hover effects and focus states
- [ ] Touch target sizing

### Phase 4: Audit Output Format

Create an audit file (`MOBILE_DESKTOP_AUDIT.md`) with the following structure:

````markdown
# Mobile/Desktop Behavioral Differences Audit

## Summary

- Total components analyzed: X
- Visual-only differences: X
- Interaction differences (primitive candidates): X
- Layout differences (layout component candidates): X
- Complex behavioral differences: X

## High Priority Extractions

### Message Input System

- **File**: `src/components/Channel.tsx` (lines X-Y)
- **Current behavior**: [describe current implementation]
- **Desktop UX**: [describe desktop behavior]
- **Mobile UX**: [describe needed mobile behavior]
- **Extraction type**: Layout component + primitives
- **Impact**: High (core user interaction)

## Medium Priority Extractions

[Similar format for medium priority items]

## Low Priority Extractions

[Similar format for low priority items]

## Visual-Only Changes (No Extraction Needed)

[List items that only need CSS updates]

## Detailed Analysis

### Component: [ComponentName]

**File**: `path/to/component.tsx`
**Lines**: X-Y
**Current Implementation**:

```tsx
[relevant code snippet]
```
````

**Desktop Behavior**: [description]
**Mobile Behavior Needed**: [description]
**Recommended Action**: [Extract to primitive/layout/keep as-is]
**Dependencies**: [other components affected]
**Effort Estimate**: [Small/Medium/Large]

### Phase 5: Prioritization Criteria

Rank each identified difference by:

1. **User Impact** (High/Medium/Low)
   - How frequently users interact with this element
   - How different the mobile experience should be

2. **Implementation Complexity** (Small/Medium/Large)
   - How much code needs to be extracted
   - How many other components are affected

3. **Platform Benefit** (High/Medium/Low)
   - How much better the mobile experience would be
   - How much this helps with the native app architecture

### Phase 6: Implementation Roadmap

Create a suggested implementation order:

1. **Quick Wins**: High impact, low complexity
2. **Foundation**: Components that other extractions depend on
3. **Major Features**: High impact, high complexity
4. **Polish**: Medium/low impact improvements

## Specific Files to Analyze

### Core Components

- `src/components/Channel.tsx` (message interface)
- `src/components/message/MessageList.tsx` (message display)
- `src/components/search/GlobalSearch.tsx` (search interface)
- Any sidebar/navigation components

### Layout Components

- Components handling responsive layout
- Modal and drawer implementations
- Header/toolbar components

### Interactive Elements

- Button implementations
- Form inputs and controls
- Context menus and action sheets

## Expected Deliverables

1. **`MOBILE_DESKTOP_AUDIT.md`** - Comprehensive audit file
2. **Implementation roadmap** with priority order
3. **Effort estimates** for each extraction
4. **Dependency map** showing which components affect others
5. **Quick win opportunities** for immediate improvement

## Success Criteria

The audit should identify:

- All elements requiring platform-specific behavior
- Clear categorization of extraction types needed
- Realistic implementation timeline
- Dependencies between components
- Immediate opportunities for improvement

This audit will serve as the foundation for implementing Cassie's two-layer architecture with platform-specific primitives and shared business logic.
