---
type: task
title: Tombstone Cleanup Strategy for Deleted Messages
status: open
complexity: medium
ai_generated: true
created: 2025-12-18T00:00:00.000Z
updated: '2026-01-09'
---

# Tombstone Cleanup Strategy for Deleted Messages

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Related**: [deleted-messages-reappear-via-sync.md](../bugs/deleted-messages-reappear-via-sync.md)

## What & Why

The tombstone tracking system (DB_VERSION 7) prevents deleted messages from reappearing during peer sync. However, without cleanup, the `deleted_messages` table will grow unbounded over time.

**Current state**: Tombstones are never cleaned up
**Desired state**: Controlled tombstone growth with safe cleanup strategy
**Risk**: If tombstones are cleaned too aggressively, deleted messages can resurface when a stale peer syncs

### Storage Impact at Scale (Discord-like usage)

Each tombstone is ~100 bytes (messageId + spaceId + channelId + deletedAt timestamp).

**Assumptions**: ~100 message deletes/day/space average

#### Without Cleanup (Unbounded Growth)

| User Scale | Spaces | Daily Growth | Yearly Growth |
|------------|--------|--------------|---------------|
| Light user | 10 | 100KB/day | ~36MB/year |
| Moderate user | 100 | 1MB/day | ~365MB/year |
| Power user | 1,000 | 10MB/day | **~3.65GB/year** |
| Heavy user | 10,000 | 100MB/day | **~36.5GB/year** |
| Extreme | 100,000 | 1GB/day | **~365GB/year** |

#### With 30-Day Cleanup (Bounded)

| User Scale | Spaces | Max Storage |
|------------|--------|-------------|
| Light user | 10 | ~3MB |
| Moderate user | 100 | ~30MB |
| Power user | 1,000 | ~300MB |
| Heavy user | 10,000 | **~3GB** |
| Extreme | 100,000 | **~30GB** |

#### With 90-Day Cleanup (Bounded)

| User Scale | Spaces | Max Storage |
|------------|--------|-------------|
| Light user | 10 | ~9MB |
| Moderate user | 100 | ~90MB |
| Power user | 1,000 | ~900MB |
| Heavy user | 10,000 | **~9GB** |
| Extreme | 100,000 | **~90GB** |

**Conclusion**: Cleanup is **required** for production. The tradeoff is:
- **30 days**: Lower storage but higher zombie message risk for users offline >30 days
- **90 days**: Higher storage but very low zombie message risk

## Context

### How Sync Works

1. **sync-request**: A peer broadcasts asking "who has data to sync?"
2. **sync-info**: Peers respond with their message/member counts
3. **sync-initiate**: The requestor picks a sync partner
4. **sync-messages**: The sync partner sends ALL their messages from IndexedDB

**Critical insight**: Sync sends ALL messages from the sync partner's local DB - not just recent ones. If Client A has been offline for 60 days and still has a message in their DB, they will send it during sync.

### The Risk Matrix

| Scenario | Tombstone Status | Result |
|----------|------------------|--------|
| Client A syncs within retention period | Tombstone exists | ✅ Message blocked |
| Client A syncs after retention period | Tombstone cleaned | ❌ Message resurfaces |

## Implementation Options

### Option 1: No Cleanup (Current - SIMPLEST)

Keep tombstones forever.

**Pros**:
- Zero risk of message resurrection
- No additional code complexity
- Storage is cheap (~1MB per 10K deletes)

**Cons**:
- Unbounded growth (though slow)
- May become an issue for very active spaces over years

**Recommendation**: Good for MVP/initial release. Revisit if storage becomes a concern.

---

### Option 2: Clean Based on MESSAGE Age (SAFEST if cleanup needed)

Instead of "delete tombstones older than 30 days", use:
```typescript
// Clean tombstones where the ORIGINAL MESSAGE would be very old
// At that point, syncing peers are unlikely to still have the message
const MESSAGE_AGE_THRESHOLD = 90 * 24 * 60 * 60 * 1000; // 90 days

async cleanOldTombstones(): Promise<number> {
  const threshold = Date.now() - MESSAGE_AGE_THRESHOLD;
  // Delete tombstones for messages older than 90 days
  // Logic: If a message is 90+ days old, peers probably don't have it
}
```

**Pros**:
- Safer than tombstone-age-based cleanup
- Peers unlikely to have ancient messages anyway
- Reasonable storage bounds

**Cons**:
- Still has edge case: archival peer with old messages
- Requires tracking original message timestamp (not currently stored in tombstone)

**Implementation note**: Would need to add `messageCreatedAt` to `DeletedMessageRecord` interface.

---

### Option 3: Limit by Count per Channel

Keep the most recent N tombstones per channel:
```typescript
const MAX_TOMBSTONES_PER_CHANNEL = 500;

async cleanExcessTombstones(spaceId: string, channelId: string): Promise<void> {
  // Count tombstones for this channel
  // If > MAX, delete oldest ones
}
```

**Pros**:
- Predictable storage growth per channel
- Simple to implement using existing `by_space_channel` index

**Cons**:
- High-activity channels might clean important tombstones
- Low-activity channels might keep ancient tombstones

---

### Option 4: Sync Tombstones Between Peers (PROPER but COMPLEX)

When receiving `sync-messages`, also send back tombstones:
```typescript
// In sync-messages handler:
// 1. Process incoming messages (current behavior)
// 2. Collect local tombstones for this space
// 3. Send "sync-tombstones" control envelope back
// 4. Receiving peer deletes those messages from their DB
```

**Pros**:
- Propagates deletes through the network
- Eventually consistent deletion
- Allows aggressive local cleanup

**Cons**:
- Requires new control envelope type (`sync-tombstones`)
- More network traffic
- Complex implementation
- Needs security consideration (who can tell you to delete messages?)

---

### Option 5: Hybrid Approach

Combine options for safety:
1. Keep all tombstones for first 30 days (no cleanup)
2. After 30 days, apply count-based limit per channel
3. After 90 days, clean based on message age

```typescript
async cleanTombstones(): Promise<void> {
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

  // Phase 1: Never touch tombstones < 30 days old
  // Phase 2: For 30-90 day tombstones, apply count limit per channel
  // Phase 3: For > 90 day tombstones, clean if message would be ancient
}
```

## Files to Modify

| File | Changes |
|------|---------|
| [messages.ts](../../src/db/messages.ts) | Add cleanup method(s), possibly update `DeletedMessageRecord` |
| [MessageService.ts](../../src/services/MessageService.ts) | Periodic cleanup trigger (on app start or interval) |

## Decision Criteria

When deciding which option to implement, consider:

1. **How active are spaces?** High-volume spaces need cleanup eventually
2. **How long do users stay offline?** Longer = need longer retention
3. **Storage constraints?** Mobile users may care more
4. **Implementation time available?** Option 1 (none) is free

## Verification

When implemented:
- [ ] Delete a message, verify tombstone created
- [ ] Wait for cleanup trigger (or simulate time)
- [ ] Verify old tombstones cleaned appropriately
- [ ] Simulate stale peer sync - message should NOT resurface if within retention
- [ ] TypeScript compiles: `npx tsc --noEmit`

## Definition of Done

- [ ] Cleanup strategy selected and documented
- [ ] Implementation complete per chosen option
- [ ] Edge cases tested (stale peer sync)
- [ ] Storage growth verified as bounded
- [ ] Bug report updated with final solution

---
