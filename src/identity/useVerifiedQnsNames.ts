/**
 * Drop a claimed `.q` unless it really belongs to the account claiming it.
 *
 * ## Where this sits
 *
 * ```
 * public profile          carries primary_username — a CLAIM, not a fact
 *        ▼
 * useVerifiedQnsNames     ← the only place that resolves claims (one batch)
 *        ▼                  an unproven claim never enters the map
 * IdentitySources         ← carries verified names, and NO profile object
 *        ▼
 * identityFromMaps        ← unchanged, still pure and synchronous
 *        ▼
 * every display surface   ← unchanged, all ~20 of them
 * ```
 *
 * Verification happens UPSTREAM of the ladder, by changing the DATA rather than
 * teaching every surface about the network. Two things fall out of that:
 *
 * - Every surface inherits the check without any of them changing, which is the
 *   whole reason this repo has one resolver.
 * - An unverified claim has nowhere to live. `IdentitySources` carries no
 *   profile object at all, so a surface cannot render an unproven `.q` even by
 *   mistake — there is nothing to render it FROM. Doing this per-surface would
 *   be the wrong shape: one surface that forgot would render a forgery, and
 *   there would be no way to prove none forgot.
 *
 * ## Fail closed, on the name only
 *
 * A failed check changes which NAME renders. It never drops, hides, delays or
 * flags a message. Anything else would be a censorship weapon: forge a profile
 * as somebody, fail its verification, and watch their messages vanish. Delivery
 * and display stay separate concerns; a message has passed signature and
 * decryption long before any of this runs.
 *
 * ## Cost
 *
 * Bounded by distinct claimed NAMES on screen, not by members and not by
 * messages. Two accounts claiming the same name share one lookup. Mobile
 * measured a 100-name batch at ~190ms against ~167ms for one name, so a
 * screenful costs about what a single name costs — that measurement is what
 * makes verifying affordable rather than merely defensible.
 *
 * Claims only exist where a public profile was already fetched, and that fetch
 * is demand-driven (`enrich`), so this adds NO new per-address request: it adds
 * one batched request per screen, on top of fetches that were already happening.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  claimedNameBelongsTo,
  resolveNamesBatch,
  QNS_BATCH_LIMIT,
  type QnsBatchResult,
} from '@quilibrium/quorum-shared';
import type { PublicProfileResponse } from '../api/baseTypes';
import { isExemptClaim } from './qnsClaimExemption';

/**
 * Most claims verified for one screen.
 *
 * Equal to the server's batch maximum, so "one screen" is always "one request".
 * A claim past the cap is never looked up, so it stays unverified and the member
 * renders under their global name — the same thing a member with no cached
 * profile does today. The overflow can only ever under-show a real `.q`; it
 * cannot promote a forged one.
 */
export const QNS_CLAIM_LIMIT = QNS_BATCH_LIMIT;

/** A profile map as the provider holds it. */
export type ProfileMap = Record<string, PublicProfileResponse | null>;

/** Stable empties. These maps feed `IdentitySources`, which feeds memos all the
 *  way down to a virtualised list, so a fresh `{}` per render would invalidate
 *  every one of them on every tick. */
const NO_NAMES: Record<string, string> = {};
const NO_RECORDS: QnsBatchResult = {};

/** The name a profile is claiming, trimmed. Empty string when it claims none. */
const claimOf = (p: PublicProfileResponse | null | undefined): string =>
  (p?.primary_username ?? '').trim();

/**
 * The distinct names actually being claimed, capped at one batch.
 *
 * Distinct does real work in both directions. It is the cost property — one
 * lookup however many accounts claim the same name — and it is a security
 * property, because every claimant of a name is then judged against the same
 * single answer, so a collision is settled by the very request that verifies
 * whoever genuinely owns it.
 *
 * Whitespace is trimmed so a padded claim cannot dodge the dedupe. Case is NOT
 * folded: the resolver is the authority on what a name matches, and quietly
 * normalising here would mean verifying a name the user never claimed.
 */
