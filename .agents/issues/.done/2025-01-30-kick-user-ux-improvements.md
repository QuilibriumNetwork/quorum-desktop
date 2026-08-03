---
type: bug
title: Kick User UX Improvements
status: done
created: 2025-01-30T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
related_issues:
  - '#62'
---

# Kick User UX Improvements

Added to GitHub Issues: https://github.com/QuilibriumNetwork/quorum-desktop/issues/62

## Status: Partially Implemented - UI Blocking Issue Remains

## Problem Statement

The current kick user experience has poor UX during the 3-5 second operation:

- App appears frozen during kick operation
- No visual feedback indicating progress
- User unsure if operation is working
- Modal doesn't auto-close after success
- Success message appears in chat but user might miss it

## Implemented Solution (2025-09-16)

### ✅ Successfully Added: Modal Save Overlay System

**1. KickUserModal.tsx Changes:**

- Added `useModalSaveState` hook with `saveUntilComplete` pattern
- Added `ModalSaveOverlay` component with "Kicking..." message
- Modal close mechanisms disabled during kick operation (ESC, backdrop clicks)
- Auto-closes modal after kick completion
- Minimum 3-second overlay display time for proper user feedback

**2. Files Modified:**
- `src/components/modals/KickUserModal.tsx` - Integrated modal save overlay system
- `src/hooks/business/user/useUserKicking.ts` - Exposed `kickUserFromSpace` function

**3. Current Flow:**
1. "Kick!" → "Click again to confirm"
2. "Kicking..." overlay appears with spinner
3. Kick operation executes (3-5 seconds)
4. Modal auto-closes after minimum 3 seconds
5. "User has been kicked" message appears in chat (~5 seconds later)

## ⚠️ Remaining Issue: Complete UI Blocking

### Problem Analysis

**Root Cause:** The entire UI freezes for ~5-8 seconds during kick operations due to `enqueueOutbound` queue processing heavy cryptographic operations on the main thread:

- Key generation (`ch.js_generate_x448()`)
- Digital signing (`ch.js_sign_ed448()`)
- Encryption operations (`ch.js_encrypt_inbox_message()`)
- Network API calls
- IndexedDB operations

**Impact:**
- Admin cannot navigate, send messages, or interact with UI during kick
- Unlike Discord/modern apps which keep UI responsive during user operations
- Affects overall user experience despite improved modal feedback

## Potential Solutions for UI Blocking

### 1. Web Workers (Optimal Solution)
- Move heavy cryptographic operations to background threads
- Keep main UI thread responsive during kick operations
- Requires refactoring MessageDB crypto operations

### 2. Chunked Processing
- Break crypto operations into smaller chunks with `setTimeout` delays
- Allow UI to remain interactive between chunks
- Less optimal but easier to implement

### 3. Progressive Enhancement
- Show detailed progress steps: "Preparing..." → "Generating keys..." → "Updating manifest..."
- Better user feedback even if UI remains blocked
- Minimal implementation effort

### 4. Targeted Operation Blocking
- Only disable conflicting operations (space management, concurrent kicks)
- Allow navigation, messaging, and reading to continue
- More complex state management required

## Related Issues

### UserProfile "Kick User" Button State
After a user is kicked, the UserProfile still shows an enabled "Kick User" button. Should show disabled state with "Kicked!" text.

**Challenge:** Detecting kicked users efficiently without performance issues when spaces have 1K-10K members. Requires optimization of member lookup logic.

## Priority: Medium-High

- Functional kick system works correctly
- UI blocking affects admin productivity during member management
- Modern chat applications don't exhibit this behavior

---


**Affects**: Admin user experience during kick operations
