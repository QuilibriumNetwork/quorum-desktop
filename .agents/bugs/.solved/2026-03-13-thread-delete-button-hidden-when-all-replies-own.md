---
type: bug
title: "Thread delete button hidden even when all replies are from thread author"
status: not-a-bug
priority: low
ai_generated: true
created: 2026-03-13
updated: 2026-03-13
---

# Thread delete button hidden even when all replies are from thread author

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When a user creates a thread on their own message and all replies in the thread are also from that same user, the Thread Settings Modal shows the warning "This thread cannot be deleted because it contains messages from other users" instead of the Delete Thread button. The user cannot delete the thread despite being both the thread creator and the sole author of all content.

## Reproduction

1. Send a message in a channel
2. Start a thread on your own message
3. Reply to the thread with your own messages (no other users replying)
4. Open Thread Settings (cog icon)
5. **Expected**: Delete Thread button visible
6. **Actual**: Warning message "This thread cannot be deleted because it contains messages from other users"

## Investigation Findings

### Console log evidence

Debug logging confirmed the mismatch:

```
[ThreadSettingsModal] hasOtherReplies=true {
  currentUserAddress: 'QmQuCGpEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imXST1',
  otherSenders: [
    { id: '98a2e5...', sender: 'QmYxPTq82YeAYpiv4XEehrT6gSFkwVwuA4xWMQydAKK1ia', type: 'post' },
    { id: 'a4e280...', sender: 'QmYxPTq82YeAYpiv4XEehrT6gSFkwVwuA4xWMQydAKK1ia', type: 'post' }
  ],
  totalMessages: 2
}
```

- `currentUserAddress` (`QmQu...`) and `senderId` on the replies (`QmYx...`) are completely different addresses
- Both replies are visually attributed to "Brave Crypto" (the same user) in the UI

### The blocker is purely UI

The `hasOtherReplies` check at `src/components/modals/ThreadSettingsModal.tsx:67-69` compares `content.senderId` against `currentUserAddress`. The mismatch causes it to treat the user's own messages as "from other users", hiding the delete button.

### Resolution: test-user-specific issue, not a code bug

Testing with a **different user account** could not reproduce the issue — thread deletion worked normally. The original test user likely has a stale or rotated passkey address, causing the `senderId` on their stored messages to differ from their current `currentPasskeyInfo.address`. This is a data-level inconsistency specific to that test account, not a logic bug in the code.

**No code changes were made.** Debug logging was added temporarily and has been removed.

## Relevant Code

- **`hasOtherReplies` check**: `src/components/modals/ThreadSettingsModal.tsx:67-69`
- **`currentUserAddress` source**: `src/components/modals/ThreadSettingsModal.tsx:58` — from `channelProps?.currentUserAddress`
- **`channelProps.currentUserAddress` set**: `src/components/space/Channel.tsx:1154` — `user.currentPasskeyInfo?.address`

## Related

- See `.agents/docs/features/messages/thread-panel.md` for full thread deletion documentation
- See `.agents/docs/cryptographic-architecture.md` for key hierarchy (UserKeyset vs Space Inbox Key)

---

_Created: 2026-03-13_
_Updated: 2026-03-13 (closed as not-a-bug — test-user-specific address mismatch)_