export function claimedNamesIn(profiles: ProfileMap, limit: number = QNS_CLAIM_LIMIT): string[] {
  const seen = new Set<string>();
  for (const address of Object.keys(profiles)) {
    const name = claimOf(profiles[address]);
    if (name) seen.add(name);
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
}

/**
 * `address -> the profile's display name`. No trust claim, so no check.
 *
 * Separate from the verified map on purpose: a display name is not something
 * anyone can own, so gating it behind a network lookup would delay every name
 * on screen to protect a value that needs no protecting.
 */
export function profileGlobalNamesFrom(profiles: ProfileMap): Record<string, string> {
  const out: Record<string, string> = {};
  let any = false;
  for (const address of Object.keys(profiles)) {
    const name = (profiles[address]?.display_name ?? '').trim();
    if (name) {
      out[address] = name;
      any = true;
    }
  }
  return any ? out : NO_NAMES;
}

/**
 * `address -> a name PROVEN to belong to it`. Everything else is simply absent.
 *
 * **Unproven includes not-yet-known.** A lookup still in flight leaves the
 * address out, exactly as a rejected one does, so the global name renders. That
 * is the difference between this being a defence and being decoration: a `.q`
 * shown for even the instant before a lookup lands is the whole attack, because
 * a screenshot of that instant does not expire. Only ever upgrade INTO a `.q`,
 * never render one optimistically and correct it.
 */
export function verifiedNamesFrom(
  profiles: ProfileMap,
  records: QnsBatchResult,
  isExempt: (name: string, address: string) => boolean = isExemptClaim,
): Record<string, string> {
  const out: Record<string, string> = {};
  let any = false;

  for (const address of Object.keys(profiles)) {
    const claim = claimOf(profiles[address]);
    if (!claim) continue;

    // The claimant address is the key of the map the claim arrived in — never a
    // value read out of the claim's own payload, which would let a forger
    // supply both sides of the comparison.
    if (isExempt(claim, address) || claimedNameBelongsTo(records[claim], address)) {
      out[address] = claim;
      any = true;
    }
  }

  return any ? out : NO_NAMES;
}

/**
 * Resolve every claimed name in one request, and return the verified map.
 *
 * `staleTime` is a SECURITY parameter here, not a performance one: it is the
 * window in which a name that has been transferred away keeps verifying under
 * its previous owner. One hour, matching the public-profile cache so a member's
 * identity does not half-refresh. Do not shorten it for freshness or lengthen
 * it for cost without saying so here — and note the interactive lookup in
 * `useResolveQnsName.ts` deliberately uses a DIFFERENT, shorter value for a
 * different question. The two are not meant to agree.
 */
export function useVerifiedQnsNames(profiles: ProfileMap): Record<string, string> {
  const names = React.useMemo(() => claimedNamesIn(profiles), [profiles]);
  // Sorted, so two surfaces holding the same claimants in a different insertion
  // order share one cache entry instead of issuing the same request twice.
  const namesKey = React.useMemo(() => [...names].sort().join('|'), [names]);

  const { data } = useQuery({
    queryKey: ['qns-verify-claims', namesKey],
    queryFn: () => resolveNamesBatch(names),
    enabled: names.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    // A retry only extends the window in which real claims render unverified.
    // They degrade to the global name meanwhile, which is correct but invisible,
    // so prefer settling fast and refreshing on the next natural cache miss.
    //
    // Note the transport THROWS on failure rather than reporting every name
    // unresolved (see `resolveNamesBatch`). That matters with a one-hour
    // staleTime: a swallowed error would cache "nobody owns anything" for an
    // hour after a single blip. An error caches nothing, so the next mount
    // retries.
    retry: false,
    // Carry the previous answer while a wider set resolves, or every name on
    // screen flickers whenever a new claimant appears. Safe in the fail-closed
    // direction, which is why it is allowed: the carried map is keyed by name
    // and holds the same records this key would fetch, so no verdict changes. A
    // name that is NEW in the wider set is simply absent from it, and absent
    // means unverified — carrying it forward can only under-show, never promote
    // something unchecked.
    placeholderData: (previous) => previous,
  });

  const records = data ?? NO_RECORDS;
  return React.useMemo(() => verifiedNamesFrom(profiles, records), [profiles, records]);
}
