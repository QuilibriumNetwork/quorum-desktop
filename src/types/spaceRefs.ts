import type { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * Per-space registration map kept on a ref in MessageDB and read by every
 * per-app service that needs space metadata (keysets, inbox addresses, etc).
 *
 * Backed by `useRef` in `MessageDB.tsx`, so it always exists for the lifetime
 * of the React tree; services receive it via the platform-agnostic `Ref<T>`
 * wrapper in `./ref`.
 */
export type SpaceInfoMap = {
  [spaceId: string]: secureChannel.SpaceRegistration;
};

/**
 * Per-space sync session bookkeeping for the legacy sync path.
 *
 * `candidates` is `any[]` here because the entries are incoming hub
 * envelopes whose shape is narrowed by property access at the consumer
 * (see `SyncService.initiateSync` and the `sync-info` handler in
 * `MessageService`). Tightening this to a proper hub-envelope union is a
 * separate cleanup; the goal of this type is just to keep the *outer*
 * shape (`expiry`, `candidates`, `invokable`) honestly typed.
 */
export type SyncInfoMap = {
  [spaceId: string]: {
    expiry: number;
    candidates: any[];
    invokable: NodeJS.Timeout | undefined;
  };
};
