# Enhance Markdown Renderer Fallback System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: Medium-Low
**Created**: 2025-11-19
**Files**:
- `src/components/message/Message.tsx:728-852` (routing + token rendering to be extracted)
- `src/components/message/MessageTokenRenderer.tsx` (new component to be created)
- `src/hooks/business/messages/useMessageFormatting.ts:152-213` (processTextToken)
- `src/utils/markdownStripping.ts` (existing smart stripping utilities)
- `src/components/message/InviteLink.tsx` (props interface)

## What & Why
**Current State**: Dual rendering system with markdown renderer (primary) and token-based fallback (original system - actually works well!)
**Desired State**: Polish the few remaining UX gaps in the fallback system for smooth emergency operation
**Value**: Ensures graceful degradation when markdown must be disabled for security or space owner preferences

## Current Fallback System Status (VERIFIED WITH TESTING)

### ✅ What Actually Works (Confirmed by Testing):
1. **User Mentions**: `@[Username]<userkey>` → ✅ renders as `@Username` with proper styling
2. **Role Mentions**: `@roleTag` → ✅ renders with proper styling (validated against space roles)
3. **@everyone Mentions**: `@everyone` → ✅ renders with proper styling (permission-based)
4. **YouTube Embeds**: All YouTube URLs → ✅ interactive video embeds (always embeds, but acceptable)
5. **Link Rendering**: HTTP/HTTPS URLs → ✅ clickable links with truncation
6. **Invite Links**: Invite URLs → ✅ renders invite cards (no smart button logic but functional)
7. **Image/GIF Attachments**: ✅ Full support via embed content type
8. **Basic Message Display**: ✅ Plain text messages work perfectly

### ❌ What's Actually Broken (Confirmed by Testing):
1. **Channel Mentions**: `#[channel name]<channelId>` → ❌ **NOT RENDERED** (backend parsing issue when markdown disabled)
2. **Markdown Syntax Display**: `**bold**` → ❌ shows literally instead of being stripped

### ⚠️ Root Cause Analysis:
**Channel Mention Failure**: Backend inconsistently populates `message.mentions` when markdown disabled:
- ✅ Populates `userIds`, `roleIds`, `everyone` (these mentions work)
- ❌ **Fails to populate `channelIds`** (breaks channel mention detection)
- Frontend token system has correct rendering logic but depends on backend parsing

### 📝 Verification Test Results:
✅ **User mentions**: `@[Username]<address>` render correctly
❌ **Channel mentions**: `#[General]<channelId>` show as plain text
✅ **Role mentions**: `@moderator` render with styling
✅ **@everyone**: `@everyone` renders with styling
✅ **YouTube embeds**: Always create embeds (acceptable behavior)
✅ **Links**: `https://example.com` become clickable
✅ **Invite links**: Show invite cards
❌ **Markdown**: `**bold**` shows literally

## Context
- **Existing pattern**: Dual system in Message.tsx with ENABLE_MARKDOWN feature flag
- **Constraints**: Must preserve all critical features (mentions, links, embeds) without markdown
- **Dependencies**: Existing markdownStripping.ts utilities, mention notification system
- **Security consideration**: Fallback needed for emergency markdown disabling

## Prerequisites
- [ ] ✅ **Verify current fallback functionality** using verification tests above
- [ ] Review related documentation in .agents/docs/ for architectural context
- [ ] Feature analyzed by feature-analyzer agent (completed - system is solid)
- [ ] Branch created from `develop`
- [ ] No conflicting PRs

## Implementation (Based on Verified Gaps)

### Task 0: Extract Token Renderer Component (Priority: ARCHITECTURAL)
**Goal**: Create symmetrical architecture - both renderers as separate components

- [ ] **Create MessageTokenRenderer component** (`src/components/message/MessageTokenRenderer.tsx`)
  - Done when: New component file created with proper TypeScript interface
  - Verify: Component exports MessageTokenRenderer function and Props interface
  - Reference: `MessageMarkdownRenderer.tsx` structure for consistency

- [ ] **Move token rendering logic** (from `Message.tsx:750-852` to new component)
  - Done when: All token processing logic moved to MessageTokenRenderer
  - Verify: Lines 750-852 removed from Message.tsx, logic preserved in new component
  - Implementation: Copy content rendering loop and all token type handling

- [ ] **Update Message.tsx routing** (`Message.tsx:728-748`)
  - Done when: Clean renderer selection with both systems as separate components
  - Verify: Message.tsx now has symmetrical `<MessageMarkdownRenderer>` vs `<MessageTokenRenderer>`
  - Implementation: Replace inline token logic with component call

- [ ] **Verify functional equivalence**
  - Done when: Both rendering systems work identically before and after extraction
  - Verify: All verified working features still work (user mentions, links, YouTube, etc.)
  - Test: Switch between `ENABLE_MARKDOWN = true/false` - no functional changes

### Task 1: Frontend Channel Mention Detection (Priority: CRITICAL)
**Problem**: Backend stops populating `message.mentions.channelIds` when markdown disabled
**Note**: After Task 0, implement in `MessageTokenRenderer.tsx` instead of `Message.tsx`

- [ ] **Add frontend channel detection** (`useMessageFormatting.ts:191-213`)
  - Done when: Channel mentions detected even without backend `message.mentions.channelIds`
  - Verify: `#[General]<channelId>` renders as `#General` with styling and click navigation
  - Implementation: Bypass `message.mentions.channelIds.includes(channelId)` requirement for token system
  - Reference: User mention detection logic (lines 152-169) which works independently

