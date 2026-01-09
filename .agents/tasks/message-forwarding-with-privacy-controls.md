---
type: task
title: Implement Message Forwarding with Privacy Controls
status: in-progress
complexity: high
ai_generated: true
created: 2025-11-16T00:00:00.000Z
updated: '2026-01-09'
---

# Implement Message Forwarding with Privacy Controls

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/api/quorumApi.ts` - Message type definitions and Space forwarding property
- `src/services/MessageService.ts` - Forwarding logic
- `src/components/message/MessageActions.tsx` - Forward button
- `src/components/message/ForwardModal.tsx` - New component
- `src/components/message/Message.tsx` - Render forwarded messages
- `src/components/space/SpaceSettings.tsx` - Forwarding control setting

## What & Why

**Current State**: Users can only copy message text manually to share content from one conversation to another, losing attribution and context.

**Desired State**: Users can forward messages between conversations with explicit space-level forwarding controls that give space administrators direct control over content sharing policies.

**Value**: Enables efficient content sharing while providing clear, administrator-controlled privacy boundaries that respect space-specific forwarding policies.

## Context
- **Existing pattern**: Messages use end-to-end encryption with context-specific keys (DM vs Space)
- **Discovery**: Current space privacy model is invitation-based, not binary public/private
- **Solution**: Add explicit space-level forwarding controls for administrator clarity
- **Dependencies**: Leverages existing MessageService encryption/submission pipeline

## Prerequisites
- [ ] Review .agents documentation: INDEX.md, AGENTS.md, and agents-workflow.md for context
- [ ] Check existing tasks in .agents/tasks/ for similar patterns and solutions
- [ ] Review related documentation in .agents/docs/ for architectural context
- [ ] Feature analyzed by feature-analyzer agent for complexity and best practices
- [ ] Security analysis by security-analyst agent (involves encryption, privacy, and user data)
- [ ] Branch created from `develop`
- [ ] No conflicting PRs

## Forwarding Rules (Space-Level Control)
**Administrator-controlled forwarding with explicit consent:**
- ✅ **Same Space/DM**: Always allowed (same audience)
- ✅ **Space with `allowExternalForwarding: true`**: Allow external forwarding
- ❌ **Space with `allowExternalForwarding: false`**: Block external forwarding
- ❌ **DM → Different DM**: Blocked (protects conversation privacy)
- 🔧 **Default**: New spaces have `allowExternalForwarding: false` (opt-in model)

## Implementation

### Phase 1: Type Definitions and Data Model
- [ ] **Add allowExternalForwarding to Space type** (`src/api/quorumApi.ts:27`)
  - Done when: Property added with optional boolean type, defaults to false
  - Verify: TypeScript compiles without errors
  - Reference: Follow pattern of existing Space optional properties

- [ ] **Add ForwardedMessage type** (`src/api/quorumApi.ts:240`)
  - Done when: Type includes original sender, context, and forwarded timestamp
  - Verify: TypeScript compiles without errors
  - Reference: Follow pattern of existing message content types

- [ ] **Update Message union type** (`src/api/quorumApi.ts:96`)
  - Done when: ForwardedMessage included in content union
  - Verify: All message rendering components still compile
  - Reference: Follow pattern of other message content types

### Phase 2: Forwarding Control Logic (requires Phase 1)
- [ ] **Add forwarding validation** (`src/services/MessageService.ts`)
  - Done when: canForwardMessage() function checks space.allowExternalForwarding setting
  - Verify: Blocked forwarding shows clear error: "Message forwarding is disabled for this space"
  - Reference: Follow pattern of existing message validation in MessageService

- [ ] **Add space settings UI** (`src/components/space/SpaceSettings.tsx`)
  - Done when: Checkbox for "Allow members to forward messages outside this space"
  - Verify: Setting saves to space data and updates in real-time
  - Reference: Follow pattern of existing space setting toggles

### Phase 3: Core Forwarding Logic (requires Phase 2)
- [ ] **Implement forwardMessage method** (`src/services/MessageService.ts`)
  - Done when: Creates new ForwardedMessage with proper encryption for target context
  - Verify: Forwarded messages appear correctly in target conversation
  - Reference: Use existing submitMessage/submitChannelMessage for encryption

### Phase 4: UI Components (requires Phase 1-3)
- [ ] **Add Forward button** (`src/components/message/MessageActions.tsx`)
  - Done when: Forward option appears in message context menu
  - Verify: Button only shows for forwardable messages
  - Reference: Follow pattern of existing actions like Pin, Delete

- [ ] **Create ForwardModal component** (`src/components/message/ForwardModal.tsx`)
  - Done when: Modal shows destinations filtered by space forwarding settings
  - Verify: Messages from spaces with disabled forwarding only show same-space destinations
  - Reference: Follow modal pattern from existing components

- [ ] **Update Message rendering** (`src/components/message/Message.tsx`)
  - Done when: Forwarded messages display with proper attribution
  - Verify: Shows "Forwarded from [User] • [Time]" with original content
  - Reference: Follow pattern of reply message rendering

## Verification
✅ **Space forwarding controls enforced**
   - Test: Forward from space with disabled forwarding → blocked with clear error message
   - Test: Forward from space with enabled forwarding → succeeds to external destinations
   - Test: Forward within same space → always succeeds regardless of setting
   - Test: Try forwarding DM to different DM → blocked with error

✅ **Space settings functionality**
   - Test: Toggle forwarding setting in space settings → saved and applied immediately
   - Test: Space admins can access forwarding controls
   - Test: Setting defaults to disabled for new spaces

✅ **Forwarded messages render correctly**
   - Test: Forwarded message shows original sender attribution
   - Test: Forwarded message shows forwarding timestamp
   - Test: Original message content preserved exactly

✅ **Encryption works correctly**
   - Test: Forwarded DM message is encrypted for recipient
   - Test: Forwarded space message is encrypted with space keys
   - Test: Recipients can decrypt forwarded messages normally

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **Mobile compatible**
   - Test: Forward modal works on mobile screen sizes
   - Test: Forward button accessible on touch devices

## Definition of Done
- [ ] All phases complete
- [ ] All verification tests pass
- [ ] No console errors
- [ ] Space forwarding controls working correctly
- [ ] Space settings UI allows administrators to control forwarding
- [ ] Default forwarding disabled for new spaces (opt-in model)
- [ ] Clear error messages when forwarding is blocked
- [ ] Documentation updated explaining forwarding controls
- [ ] Task updated with implementation learnings

## Privacy Considerations
**Critical**: This feature respects space administrator intent and never leaks content against explicit policies. The space-level control approach provides clear privacy protection by:
- Giving space administrators explicit control over content sharing policies
- Defaulting to disabled forwarding for new spaces (conservative approach)
- Maintaining conversation boundaries for DMs (never cross-forward between different DMs)
- Preserving end-to-end encryption for all forwarded content
- Providing clear user feedback when forwarding is restricted

## Architecture Benefits
**Space-Level Control Advantages**:
- **Clear Administrator Intent**: No ambiguity about forwarding policies
- **Flexible Privacy Models**: Public spaces can restrict forwarding, private spaces can allow it
- **User Transparency**: Clear indication of forwarding rules and restrictions
- **Migration Friendly**: Existing spaces default to disabled (conservative), administrators opt-in
- **Simple Logic**: No complex inference about space "privacy" - explicit setting controls behavior

## Future Enhancements
After core implementation, consider:
- **Role-based forwarding permissions**: Allow specific roles to control forwarding
- **Granular forwarding controls**: Separate controls for DMs vs other spaces
- **Forwarding audit logs**: Track forwarding activity for space administrators
- **Bulk forwarding settings**: Apply settings across multiple spaces
- **Forwarding notifications**: Notify when messages are forwarded (optional setting)

## Updates

### 2025-11-16 - Space-Level Control Approach
- **Discovery**: Current space privacy model is invitation-based, not binary public/private
- **Solution Change**: Replaced inferred privacy rules with explicit space-level `allowExternalForwarding` setting
- **Benefits**: Clear administrator control, flexible privacy models, better user transparency
- **Implementation**: Added space settings UI and simplified forwarding validation logic

---
