/**
 * Identity Coverage — IndexedDB reads and the optional public-profile probe.
 *
 * Thin IO layer, deliberately separate from `identityCoverageCore.ts` so the
 * classification stays pure and unit-testable without a browser or a network.
 * Same split as `dm-doctor/`.
 *
 * Opens `quorum_db` through the shared `openQuorumDb`, which never passes a
 * version (so a schema bump can't break the tool) and fails loudly rather than
 * silently creating an empty v1 database — see that module's header.
 */

import { QuorumApiClient, isHandledFetchError } from '../../api/baseTypes';
import { openQuorumDb } from '../openQuorumDb';
import type {
  DirectConversationIdentityRow,
  IdentityMessageRow,
  IdentitySpaceRow,
  PublicProfileResult,
  SpaceMemberIdentityRow,
} from './identityCoverageCore';

function readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to read ${storeName}`));
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export interface IdentityCoverageStores {
  spaces: IdentitySpaceRow[];
  members: SpaceMemberIdentityRow[];
  messages: IdentityMessageRow[];
  conversations: DirectConversationIdentityRow[];
}

/**
 * Read every store the snapshot needs, on ONE connection.
 *
 * Four separate opens would each take their own consistent view, so a write
 * landing between them could produce a snapshot where a member row exists in
 * one read and not the other. A single connection makes the four `getAll`s
 * mutually consistent, which matters because the headline number is a
 * comparison BETWEEN two of those stores (senders in `messages` versus rows in
 * `space_members`).
 */
export async function readIdentityCoverageStores(): Promise<IdentityCoverageStores> {
  const db = await openQuorumDb();
  try {
    const [spaces, members, messages, conversations] = await Promise.all([
      readAll<IdentitySpaceRow>(db, 'spaces'),
      readAll<SpaceMemberIdentityRow>(db, 'space_members'),
      readAll<IdentityMessageRow>(db, 'messages'),
      readAll<DirectConversationIdentityRow>(db, 'conversations'),
    ]);
    return { spaces, members, messages, conversations };
  } finally {
    db.close();
  }
}

/** How many public-profile lookups run at once. The probe is opt-in and can
 *  cover a hundred addresses; unbounded parallelism would hammer the API and
 *  serial fetching would take minutes. */
const PROBE_CONCURRENCY = 6;

/**
 * Look up the public profile for each address, classifying the result.
 *
 * This is the last leg of "no identity from ANY source": a member with an empty
 * local row is still renderable if they published a public profile, because the
 * render path back-fills from it (`useMembersWithPublicProfileFallback`,
 * `useConversationsWithProfileBackfill`). A 404 means they never opted in, and
 * that is the irreducible case nothing can fix at render time.
 *
 * Deliberately opt-in and separate from the local snapshot: it is N network
 * calls, and the local counts must stay fast, deterministic and offline-safe.
 * A fetch failure is reported as `status: 'error'` and counted apart from a
 * real 404 — a flaky network is not evidence that a profile is missing.
 *
 * `onProgress` is called after each completion so the page can show progress
 * over a long probe rather than appearing hung.
 */
export async function probePublicProfiles(
  addresses: string[],
  onProgress?: (done: number, total: number) => void
): Promise<PublicProfileResult[]> {
  const client = new QuorumApiClient();
  const results: PublicProfileResult[] = [];
  let cursor = 0;
  let done = 0;

  const runOne = async (address: string): Promise<PublicProfileResult> => {
    try {
      const response = await client.getPublicProfile(address);
      const data = response.data;
      return {
        address,
        status: 200,
        hasName: Boolean(data?.display_name?.trim()),
        hasImage: Boolean(data?.profile_image?.trim()),
      };
    } catch (error: unknown) {
      // 404 is the common, expected case: the user never opted in.
      if (isHandledFetchError(error) && error.status === 404) {
        return { address, status: 404, hasName: false, hasImage: false };
      }
      const status =
        isHandledFetchError(error) && typeof error.status === 'number'
          ? error.status
          : ('error' as const);
      return { address, status, hasName: false, hasImage: false };
    }
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= addresses.length) return;
      results.push(await runOne(addresses[index]));
      done += 1;
      onProgress?.(done, addresses.length);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(PROBE_CONCURRENCY, addresses.length) },
      worker
    )
  );

  return results;
}
