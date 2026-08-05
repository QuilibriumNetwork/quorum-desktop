// One-time clear of legacy per-space overrides on the user's OWN roster rows.
//
// Those values are copies of an old global name, stamped at join and then re-sent
// and re-stamped by the on-connect announce on every connect. They never decay, and
// after the first announce they are byte-for-byte identical to a name the user
// deliberately chose — nothing can tell them apart. So they are cleared
// unconditionally, once. Decision recorded in the design doc's §4-D.
//
// It BROADCASTS the clear rather than writing locally. A local write is invisible on
// the wire, so spacemates and the user's own other devices keep the poisoned copy —
// and an un-migrated sibling device re-announces the old value with a fresher
// timestamp and wins. Sending it through `submitChannelMessage` also self-applies it
// locally with a fresh `profileTimestamp`, which is what makes it survive that race.
//
// See .agents/issues/.open/2026-08-05-own-identity-cross-device-sync-design.md §5-D

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { logger, type UpdateProfileMessage } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { releaseLegacySpaceOverrideClearGate } from '../../../utils/legacyOverrideClearGate';
import type { SpaceMemberRow } from '../../../db/messages';

/** Bump to re-run if the shape ever changes. */
const CLEAR_FLAG_PREFIX = 'spaceOverridesCleared:v1:';
/** What the clear destroyed. Irreversible, so it leaves a record. */
export const CLEAR_LOG_KEY = 'quorum:diag:clearedSpaceOverrides';

export interface OverrideClearEntry {
  spaceId: string;
  previousName?: string;
  previousIcon?: string;
}

interface OwnRosterRow {
  spaceId: string;
  user_address: string;
  display_name?: string;
  user_icon?: string;
}

/** Pure: which of our own rows still carry a per-space override? */
export function planLegacyOverrideClear(
  selfAddress: string,
  rows: OwnRosterRow[]
): OverrideClearEntry[] {
  return rows
    .filter((r) => r.user_address === selfAddress && (r.display_name || r.user_icon))
    .map((r) => ({
      spaceId: r.spaceId,
      previousName: r.display_name || undefined,
      previousIcon: r.user_icon || undefined,
    }));
}

function recordClearedOverrides(entries: OverrideClearEntry[]): void {
  if (entries.length === 0) return;
  try {
    const raw = localStorage.getItem(CLEAR_LOG_KEY);
    const existing = raw ? (JSON.parse(raw) as OverrideClearEntry[]) : [];
    localStorage.setItem(
      CLEAR_LOG_KEY,
      JSON.stringify([...existing, ...entries].slice(-100))
    );
    // console.warn, not logger — logger calls compile to no-ops in production.
    console.warn(
      `[SpaceOverrides] cleared ${entries.length} legacy per-space override(s). ` +
        `Previous values are in ${CLEAR_LOG_KEY} in localStorage.`,
      entries
    );
  } catch {
    // Diagnostics must never break the migration.
  }
}

export function useClearLegacySpaceOverrides(): void {
  const { messageDB, submitChannelMessage } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    const selfAddress = currentPasskeyInfo?.address;
    if (!selfAddress || ranRef.current) return;

    const flagKey = `${CLEAR_FLAG_PREFIX}${selfAddress}`;
    if (localStorage.getItem(flagKey)) {
      releaseLegacySpaceOverrideClearGate();
      return;
    }
    ranRef.current = true;

    (async () => {
      try {
        const spaces = await messageDB.getSpaces();
        const rows: OwnRosterRow[] = [];
        for (const space of spaces) {
          const own = await messageDB.getSpaceMember(space.spaceId, selfAddress);
          if (own) rows.push({ ...own, spaceId: space.spaceId } as OwnRosterRow);
        }

        const plan = planLegacyOverrideClear(selfAddress, rows);

        for (const entry of plan) {
          const space = spaces.find((s) => s.spaceId === entry.spaceId);
          if (!space) continue;

          // LOCAL half — deterministic, and it must land before the gate opens.
          //
          // `submitChannelMessage` does self-apply the clear, but it does so
          // inside `enqueueOutbound`, which pushes to a queue and returns without
          // awaiting anything (WebsocketProvider.enqueueOutbound). So awaiting it
          // guarantees nothing: the local write might not have happened when the
          // announce is released, and it does not happen at all while the socket
          // is closed. Write the row ourselves so the ordering the gate promises
          // is real rather than a race with favourable odds.
          //
          // '' is a present value, so it survives saveSpaceMember's merge as a
          // deliberate clear. The timestamp is what beats an un-migrated
          // sibling's re-announce.
          await messageDB.saveSpaceMember(entry.spaceId, {
            user_address: selfAddress,
            display_name: '',
            user_icon: '',
            profileTimestamp: Date.now(),
          } as SpaceMemberRow);

          // WIRE half — best-effort, and self-healing if it does not go out.
          // Once the row holds '', the ordinary on-connect announce carries
          // `displayName: ''` too (that is what the presence-semantics fix in
          // this branch enables), so the clear still reaches everyone on the
          // next connect even if this send is dropped.
          await submitChannelMessage(
            entry.spaceId,
            space.defaultChannelId,
            {
              type: 'update-profile',
              senderId: selfAddress,
              displayName: '',
              userIcon: '',
            } as UpdateProfileMessage,
            queryClient,
            currentPasskeyInfo,
            undefined, // inReplyTo
            false, // must sign
            undefined // isSpaceOwner — not needed for profile updates
          );
        }

        recordClearedOverrides(plan);
        localStorage.setItem(flagKey, String(Date.now()));
        logger.log(
          `[SpaceOverrides] legacy override clear complete (${plan.length} space(s))`
        );
      } catch (error) {
        // Do NOT set the flag — retry on the next launch, matching the
        // conversation-settings migration's failure behaviour.
        ranRef.current = false;
        logger.error('[SpaceOverrides] legacy override clear failed', error);
      } finally {
        // Release the announce either way: a migration that failed must not
        // silence the identity announce for the whole session.
        releaseLegacySpaceOverrideClearGate();
      }
    })();
  }, [currentPasskeyInfo, messageDB, submitChannelMessage, queryClient]);
}
