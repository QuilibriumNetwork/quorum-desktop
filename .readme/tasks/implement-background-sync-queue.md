# Implement Background Sync Queue for User Settings and Async Operations

[← Back to INDEX](/.readme/INDEX.md)

## Problem Statement

The UserSettingsModal save operation has critical scalability issues that make it unusable for users with many spaces. Every profile save triggers database queries proportional to the number of spaces, causing save times to increase linearly (O(n) complexity). Current implementation takes ~8 seconds for 4 spaces and could exceed 30 seconds for power users with 20+ spaces.

## Current Architecture Issues

### 1. Linear Database Queries
- Each space requires 2 database calls: `getSpaceKeys()` + `getEncryptionStates()`
- 30 spaces = 60 database queries per save operation
- Even with parallel execution, significant I/O overhead remains

### 2. Monolithic Payload Growth
- Encrypted config includes ALL space keys and encryption states
- Payload size grows with each additional space
- Memory usage increases exponentially

### 3. API Performance Bottleneck
- `postUserSettings` API call takes 7-8 seconds minimum
- Network latency compounds with larger payloads
- No incremental update capability

### 4. All-or-Nothing Sync Model
- ANY profile change forces complete re-sync of ALL space data
- No differentiation between profile updates and space updates
- Blocks UI during entire operation

## Proposed Solution: Generic Background Sync Queue

Implement Tyler's proposed background sync queue that:
1. Captures actions with context and adds to offline queue
2. Frees UI immediately for user interaction
3. Processes queue in background with proper error handling
4. Provides toast notifications for success/failure

### Database Schema

```typescript
interface QueueTask {
  id: number; // auto-increment
  taskType: TaskType;
  context: any; // JSON data specific to task
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  createdAt: number;
  processedAt?: number;
  error?: string;
}

type TaskType = 
  | 'update-profile'
  | 'send-message'
  | 'delete-message'
  | 'save-user-config'
  | 'sync-space-keys'
  | 'join-space'
  | 'leave-space';
```

## Implementation Strategy

### Phase 1: Core Queue Infrastructure

#### 1. TanStack Query + Dexie.js Hybrid Approach

**Why this combination:**
- TanStack Query (v5.62.7 already in project) handles mutation queuing and retry logic
- Dexie.js provides lightweight IndexedDB wrapper for persistent task storage
- Combines battle-tested queue management with flexible custom storage

**Implementation:**

```typescript
// 1. Create Dexie database for queue
import Dexie from 'dexie';

class QueueDatabase extends Dexie {
  tasks!: Table<QueueTask>;
  
  constructor() {
    super('QuorumSyncQueue');
    this.version(1).stores({
      tasks: '++id, taskType, status, createdAt'
    });
  }
}

// 2. Create queue service
class BackgroundSyncQueue {
  private db = new QueueDatabase();
  private processing = false;
  
  async addTask(taskType: TaskType, context: any) {
    // Add to IndexedDB
    const taskId = await this.db.tasks.add({
      taskType,
      context,
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now()
    });
    
    // Trigger processing
    this.processQueue();
    
    return taskId;
  }
  
  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    try {
      const pendingTasks = await this.db.tasks
        .where('status')
        .equals('pending')
        .toArray();
      
      for (const task of pendingTasks) {
        await this.processTask(task);
      }
    } finally {
      this.processing = false;
    }
  }
}

// 3. Integrate with TanStack Query
const useBackgroundSync = () => {
  const mutation = useMutation({
    mutationFn: async (task: QueueTask) => {
      // Process based on task type
      switch(task.taskType) {
        case 'update-profile':
          return await updateProfile(task.context);
        case 'save-user-config':
          return await saveUserConfig(task.context);
        // ... other cases
      }
    },
    onMutate: async (task) => {
      // Optimistic update
      // Update local state immediately
    },
    onError: (error, task) => {
      // Handle failure
      toast.error(`Failed to ${task.taskType}: ${error.message}`);
      // Keep in queue for retry
    },
    onSuccess: (data, task) => {
      // Mark complete
      queue.markComplete(task.id);
      toast.success(`${task.taskType} completed`);
    },
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
  
  return mutation;
};
```

### Phase 2: Optimize User Settings Save

#### 1. Split Profile and Space Sync

```typescript
// Separate concerns
async function saveUserProfile(profile: UserProfile) {
  // Only save profile data (name, avatar, preferences)
  await queue.addTask('update-profile', { profile });
}

async function syncSpaceKeys(spaceIds: string[]) {
  // Only sync changed spaces
  const changedSpaces = await detectChangedSpaces(spaceIds);
  if (changedSpaces.length > 0) {
    await queue.addTask('sync-space-keys', { spaceIds: changedSpaces });
  }
}
```