- [ ] **Validate channel exists in spaceChannels** (`useMessageFormatting.ts:200`)
  - Done when: Channel validation works without depending on backend mention parsing
  - Verify: Only valid channels render as mentions, invalid ones remain plain text
  - Implementation: Keep existing `spaceChannels.find()` validation

### Task 2: Smart Markdown Stripping (Priority: HIGH)
**Problem**: Raw markdown syntax shows literally in fallback mode
**Note**: After Task 0, implement in `MessageTokenRenderer.tsx` instead of `Message.tsx`

- [ ] **Import markdown stripping utilities** (`MessageTokenRenderer.tsx`)
  - Done when: `markdownStripping.ts` utilities imported in new component
  - Verify: Import statement added and TypeScript compiles
  - Reference: Existing usage patterns in codebase

- [ ] **Add pre-processing before token generation** (`MessageTokenRenderer.tsx`)
  - Done when: Raw markdown syntax stripped before `useMessageFormatting.processTextToken()`
  - Verify: `**bold**` becomes `bold`, `*italic*` becomes `italic` in fallback mode
  - Implementation: Use smart stripping method (preserves intent, removes syntax)

### Task 3: User Mention Click Handlers (Priority: OPTIONAL)
**Enhancement**: Add profile modal clicks to match channel mention behavior
**Note**: After Task 0, implement in `MessageTokenRenderer.tsx` instead of `Message.tsx`

- [ ] **Add click handlers for user mentions** (in `MessageTokenRenderer.tsx`)
  - Done when: User mentions in token system call `onUserClick()` like markdown system
  - Verify: Clicking mention opens user profile modal in fallback mode
  - Reference: Channel mention click implementation (will be in same component after Task 0)

- [ ] **Add interactive styling** (in `MessageTokenRenderer.tsx`)
  - Done when: Interactive class added for user mentions to match channel mentions
  - Verify: Mention appearance consistent and shows interactive cursor
  - Reference: Channel mention styling `message-name-mentions-you interactive`

### Task 4: InviteLink Props Enhancement (Priority: OPTIONAL)
**Enhancement**: Smart button logic for self-sent invites
**Note**: After Task 0, implement in `MessageTokenRenderer.tsx` instead of `Message.tsx`

- [ ] **Add missing context props** (in `MessageTokenRenderer.tsx`)
  - Done when: `messageSenderId` and `currentUserAddress` props passed to InviteLink
  - Verify: Self-sent invite detection works correctly in fallback mode
  - Reference: Markdown system usage in `MessageMarkdownRenderer.tsx:550-560`

## Pre-Implementation Verification (COMPLETED)
**Tested fallback state with `ENABLE_MARKDOWN = false` in `src/config/features.ts`**

✅ **Baseline Functionality Tests Results**
- [x] ✅ **User mentions**: `@[TestUser]<userAddress>` → renders as `@TestUser` with styling
- [x] ❌ **Channel mentions**: `#[test-channel]<channelId>` → shows as plain text (BROKEN)
- [x] ✅ **Role mentions**: `@moderator` → renders with proper styling
- [x] ✅ **YouTube embeds**: YouTube URLs → show interactive video embeds (always embeds)
- [x] ✅ **Links**: `https://example.com` → clickable links with truncation
- [x] ✅ **Invite links**: Invite URLs → show invite cards (no smart button logic)
- [x] ❌ **Markdown syntax**: `**bold** and *italic*` → shows literally (NEEDS STRIPPING)

## Post-Implementation Verification
✅ **Enhanced functionality after tasks complete**
- [ ] **Channel mentions**: `#[General]<channelId>` renders as `#General` with styling and navigation
- [ ] **Markdown stripping**: Message with `**bold** *italic*` displays as `bold italic`
- [ ] **User mention clicks**: Clicking user mentions opens profile modal (optional)
- [ ] **InviteLink context**: Self-sent invites show correct button state (optional)
- [ ] **TypeScript compiles**: Run `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] **No regression**: ENABLE_MARKDOWN=true continues working normally
- [ ] **Mobile compatible**: All touch interactions work on mobile devices

## Definition of Done
- [x] ✅ Pre-implementation verification completed with actual testing
- [ ] **Critical tasks complete**: Channel mention detection + markdown stripping
- [ ] **Optional tasks complete** (if implemented): User clicks + invite props
- [ ] All post-implementation verification tests pass
- [ ] No console errors in either rendering mode
- [ ] Both rendering systems maintain security properties
- [ ] Task updated with final implementation learnings

## Implementation Notes

### Pre-Implementation Discoveries:
- **Token system much more solid than expected**: 6/8 core features work perfectly
- **Channel mention backend issue identified**: Backend inconsistently parses mentions when markdown disabled
- **Root cause confirmed**: Frontend logic is correct but depends on missing backend data
- **Testing revealed**: User/role/@everyone mentions work, only channels affected
- **Architecture insight**: Original token system was actually well-designed, just needs channel mention bypass

### Implementation Strategy:
- **Bypass backend dependency**: Detect channels directly in frontend for token system
- **Preserve existing validation**: Keep spaceChannels validation for security
- **Minimal changes needed**: Most functionality already works correctly

---

_Created: 2025-11-19_