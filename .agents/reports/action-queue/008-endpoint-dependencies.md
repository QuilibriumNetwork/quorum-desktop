# 008: Action Queue Endpoint Dependencies & Failure Modes

> **AI-Generated**: May contain errors. Verify before use.

**Purpose**: Quick reference for debugging when actions fail to persist

---

## Summary

The action queue processes tasks that depend on different server endpoints. When specific endpoints are slow or failing, only certain actions will be affected.

---

## Complete Action Type List

| Action Type | Category | Requires Private Key | Endpoint/Transport |
|-------------|----------|---------------------|-------------------|
| `send-channel-message` | Space | No | Hub (`sendHubMessage`) |
| `reaction` | Space | No | Hub (`sendHubMessage`) |
| `pin-message` | Space | No | Hub (`sendHubMessage`) |
| `unpin-message` | Space | No | Hub (`sendHubMessage`) |
| `edit-message` | Space | No | Hub (`sendHubMessage`) |
| `delete-message` | Space | No | Hub (`sendHubMessage`) |
| `send-dm` | DM | **Yes** | WebSocket (`sendDirectMessages`) |
| `reaction-dm` | DM | **Yes** | WebSocket (`sendDirectMessages`) |
| `delete-dm` | DM | **Yes** | WebSocket (`sendDirectMessages`) |
| `edit-dm` | DM | **Yes** | WebSocket (`sendDirectMessages`) |
| `save-user-config` | Global | **Yes** | `POST /settings` |
| `update-space` | Global | No | Space API |
| `kick-user` | Moderation | **Yes** | Space API |
| `mute-user` | Moderation | No | Space API |
| `unmute-user` | Moderation | No | Space API |

---

## Endpoint → Action Mapping

### `POST /settings` Endpoint

**Actions:**
- `save-user-config`

**What uses this:**
- Folder operations (create, rename, delete, reorder)
- Sidebar space ordering (drag-and-drop)
- User profile settings

### Hub (Triple Ratchet - Space Messages)

**Actions:**
- `send-channel-message`
- `reaction`
- `pin-message`
- `unpin-message`
- `edit-message`
- `delete-message`

**What uses this:**
- All space/channel messaging operations

### WebSocket (Double Ratchet - DMs)

**Actions:**
- `send-dm`
- `reaction-dm`
- `delete-dm`
- `edit-dm`

**What uses this:**
- All direct message operations

### Space API

**Actions:**
- `update-space`
- `kick-user`
- `mute-user`
- `unmute-user`

**What uses this:**
- Space settings changes
- Moderation actions

---

## Failure Symptoms by Endpoint

### `/settings` Endpoint Issues

**Symptoms:**
- Folder changes don't persist after refresh
- Sidebar order changes don't persist
- User profile/preferences changes lost
- Toast: "Failed to save settings"
- Network tab shows `/settings` requests taking 10+ seconds or being canceled

**Affected Actions:**
- `save-user-config` - used by:
  - `useUserSettings.ts` - User profile settings (display name, avatar, preferences)
  - `useFolderManagement.ts` - Folder create, rename
  - `useDeleteFolder.ts` - Folder delete
  - `useFolderDragAndDrop.ts` - Reorder folders, move spaces between folders
  - `useSpaceDragAndDrop.ts` - Reorder spaces in sidebar

**NOT Affected:**
- Space name/icon changes (uses Space API via `update-space`)
- Muting/unmuting users (uses Space API)
- Sending messages (uses Hub/WebSocket)

### Hub Issues (Space Messages)

**Symptoms:**
- Space messages fail to send (stuck in "sending" state)
- Reactions don't appear for other users
- Message edits/deletes don't sync
- Pins don't persist

**Affected Actions:**
- `send-channel-message`
- `reaction`
- `pin-message` / `unpin-message`
- `edit-message`
- `delete-message`

### WebSocket Issues (DMs)

**Symptoms:**
- DMs show as sent locally but never arrive at receiver
- DM reactions/edits/deletes don't sync
- Console shows "WebSocket send completed" but receiver never gets message

**Affected Actions:**
- `send-dm`
- `reaction-dm`
- `delete-dm`
- `edit-dm`

**Note:** If message persists for sender after refresh, the action queue worked correctly. Delivery issues are sync/WebSocket problems.

### Space API Issues

**Symptoms:**
- Space name/icon changes don't persist
- Kick/mute/unmute actions fail
- Toast: "Failed to save space settings" or "Failed to kick user"

**Affected Actions:**
- `update-space`
- `kick-user`
- `mute-user` / `unmute-user`

---

## Which Actions Need Private Keys?

Actions requiring private keys will fail if the keyset isn't available (e.g., auth issues):

| Requires Key | Actions |
|--------------|---------|
| **Yes** | `send-dm`, `reaction-dm`, `delete-dm`, `edit-dm`, `save-user-config`, `kick-user` |
| **No** | `send-channel-message`, `reaction`, `pin-message`, `unpin-message`, `edit-message`, `delete-message`, `update-space`, `mute-user`, `unmute-user` |

If keyset-requiring actions fail with "Keyset not available", check:
1. Is the user authenticated?
2. Did `setUserKeyset()` get called after auth?
3. Check console for `[ActionQueue] setUserKeyset called`

---

## Debugging Checklist

1. **Check Network Tab**
   - Which endpoint is slow/failing?
   - Are requests timing out or returning errors?

2. **Check Console Logs**
   - `[ActionQueue] enqueue` - Task was queued
   - `[ActionQueue:*] Fetching keyset` - Handler started (for key-requiring actions)
   - `[ActionQueue:*] ... successfully` - Handler completed

3. **Identify the Endpoint**
   - If `/settings` is slow → folder/config actions affected
   - If Hub issues → space message actions affected
   - If WebSocket issues → DM actions affected
   - If Space API issues → space settings/moderation affected

4. **Pre-existing vs New Issue**
   - Test at older commit (e.g., `e3457018`) to confirm if issue existed before
   - Check if non-action-queue features using same endpoint also fail

---

## Known Issues

### Browser Tab Crashes During Long Requests

**Symptom**: "Aw, Snap!" tab crash while waiting for `/settings` response

**Observed**: During testing, when `/settings` requests take 2+ minutes, the browser tab occasionally crashes.

**Possible Causes**:
- Memory pressure from pending operations
- WebAssembly (WASM) crash in crypto SDK
- IndexedDB transaction timeout

**To Debug**:
1. Open Chrome Task Manager (Shift+Esc) before testing - watch memory
2. Check `chrome://crashes` after crash
3. Note actions performed before crash

**Status**: Needs investigation - may be server performance related

---

## Historical Context

**2025-12-21**: During security fix implementation (007), discovered `/settings` endpoint was taking 10-22+ seconds per request, causing folder changes to fail. This was confirmed as a pre-existing server issue by testing at commit `e3457018` (before the fix). The action queue was working correctly; the bottleneck was the server endpoint.

**2025-12-21**: Further testing revealed `/settings` response times vary dramatically:
- Username changes: ~3 seconds
- Folder operations: ~2 minutes (same endpoint, same payload structure)
- Both eventually succeed if user waits long enough without refreshing

---

## Related

- [006-plaintext-private-keys-bug.md](006-plaintext-private-keys-bug.md)
- [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md)
- [Action Queue Feature](../../docs/features/action-queue.md)

---

_Created: 2025-12-21_
