---
type: bug
title: DirectMessage Invite Loading Performance Issue
status: open
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# DirectMessage Invite Loading Performance Issue

## Problem

Space invites in DirectMessage conversations take a considerable time to load, creating poor UX when multiple invites are present in a conversation. Each invite triggers expensive cryptographic operations without any caching or optimization.

## Root Cause Analysis

### Cryptographic Operations Bottleneck

Each invite link triggers a chain of expensive operations in `src/components/context/MessageDB.tsx:4498-4579`:

1. **API call** to `getSpaceManifest(spaceId)`
2. **First decryption**: `ch.js_decrypt_inbox_message()` to decrypt space manifest
3. **Public key generation**: `ch.js_get_pubkey_x448()`
4. **Conditional second API call** to `getSpaceInviteEval()`
5. **Second decryption**: Another `ch.js_decrypt_inbox_message()` call
6. **Buffer operations**: Multiple hex/base64 conversions and JSON parsing

### No Caching Mechanism

Critical performance issues:
- Each invite is processed independently via `useInviteProcessing` hook
- No caching of decrypted space data
- No memoization for identical invite links
- Duplicate invites trigger full crypto chain every time

### Multiplicative Problem

In conversations with multiple invites:
- Each invite triggers the complete cryptographic processing chain
- No batching or rate limiting
- Parallel processing can overwhelm crypto operations
- Edge case becomes significant UX problem

## Impact

- **User Experience**: Slow loading of invite cards
- **Resource Usage**: Unnecessary crypto operations and API calls
- **Scalability**: Problem compounds with more invites per conversation

## Proposed Solutions

### 1. Implement Invite Cache (Quick Win)
```typescript
// In MessageDB context
const inviteCache = new Map<string, { space: Space; timestamp: number }>();

// In processInviteLink, check cache first
const cacheKey = `${spaceId}-${configKey}`;
const cached = inviteCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < 300000) { // 5 min TTL
  return cached.space;
}
```

### 2. Batch Processing
- Queue multiple invite processing requests
- Process in batches with rate limiting
- Prevent overwhelming crypto operations

### 3. Progressive Loading
- Show skeleton/loading state immediately
- Staggered timing for multiple invites (100ms delays)
- Prioritize visible invites first

### 4. Lazy Loading
- Only process invites when entering viewport
- Use intersection observer for trigger
- Ideal for conversations with many invites

### 5. Optimize Crypto Operations
- Move heavy crypto work to Web Workers
- Implement request deduplication
- Consider pre-warming commonly accessed invites

## Priority

**Medium-High** - While an edge case, it significantly impacts UX when encountered and the solution (caching) is straightforward to implement.

## Files Involved

- `src/components/message/InviteLink.tsx` - Invite component rendering
- `src/hooks/business/invites/useInviteProcessing.ts` - Invite processing hook
- `src/components/context/MessageDB.tsx:4498-4579` - Core crypto operations
- `src/components/direct/DirectMessage.tsx` - DirectMessage conversation view

---

*Analysis by: Claude Code investigation*