#### 2. Implement Lazy Loading

```typescript
// Only fetch space data when needed
const getSpaceKeysLazy = async (spaceId: string) => {
  const cached = await getCachedSpaceKeys(spaceId);
  if (cached && !isStale(cached)) {
    return cached;
  }
  
  // Fetch and cache
  const keys = await messageDB.getSpaceKeys(spaceId);
  await cacheSpaceKeys(spaceId, keys);
  return keys;
};
```

### Phase 3: Background Processing

#### 1. Web Worker Integration (Optional Enhancement)

```typescript
// Process queue in web worker to avoid blocking main thread
const worker = new Worker('/queue-worker.js');

worker.postMessage({ type: 'PROCESS_QUEUE' });

worker.onmessage = (event) => {
  if (event.data.type === 'TASK_COMPLETE') {
    // Update UI
  }
};
```

#### 2. Network-Aware Processing

```typescript
// Only process when online
window.addEventListener('online', () => {
  queue.processQueue();
});

// Pause processing when offline
window.addEventListener('offline', () => {
  queue.pauseProcessing();
});
```

## Current Codebase Integration Points

### Files to Modify

1. **`src/hooks/business/user/useUserSettings.ts`**
   - Line 108-146: Replace synchronous `saveChanges` with queue addition
   - Add background sync status tracking

2. **`src/components/context/MessageDB.tsx`**
   - Line 5252-5279: Move space key fetching to background
   - Line 5291-5310: Split `postUserSettings` into queued task

3. **New Files to Create**
   - `src/services/backgroundSyncQueue.ts` - Queue implementation
   - `src/db/syncQueue.ts` - Dexie database schema
   - `src/hooks/useBackgroundSync.ts` - React integration

### Existing Infrastructure to Leverage

1. **WebSocket Queue Pattern** (Already implemented)
   - `src/components/context/WebsocketProvider.tsx` has message queuing
   - Can adapt pattern for background sync

2. **TanStack Query** (v5.62.7 installed)
   - Already handles mutations and caching
   - Add persistence layer with Dexie

3. **IndexedDB via MessageDB**
   - Existing database infrastructure
   - Add new object store for queue

## Dependencies to Add

```json
{
  "dependencies": {
    "dexie": "^4.0.0",  // Lightweight IndexedDB wrapper
    "idb": "^8.0.0"      // Alternative if Dexie doesn't fit
  }
}
```

## Implementation Timeline

### 1: Core Queue Infrastructure
- [ ] Install Dexie.js
- [ ] Create queue database schema
- [ ] Implement basic queue operations
- [ ] Add toast notifications

### 2: User Settings Integration
- [ ] Refactor `saveChanges` to use queue
- [ ] Split profile and space sync
- [ ] Implement optimistic updates
- [ ] Add progress indicators

### 3: Testing & Optimization
- [ ] Test with 50+ spaces
- [ ] Add retry logic and error handling
- [ ] Implement network-aware processing
- [ ] Performance benchmarking

## Success Metrics

### Performance Targets
- Profile saves complete in <2 seconds (UI unblocked)
- Support 50+ spaces without degradation
- Background sync completes within 30 seconds

### User Experience
- Immediate feedback on save actions
- Clear progress indicators
- Graceful offline handling
- Transparent error recovery

## Risks and Mitigations

### Risk 1: Data Consistency
**Mitigation**: Implement versioning and conflict resolution

### Risk 2: Queue Overflow
**Mitigation**: Set max queue size and implement cleanup

### Risk 3: Failed Syncs
**Mitigation**: Exponential backoff and manual retry option

## Alternative Libraries Considered

### Workbox Background Sync
- **Pros**: Google-maintained, Service Worker based
- **Cons**: Requires PWA setup, more complex

### BullMQ
- **Pros**: Feature-rich, battle-tested
- **Cons**: Requires Redis, server-side focused

### p-queue
- **Pros**: Simple, lightweight
- **Cons**: No persistence, memory-only

## Conclusion

The TanStack Query + Dexie.js combination provides the best balance of:
- Immediate implementation feasibility
- Minimal breaking changes
- Maximum flexibility for future enhancements
- Leverages existing project infrastructure

This solution directly addresses Tyler's requirements for a generic task queue while solving the immediate UserSettingsModal performance crisis.

---

*Created: 2025-09-10*
*Status: TODO*
*Priority: HIGH*
*Assignee: Unassigned*