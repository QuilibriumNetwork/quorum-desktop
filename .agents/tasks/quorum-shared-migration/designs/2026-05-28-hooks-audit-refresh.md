# Hooks Migration — Audit (2026-05-28)

> **Status**: Read-only audit. This is the authoritative hooks audit. A previous version (`2026-03-19-hooks-design.md`) was written before mobile access was available and has been deleted — its claims (mobile has ~17 hooks, the storage/crypto abstraction layer doesn't exist yet) were superseded by the findings here. Available via git history if a future reader wants to see the March framing.
>
> **Mobile verified at**: `quorum-mobile` `origin/master = 98d59a4` ("catching up public repo", 2026-05-28).
> **Desktop verified at**: working tree of `quorum-desktop` on `chore/quorum-shared-migration-followups`.
> **Shared verified at**: `quorum-shared` `origin/master = fbbd48c` (2026-05-28).
>
> **Scope**: refresh the inventory and the abstraction-layer design question. No code changes. Output is this doc and a recommendation for the next migration PR.

---

## Why this exists

A previous version of this audit (`designs/2026-03-19-hooks-design.md`, since deleted — see git history) was written without access to a current `quorum-mobile` codebase. The 2026-05-28 morning status recap then did a quick scan and concluded mobile had "~17 hooks" and no `actionQueue`/`search` services — but that scan was reading a stale Jan 14 working-tree, not `origin/master`. Both inputs were wrong; this audit replaces them.

**What the deleted doc got wrong (or didn't know):**

1. **"Mobile has ~17 hooks."** False as of 2026-05-28. Mobile has **67 hooks** on `origin/master` (35 under `hooks/chat/`, 32 at root). Most of the desktop business hooks have a mobile equivalent already — not a "promote desktop's, mobile catches up later" story for many of them; it's "negotiate two existing designs."
2. **"Storage/crypto abstraction layer needs to be designed before hooks can migrate."** False. The abstraction **already exists** in `@quilibrium/quorum-shared`:
   - `src/storage/adapter.ts` exports the `StorageAdapter` interface.
   - `src/crypto/types.ts` exports the `CryptoProvider` interface.
   - Both consumers already implement these. Desktop has `src/adapters/indexedDbAdapter.ts` (implements `StorageAdapter`); mobile has `services/storage/mmkvAdapter.ts` (implements `StorageAdapter`) and `services/crypto/native-provider.ts` (implements `CryptoProvider`).
3. **"Mobile has no actionQueue/search folder."** Correct for those exact folder names, but mobile DOES have substantial parallel infrastructure (full notifications stack, calling, wallet, governance, QNS marketplace, Farcaster hooks, miniapp bridge, observability, offline mutation queue at `services/offline/mutationQueue.ts`). The "additive" framing the morning recap suggested needs to be adjusted hook-by-hook.
4. **"Counts: ~265 desktop hook files."** Currently **276** (10 net-new files since the March audit; nothing removed).
5. **"`useInviteManagement` uses messageDB + passkeys + registration."** Currently uses **all four** desktop contexts: messageDB + passkeys + registration + `useQuorumApiClient`.

The refresh below restates the inventory and the architecture question against the live tree.

---

## Architectural snapshot (verified)

### The abstraction layer that the March audit said was needed already exists

Snippet from `quorum-shared/src/storage/adapter.ts`:

```ts
export interface StorageAdapter {
  init(): Promise<void>;
  getSpaces(): Promise<Space[]>;
  getSpace(spaceId: string): Promise<Space | null>;
  saveSpace(space: Space): Promise<void>;
  // ... getMessages, saveMessage, getConversations, getUserConfig, ...
  // Optional sync helpers: getMessageDigests?, getMemberDigests?, ...
}
```

Snippet from `quorum-shared/src/crypto/types.ts`:

```ts
export interface CryptoProvider {
  generateX448(): Promise<X448Keypair>;
  generateEd448(): Promise<Ed448Keypair>;
  senderX3DH(params: SenderX3DHParams): Promise<string>;
  newDoubleRatchet(params: NewDoubleRatchetParams): Promise<string>;
  // ... triple ratchet, inbox encrypt/decrypt, etc.
}
```

Shared also exports a `WasmCryptoProvider` class (`src/crypto/wasm-provider.ts`) wrapping channel-wasm, intended for desktop. Desktop does NOT yet use it — desktop's crypto calls still go inline through its existing services. This is one of the gaps below.

### Mobile already consumes the abstraction via context

Mobile wires `MMKVAdapter` through a React context provider (`context/StorageContext.tsx`):

```ts
const StorageContext = createContext<StorageAdapter | null>(null);
export function StorageProvider({ children }) {
  const adapter = useMemo(() => new MMKVAdapter(), []);
  useEffect(() => { adapter.init(); /* ... */ }, [adapter]);
  return <StorageContext.Provider value={adapter}>{children}</StorageContext.Provider>;
}
export function useStorageAdapter(): StorageAdapter { /* throws if no provider */ }
```

Mobile's `hooks/chat/useSpaces.ts`, `useChannels.ts`, `useSendMessage.ts` are already thin wrappers over the shared hooks:

```ts
// hooks/chat/useSpaces.ts (mobile, origin/master)
import { useSpaces as useSpacesBase } from '@quilibrium/quorum-shared';
import { useStorageAdapter } from '../../context/StorageContext';

export function useSpaces(options?: { enabled?: boolean }) {
  const storage = useStorageAdapter();
  return useSpacesBase({ storage, enabled: options?.enabled });
}
```

`hooks/chat/useMessages.ts` deviates slightly — it calls `useInfiniteQuery` directly to inject a synchronous MMKV seed for the first paint (no spinner flash), but still uses shared's `queryKeys`, types, and storage adapter. Documented narrow deviation, not a fork.

### NativeCryptoProvider is NOT context-provided on mobile

Unlike storage, mobile does NOT have a `CryptoContext` / `useCryptoProvider()` hook. `NativeCryptoProvider` is either:

- Captured as a module-level singleton inside `services/crypto/encryption-service.ts` (DM crypto flows go through this), OR
- Instantiated inline via `new NativeCryptoProvider()` at every space-crypto call site (`WebSocketContext.tsx` has 9+, plus `useChannelManagement`, `useSpaceActions`, `broadcastSpaceUpdate`, `spaceService`, `spaceMessageService`, `configService`).

This is the asymmetry that needs to be acknowledged in any shared hook that does crypto. Storage is solved; crypto isn't.

### Desktop has the storage half but not the crypto half

| Layer | Desktop status | Mobile status | Shared interface |
|---|---|---|---|
| Storage | `IndexedDBAdapter` (implements `StorageAdapter`) | `MMKVAdapter` (implements `StorageAdapter`) | ✅ `StorageAdapter` |
| Storage DI | No `StorageContext` yet; `MessageDB` instance is held inside `useMessageDB()` context. `IndexedDBAdapter` exists as a class but isn't yet wired into a provider hooks can consume. | `StorageContext` + `useStorageAdapter()` hook | — |
| Crypto interface | Inline calls into channel-wasm; no instantiated `WasmCryptoProvider` | `NativeCryptoProvider` (implements `CryptoProvider`) | ✅ `CryptoProvider` |
| Crypto DI | None | None (ad-hoc `new NativeCryptoProvider()` at call sites; module-level singleton for DMs) | — |
| Broadcast | `useMessageDB()` exposes broadcast methods | `enqueueOutbound` from `useWebSocket()` + `broadcastSpaceUpdate()` service | None yet |

**Key insight**: the work the March audit thought was needed before hooks could migrate (designing the abstraction) is done. What's *actually* missing is desktop-side adapter wiring (a `StorageContext` mirror) and a decision on crypto DI on both platforms.

---

## Desktop hooks inventory — refreshed (2026-05-28)

**Total file count: 276** (verified via `find src/hooks -type f -name "*.ts" -o -name "*.tsx"`). Up from ~265 in the March audit.

### By top-level directory

| Directory | Files | Notes |
|---|---|---|
| `src/hooks/business/` | ~163 | Organized by domain (bookmarks, channels, conversations, dm, files, folders, invites, mentions, messages, replies, search, spaces, threads, ui, user, validation) |
| `src/hooks/queries/` | ~89 | React Query adapters; new query domains since March: `conversation/` (singular), `mutedUsers/`, `userNotes/` |
| `src/hooks/mutations/` | 1 | `useUploadRegistration` (uses `useQuorumApiClient`) |
| `src/hooks/platform/` | 11 | Adapter pattern; stays per-app |
| `src/hooks/ui/` | 5 | Mix of pure + DOM (new since March: `useScrollAnchor`, `useShiftKey`) |
| `src/hooks/utils/` | 1 | `forceUpdate` |
| root-level | ~8 | `useClickOutside`, `useContextMenuPrevention`, `useKeyBackup`, `useLongPress`, `useResponsiveLayout*`, `useSearchContext*` |

### Category A — Pure business hooks: ~74

No direct context imports. Validation (6), UI state (16), messages — pure (8 + `useReadReceipt` new), mentions — pure (2), search — pure (19), channels — pure (2), folders — pure (2: `useFolderStates`, `useNavItems`), invites — pure (1: `useInviteUI`), spaces — pure (3: `useSpaceOrdering`, `useSpaceSettings`, `useSpaceTag`), user — pure (7 + `useDeviceNameValidation` new + `useWebFileUpload` new), plus `useRoleManagement` (newly confirmed pure — takes `initialRoles` as a param, no context imports).

**Transitive dependencies** (same as March; the hooks themselves are pure but their callees need contexts at runtime): `useChannelData`, `useConversationPolling`, `useConversationsData`, `useShowHomeScreen`, `useSpaceHeader`, `useRoleManagement` display helpers.

**Browser-API dependencies** (hooks that are import-pure but reach for `localStorage`/`window`/`document`): `useAccentColor`, `useFrequentEmojis`, `useShowHomeScreen`, `useElectronDetection`, `useModalSaveState`, `useReadReceipt` (uses `IntersectionObserver` + `document.visibilityState`), `useTypingNotifier` (uses `document`/`window`), `useShiftKey` (new — `window.addEventListener`).

### Category A2 — Query helpers (pure): 55

- 18 `build*Fetcher.ts` files (bookmarks, channels, config, conversation, conversations, encryptionStates, global, inbox, messages, mutedUsers, registration, search, space, spaceMembers, spaceOwner, spaces, userInfo, userNotes)
- 18 `build*Key.ts` files (same 18 domains)
- 17 `useInvalidate*.ts` files (same 17 minus `useInvalidateSearch` which doesn't exist)
- `loadMessagesAround.ts`, `useGlobalSearch.ts` (accepts `SearchService` as param)

These can migrate at any time. **Zero abstraction work required.**

### Category B — Context-dependent business hooks: 64

| Sub-bucket | Count | Notes |
|---|---|---|
| `useMessageDB` only | 14 | `useBookmarks`, `useChannelManagement`, `useGroupManagement`, `useConversationPreviews`, `useUpdateReadTime`, `useUpdateThreadReadTime`, `useFolderDragAndDrop` (+`useDragStateContext`), `useInviteProcessing`, `useTypingIndicator` (NEW), `useTypingNotifier` (NEW), `useSpaceDragAndDrop` (+`useDragStateContext`), `useChannelThreads`, `useThreadMessages`, `useUserRoleManagement` |
| `useMessageDB` + `usePasskeysContext` | 26 | Mute hooks (channel/DM), mention counters, unread counters, reply counters, search-result display variants, profile/joining/recovery — see subagent inventory for full list |
| `useMessageDB` + `usePasskeysContext` + `useRegistrationContext` | 7 | `useInviteManagement` (+`useQuorumApiClient` — uses all four), `useSpaceCreation`, `useSpaceLeaving`, `useSpaceManagement`, `useSpaceRecovery`, `useUserKicking`, `useUserSettings` |
| `usePasskeysContext` only | 7 | `useChannelMessages`, `useDirectMessageData`, `useMutedConversationsSync`, `useKeyBackupLogic`, `useMessageComposer`, `useProfileImage`, `useWebKeyBackup` |
| `useQuorumApiClient` only | 4 | `useInviteValidation`, `useAuthenticationFlow`, `useOnboardingFlowLogic`, `useUnifiedOnboardingFlow` (NEW) |
| `useQuorumApiClient` + `usePasskeysContext` | 2 | `useAddressValidation.ts`, `useAddressValidation.native.ts` (March audit listed under "useQuorumApiClient only" — actually uses both) |
| `useModalContext` only | 3 | `useGroupEditor`, `useSpacePermissions`, `useDirectMessageCreation` |
| `useClipboardAdapter` only | 1 | `useCopyToClipboard` |

### Category B2 — Query hooks with contexts: 19

- 14 using `useMessageDB`: `useBookmarks` (queries), `useResolvedBookmark`, `useConfig`, `useConversation` (NEW), `useConversations`, `useEncryptionStates`, `useMessages`, `useMutedUsers` (NEW), `useSpace`, `useSpaceMembers`, `useSpaceOwner`, `useSpaces`, `useUserInfo`, `useUserNote` (NEW)
- 5 using `useQuorumApiClient`: `useChannel`, `useGlobal`, `useInbox`, `useRegistration`, `useRegistrationOptional`

### Category C — Platform-specific: 15

11 in `src/hooks/platform/` (clipboard, files, navigation hotkeys, passkey adapter — all with `.web.ts`/`.native.ts` variants) plus 4 business hooks with direct DOM APIs (`useAccentColor`, `useElectronDetection`, `useFrequentEmojis`, `useNotificationSettings.ts`).

### Uncategorized / special cases

| Hook | Decision |
|---|---|
| `useConfirmation.ts` (ui/) | Pure state machine; shareable. Used by `useRoleManagement` and multiple Cat B hooks |
| `useScrollTracking.ts` (ui/) | Pure |
| `useScrollAnchor.ts` (ui/) | NEW — accepts `QueryClient` as param, no context, pure |
| `useShiftKey.ts` (ui/) | NEW — `window.addEventListener`; platform-specific |
| `useWindowResize.ts` (ui/) | Platform-specific (DOM) |
| `forceUpdate.ts` (utils/) | Pure |
| `useKeyBackup.ts` (root) | Composed: `useKeyBackupLogic` + `useFileDownloadAdapter`. Existing in-repo precedent for the adapter pattern |
| `useLongPress.ts` (root) | Has `isTouchDevice()` platform check; needs review |
| `useResponsiveLayout.ts` / `.native.ts` | Web variant uses `window.addEventListener`; native variant pure |
| `useSearchContext.ts` / `.native.ts` | Web variant uses react-router; native variant pure |
| `useSearchService` (business/search/) | Accepts `messageDB` as param; pure imports but implicit B coupling at the call site |

### What changed since 2026-03-19

- **+11 net hook files** (no removals — every March-audit hook still exists).
- **NEW hooks**: `useReadReceipt`, `useTypingIndicator`, `useTypingNotifier`, `useDeviceNameValidation`, `useUnifiedOnboardingFlow`, `useWebFileUpload`, `useScrollAnchor`, `useShiftKey`, `useUserNote` (query), `useMutedUsers` (query), `useConversation` (singular query).
- **NEW query domains**: `conversation/`, `mutedUsers/`, `userNotes/` (each with the standard `build*Fetcher` + `build*Key` + `useInvalidate*` + `use*` quartet). Also fetcher files added for `conversations`, `global`, `registration`, `space`, `spaceMembers`.
- **Recategorizations confirmed**: `useRoleManagement` is fully pure (Category A) — important for migration, because it's a candidate for the first migration PR. `useInviteManagement` uses all four contexts (not three as March audit said). `useAddressValidation` uses two contexts (not one).
- **`business/user/useKeyBackup.ts`** is a thin re-export of `useWebKeyBackup` (didn't exist in March audit) — separate from the root-level composed `useKeyBackup.ts`.

---

## Mobile inventory — refreshed (2026-05-28, against origin/master 98d59a4)

**Total file count: 67** (35 under `hooks/chat/`, 32 at root).

### Mobile `hooks/chat/` (35 — full business hook family)

```
useChannelManagement, useChannels, useConversations, useDMFavorites, useDMMute,
useDeleteDirectMessage, useDeleteSpaceMessage, useEditDirectMessage, useEditSpaceMessage,
useExploreSpaces, useFarcasterDirectCasts, useInviteManagement, useMessageSearch,
useMessages, usePinnedMessages, useReactions, useRecipientRegistration, useReplyTracking,
useRoleManagement, useSendDirectEmbedMessage, useSendDirectMessage, useSendDirectReaction,
useSendEmbedMessage, useSendMessage, useSendSpaceMessage, useSendStickerMessage,
useSpaceActions, useSpaceActivity, useSpaceReactions, useSpaceSettings, useSpaces,
useUnifiedConversations, useUserKicking, useUserMuting, queryTypes.ts + index.ts
```

### Mobile root-level `hooks/` (32 — mostly platform + feature)

```
useBiometricAuth, useColorScheme (+.web), useEmojiFrecency, useFarcasterChannel/Feed/Notifications/
Pro/Profile/Search/Thread, useGovernance, useHypersnapSignerLifecycle,
useMembersWithPublicProfileFallback, useModalAnimation, useNetworkState, useOTAUpdate,
usePanResponder, useQNS, useQNSMarketplace, useQNSPayment, useQuorumIdentityForFid,
useThemeColor, useUnifiedNotifications, useUserConfig, useUserPublicProfile, useWallet,
useWalletSelection, useWarpcastWallet
```

### Mobile services map (relevant subset)

Verified via `git ls-tree -r origin/master`:

- `services/api/` — quorum + QNS clients
- `services/calling/` — full WebRTC stack (9 files)
- `services/config/` — `configService`, `spaceStorage`, `spaceSyncService`
- `services/crypto/` — `NativeCryptoProvider`, `encryption-service`, `encryption-state-storage`, `native-signing-provider`, `space-session`
- `services/farcaster/` — hypersnap adapters + opt-in + provision + legacy-shape transform + scam filter + updateProfile
- `services/notifications/` — `NotificationService`, `BackgroundMessageService`, `backgroundTask`, `hubLogClassifier`, `notificationLog`, `notificationPrefs`, `pushReceivedTask`, `pushRegistration`, `sharedKeystore` (NB: 9 files, full local-MMKV + iOS NSE stack — the architecture-divergence report covers this)
- `services/offline/` — `mutationQueue`, `queryPersister`, `storage` (mobile DOES have an offline mutation queue, though not called "actionQueue")
- `services/onboarding/` — `farcasterService`, `keyService`, `secureStorage`
- `services/profile/` — `profilePrefs`, `publicProfile`
- `services/space/` — `broadcastSpaceUpdate`, `channelBindings`, `hubLogCursor`, `hubLogSync`, `inviteService`, `messageRecovery`, `spaceMessageService`, `spaceService`
- `services/storage/` — `messagesDb` (SQLite + SQLCipher!), `mirroredMMKV`, `mmkvAdapter`
- `services/wallet/` — 14 files (balance, bittensor, jupiter, kaspa, lifi, multiChain, nonEvm, qnsPayment, relay, swap, transactionHistory, transaction, walletPrefs)
- `services/miniapp/` — Ethereum provider + secure signing
- `services/observability/` — global error reporter, React Query bridges, rejection tracking
- `services/reporting/` — `reportService`

There is **no** `services/actionQueue/` folder or `services/search/` folder by those names. But mobile DOES have:
- `services/offline/mutationQueue.ts` — functional equivalent to desktop's ActionQueue for offline mutations
- `hooks/chat/useMessageSearch.ts` — message search via Hub API (no `SearchService` class, just a hook that calls the API)

---

## Side-by-side comparisons of 4 business hooks

These are abridged. Full details in the subagent comparison run (not separately checked in — the findings are summarized below).

### `useChannelManagement`

- **Desktop**: monolithic hook (~396 LOC) bundling local form state, validation, two-step delete confirmation, and CRUD via `useMessageDB()`.
- **Mobile**: **10 separate hooks** — `useAddChannel`, `useUpdateChannel`, `useDeleteChannel`, `usePinChannel`, `useAddGroup`, `useUpdateGroup`, `useDeleteGroup`, `useMoveChannel`, `useReorderGroups`, `useReorderChannels`. Each is a thin TanStack `useMutation()` over a stateless service call.
- **Divergence**: signatures don't overlap. Mobile keys group by index (`groupIndex`); desktop keys by name (`groupName`). Mobile's `useDeleteChannel` refuses to delete the default channel; desktop silently reroutes.
- **Convergence path**: mobile's split-mutation pattern is shareable; desktop's form-state wrapper is not. The form-state stays desktop-only; CRUD mutations can promote to shared (matching mobile's shape). **Desktop refactor: medium.**

### `useRoleManagement`

- **Desktop**: Category A, pure — local state machine over `initialRoles`. No persistence inside the hook; the parent saves on submit.
- **Mobile**: a family — `useRoles` (query) + `useAddRole`/`useUpdateRole`/`useDeleteRole`/`useAssignRole`/`useRemoveFromRole`/`useToggleRolePermission` (mutations). Each mutation persists to storage + broadcasts via `enqueueOutbound`.
- **Divergence**: behaviorally different — desktop batches all edits and saves once; mobile fires one mutation per action.
- **Convergence path**: the pure role-mutation *logic* (update fields on a `Role`) is identical and trivially shareable. But desktop's "stage then save" UX vs. mobile's "save on every action" UX is a real choice. **Desktop refactor: medium-large** if we adopt mobile's pattern (rewriting the role editor UX). Alternative: keep desktop's editor pattern but call shared role-mutation utilities under the hood. The pure functions (e.g. `updateRolePermission(role, permission, value)`) are clearly shareable.

### `useUserKicking`

- **Desktop**: zero-param hook, reads `spaceId` from `useParams()`. Returns `{ kicking, confirmationStep, handleKickClick, kickUserFromSpace, resetConfirmation }`. Internally enqueues `'kick-user'` into `actionQueueService`.
- **Mobile**: `useUserKicking({ spaceId })`. Same return shape. `kickUserFromSpace` calls a service function that does the full cryptographic sequence inline (new config keypair, role removal, manifest update, rekey messages, kick notification), then `enqueueOutbound`s the WS envelopes.
- **Divergence**: only divergence in the surface is param shape (mobile is DI-friendly with explicit `spaceId`). The confirmation-state machine is line-for-line identical between the two implementations.
- **Convergence path**: easiest of the four. Adopt mobile's `{ spaceId }` param shape in the shared hook; the kick *implementation* can stay platform-specific behind a `kickUserFromSpace` callback the parent provides or a service injection. **Desktop refactor: small** for the signature change.

### `useInviteManagement`

- **Desktop**: monolithic hook (~520 LOC) combining user search, address validation, invite dispatch, public-link generation. Uses all four contexts: `useMessageDB`, `usePasskeysContext`, `useRegistrationContext`, `useQuorumApiClient`.
- **Mobile**: 6 separate hooks — `useGenerateInvite`, `useGeneratePublicInvite`, `useCopyInviteLink`, `useShareInvite`, `useParseInviteLink`, plus utility re-exports. No user-search / address-resolution hook on mobile (mobile's flow is presumably through a different UI affordance — possibly native contacts or a different screen).
- **Divergence**: feature scope is wider on desktop (mobile has only the link-generation + copy/share layer).
- **Convergence path**: link generation extracts cleanly to shared (matching mobile's split-hook shape). User search + address resolution + invite dispatch stay desktop-only for now, OR get refactored later if mobile builds the same UX. **Desktop refactor for the link-generation part: small.** **For the full hook: large.**

### Overall pattern across all four

Mobile structures business hooks as **thin TanStack mutation wrappers over stateless service functions**. Desktop structures business hooks as **fat form-state controllers** that bundle UI state, validation, confirmation flows, router coupling, and persistence.

The shareable layer is the **mutation function bodies** (and the pure logic underneath them), not the hooks-as-shaped. Per the cross-repo workflow rule **"patterns that already exist in mobile: follow, don't disrupt"** — when we promote these to shared, the API shape should match mobile's split-hook + mutation pattern, not desktop's monolithic pattern. Desktop adapts.

---

## The abstraction-layer design question — answered

> Old question (March 2026): *"How do we let both apps consume the same business hooks given they have different storage and crypto?"*
>
> Answer (May 2026): *"The interfaces already exist. The platform implementations already exist. What's missing is (a) a `StorageContext` on desktop mirroring mobile's, (b) a decision on `CryptoProvider` DI on both platforms, and (c) lead-dev confirmation that shared hooks should follow mobile's split-mutation shape."*

### Storage — solved (just needs desktop wiring)

| Question | Answer |
|---|---|
| Does shared have a `StorageAdapter` interface? | ✅ Yes — `src/storage/adapter.ts` |
| Does desktop implement it? | ✅ Yes — `IndexedDBAdapter` (`src/adapters/indexedDbAdapter.ts`) |
| Does mobile implement it? | ✅ Yes — `MMKVAdapter` (`services/storage/mmkvAdapter.ts`) |
| Is there a DI pattern shared can adopt? | ✅ Yes — mobile's `StorageContext` + `useStorageAdapter()` |
| Is desktop wired up to this pattern? | ❌ Not yet — desktop's `IndexedDBAdapter` exists as a class but isn't accessed via a `StorageContext` / `useStorageAdapter()` hook. Desktop business hooks still go through `useMessageDB()` which is a different (richer) facade. |

**Implication**: a small desktop PR can introduce a `StorageContext` mirroring mobile's. That unblocks every Category A2 query helper and most of Category B that "only needs storage." It does NOT yet unblock anything that needs broadcast or crypto.

### Crypto — interface exists, DI pattern doesn't

| Question | Answer |
|---|---|
| Does shared have a `CryptoProvider` interface? | ✅ Yes — `src/crypto/types.ts` |
| Does mobile implement it? | ✅ Yes — `NativeCryptoProvider` (`services/crypto/native-provider.ts`) |
| Does desktop implement it? | ❌ Shared exports `WasmCryptoProvider` (`src/crypto/wasm-provider.ts`) which could wrap desktop's channel-wasm bindings, but desktop doesn't yet instantiate it. Desktop's crypto calls are scattered across services. |
| Is there a DI pattern for it on either platform? | ❌ Mobile `new NativeCryptoProvider()`s ad-hoc at call sites (or uses a module-level singleton for DM crypto). No `CryptoContext` / `useCryptoProvider()` hook exists on either platform. |

**Lead-dev question (per the "don't decide for the lead" rule):**

> Mobile currently instantiates `NativeCryptoProvider` ad-hoc at every space-crypto call site (9+ in `WebSocketContext.tsx` alone) and uses a module-level singleton for DM crypto in `services/crypto/encryption-service.ts`. To migrate shared hooks that need crypto, we'd want a single DI source — either a context provider like `useStorageAdapter()`, or a parameter passed into every shared hook. Do you want mobile to converge on a `CryptoContext` + `useCryptoProvider()` pattern (matching `StorageContext`), or stay with the current ad-hoc pattern? If the latter, shared hooks that need crypto can accept it as a parameter, but each consumer will pay the boilerplate cost at every call site.

### Broadcast — no shared abstraction yet (and may not need one)

Desktop and mobile have fundamentally different broadcast paths:
- Desktop: `useMessageDB()` exposes methods that internally call the WebSocket broadcast.
- Mobile: `useWebSocket()` returns `enqueueOutbound()` which adds to an outbound queue; `broadcastSpaceUpdate()` is a service function that returns a WS envelope, the caller `enqueueOutbound`s it.

Bridging these is a separate, larger design exercise. For now, shared mutation hooks that need to broadcast can:
- Accept a `broadcast` callback as a parameter, OR
- Return the WS envelope they want sent and let the caller dispatch it (matches mobile's pattern).

**Lead-dev question**:
> Should shared mutation hooks (e.g. a shared `useUpdateRole`) return a constructed WS envelope and let the platform dispatch it, or accept an `onBroadcast(envelope)` callback? Or should we punt on shared mutation hooks for now and only migrate the read-query hooks that have no broadcast concern?

### Why a "useMessageDB() facade" in shared doesn't fit

The old March audit suggested defining `useMessageDB()` as a shared context interface (Option A). After looking at mobile: **mobile does not have a unified `MessageDB` facade**. It has a `StorageAdapter` (DI'd) + a DM `encryptionService` singleton + scattered crypto/broadcast calls. There is no anchor point on mobile for a `useMessageDB()` to attach to. Adopting it would force the lead-dev to invent and wire a new abstraction across mobile's existing code paths — friction we want to avoid.

**Recommendation: drop Option A.** Use the DI-by-context pattern mobile already established for storage, extend it (with lead approval) to crypto, and either return envelopes or accept callbacks for broadcast.

---

## The smallest safe first migration PR

> **CORRECTION (2026-05-28, same day):** an earlier version of this section recommended migrating Category A2 (query helpers) as the first PR. That recommendation was **wrong** and has been withdrawn. The correction is below; the original reasoning is preserved at the end of this section as a "don't repeat this" record.

### Why A2 query helpers are NOT the right first target

After spot-checking the actual A2 files in `src/hooks/queries/<domain>/` and grepping mobile for the patterns they implement, three problems surfaced:

1. **Desktop's `build*Key` factories conflict with shared's existing `queryKeys` factory.** Desktop's `buildSpacesKey() = ['Spaces']` (capital S). Shared's `queryKeys.spaces.all = ['spaces']` (lowercase). Same logical key, different cache slot. Mobile already imports shared's `queryKeys` everywhere (`WebSocketContext.tsx`, `hooks/chat/useConversations.ts`, etc.). Migrating desktop's `build*Key` files to shared would either duplicate the factory or require renaming desktop's cache keys — that's a real refactor, not a move.
2. **`build*Fetcher` files reference `MessageDB`, which is desktop-specific.** Example: `buildSpacesFetcher` takes `{ messageDB: MessageDB }` typed against `../../../db/messages`. Not shareable without retyping the param to `StorageAdapter` and verifying every method signature matches. Mobile wouldn't use these anyway — it consumes shared's existing `useSpaces({ storage })` hook directly.
3. **`useInvalidate*` hooks are technically shareable** but mobile doesn't use this pattern. Mobile inlines `queryClient.invalidateQueries({ queryKey: [...] })` at the call site. We'd be writing infrastructure for a hypothetical future consumer, not a current one. The workflow rule "don't decide for the lead" applies: if the lead-dev wanted these helpers on mobile, mobile would have built them.

The core mistake was treating "no context imports" as equivalent to "shareable." Pure-import doesn't mean shareable — what matters is whether mobile actually uses or will use the migrated code. A2 fails that test.

### The actual next move

Rather than picking a different first PR in this session (which would risk a second wrong call while fresh on the A2 mistake), the recommendation is: **write a focused next-session task doc** that lists 3–5 narrow candidate migrations and the verification steps for each. See [`../2026-05-28-hooks-migration-next-pr-candidates.md`](../2026-05-28-hooks-migration-next-pr-candidates.md) for that doc.

The candidates worth investigating in the next session (NOT yet verified — that's what the next session is for):

- **`useConfirmation`** (ui/) — pure state machine, ~50 LOC. Used by `useRoleManagement`, `useUserKicking`, and several Category B hooks. The question to verify: does mobile have its own version? If yes, what's the shape?
- **The 6 validation hooks** (`useChannelValidation`, `useDisplayNameValidation`, `useGroupNameValidation`, `useMessageValidation`, `useProfileValidation`, `useSpaceNameValidation`) — pure functions over strings. Mobile presumably enforces the same rules but possibly inlined. Verify before migrating.
- **`useKickConfirmation`** (new — extracted from `useUserKicking`) — the side-by-side comparison found the confirmation state machine is line-for-line identical between desktop and mobile. Extracting it as a standalone hook means BOTH platforms can adopt it, removing real duplication.
- **`forceUpdate`** (utils/) — trivial pure utility. Toe-in-the-water candidate if nothing larger is verified.

### What NOT to do as the first PR

- **Don't migrate Category B hooks first.** They depend on `useMessageDB`, which depends on the abstraction-layer questions above (storage DI on desktop, crypto DI everywhere, broadcast pattern). These have to land first or the migrated hook can't be instantiated on desktop.
- **Don't try to introduce a `StorageContext` on desktop in the same PR.** That's a meaningful refactor (desktop has 61 hooks consuming `useMessageDB()`, and `useMessageDB` is more than just storage). Sequence it as a separate PR after the small wins.
- **Don't migrate desktop's `build*Key` factories to shared as-is.** They conflict with shared's existing `queryKeys`. A separate cleanup PR could unify desktop's hand-rolled keys with shared's factory, but that's a desktop-only refactor, not a migration.

### Withdrawn original recommendation (for the record)

The earlier version of this section recommended migrating all 55 A2 query helpers as one additive PR. That recommendation reused the framing from the typing/receipts service migrations. It was wrong for the reasons enumerated above. Keeping this note here so a future session re-reading the audit doesn't reach the same conclusion from the same false-positive signal ("subagent classified them as pure, therefore shareable").

---

## Recommended migration roadmap (updated)

Each step is one PR per repo. Cross-repo workflow rules from [2026-05-28-cross-repo-workflow.md](../2026-05-28-cross-repo-workflow.md) apply throughout.

1. **PR-set 1: One small verified candidate from the next-session task doc** ([`../2026-05-28-hooks-migration-next-pr-candidates.md`](../2026-05-28-hooks-migration-next-pr-candidates.md)) — most likely `useConfirmation` or the validation hooks, depending on what the verification pass turns up. Additive to shared, re-export in desktop, mobile PR ONLY if mobile has its own duplicate to delete.
2. **PR-set 2: A second small verified candidate** — e.g. extract `useKickConfirmation` from `useUserKicking` if the side-by-side comparison's "line-for-line identical" claim holds up under direct re-verification. Both platforms then adopt it.
3. **Lead-dev coordination point**: file a GitHub issue against `quorum-mobile` asking the two questions in the "Crypto" and "Broadcast" sections above. **Do not file this in parallel** — wait until PR-sets 1 and 2 have shipped, so the lead-dev's review queue isn't double-loaded on top of the existing notifications question.
4. **PR-set 3: Introduce `StorageContext` on desktop** — define `quorum-desktop`'s `StorageProvider` wrapping the existing `IndexedDBAdapter`, expose `useStorageAdapter()`. No business-hook changes; just the plumbing. Lead-dev sees nothing on mobile. Standalone desktop refactor.
5. **PR-set 4 (conditional on lead reply): Migrate Category B "storage-only" hooks** — hooks that use `useMessageDB()` ONLY for storage operations (read/write spaces/messages/users, no broadcast). Substitute `useStorageAdapter()` calls in shared. Estimated ~14 hooks (the "useMessageDB only" sub-bucket).
6. **PR-set 5+: Migrate remaining Category B hooks** — by sub-bucket, based on what direction the lead-dev gives on crypto + broadcast.

**Note**: A2 query helpers are NOT in this roadmap (see the withdrawn-recommendation block above). Desktop's `buildKey`/`buildFetcher`/`useInvalidate` patterns are desktop-internal infrastructure that mobile won't use. They're not a migration target.

Steps 3 onward all depend on lead-dev input. Steps 1 and 2 do not — they can ship this week, ONE AT A TIME, with verification between them.

---

## Out-of-scope findings worth noting

A few things surfaced during this investigation that aren't part of the hooks audit but affect related migration rows on the status tracker:

- **`ActionQueueService` re-evaluation** (`designs/2026-05-18-services-design.md` §4): mobile DOES have an offline mutation queue at `services/offline/mutationQueue.ts`. Different name, similar function. The "promote desktop's, mobile inherits" framing in the March audit is wrong — there's a real two-implementation negotiation here. Suggest re-auditing this separately before driving a migration.
- **`SearchService` re-evaluation** (`designs/2026-05-18-services-design.md` §3): mobile doesn't have a `SearchService` class, but it does have `hooks/chat/useMessageSearch.ts` which calls a Hub API endpoint. The "no search at all on mobile" framing is wrong; mobile has a thinner equivalent. Re-audit before migration.
- **Notifications**: confirmed paused on lead-dev reply (per the status recap evening update). This audit didn't re-investigate that.
- **Farcaster hooks**: 11 React Query hooks exist in shared's new `src/farcaster/` module (per 2026-05-28 upstream pull). Mobile has its own `useFarcaster*` hooks under `hooks/`. The eventual convergence between mobile's hooks and shared's is its own workstream — not blocking the business-hooks migration.

These notes do not expand the hooks-migration scope. They're flagged so the next session reviewing the master tracker knows the underlying assumptions changed.

---

*Created 2026-05-28 — full refresh of the hooks audit against live mobile `origin/master` (`98d59a4`) and shared `origin/master` (`fbbd48c`). Read-only investigation; no code changes. Anchored by three parallel deep-dives: desktop hooks re-inventory, mobile shared-consumption patterns, and side-by-side hook-by-hook comparison of 4 representative business hooks. Supersedes (and replaces) the older `2026-03-19-hooks-design.md`, which was deleted to keep the designs/ folder clean — the prior framing is available via git history if needed.*

*Amended 2026-05-28 (same day) — withdrew the original recommendation to migrate Category A2 query helpers as the first PR. The recommendation was wrong: desktop's `build*Key` factories conflict with shared's existing `queryKeys` (different casing), `build*Fetcher` files reference desktop-specific `MessageDB`, and `useInvalidate*` hooks aren't a pattern mobile uses. Pure-import is not the same as shareable. The "Smallest safe first PR" section now points at [`../2026-05-28-hooks-migration-next-pr-candidates.md`](../2026-05-28-hooks-migration-next-pr-candidates.md) for the actual next-session investigation.*
