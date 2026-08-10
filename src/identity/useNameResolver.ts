import * as React from 'react';
import { resolveIdentity, type MemberIdentity } from '@quilibrium/quorum-shared';
import { identityFromMaps, useIdentityContext } from './identityProvider';
import type { ResolvedMemberName } from './useResolvedName';

export interface NameResolverOptions {
  /** Override the surrounding scope, exactly like `useResolvedMemberName`'s
   *  `spaceId`. Rarely needed — a detached bulk-resolving surface should
   *  usually mount its own `<IdentityScopeProvider spaceId={...}>` instead
   *  of passing this per call. */
  spaceId?: string;
  /** Force the global ladder even inside a Space. Rarely needed. */
  global?: boolean;
}

export interface NameResolver {
  /**
   * Resolve one address to a name, synchronously, from the maps already held
   * by the surrounding `<IdentityScopeProvider>` — the exact same
   * `identityFromMaps` + `resolveIdentity` read `<MemberName>` and
   * `useResolvedMemberName` use, so the same address renders the same
   * string in a pill and in a header. Does NOT request a profile; call
   * `requestNames` for any address that should be able to show its ".q".
   */
  resolve: (address: string, opts?: NameResolverOptions) => ResolvedMemberName;
  /**
   * Ask for public profiles for a whole SET of addresses in one call — the
   * imperative equivalent of passing `enrich` to `useResolvedMemberName`.
   * Dedupes against addresses already requested (see
   * `IdentityScopeProvider.request`), so calling this every render with the
   * same set is a no-op, not a fetch storm.
   */
  requestNames: (addresses: Iterable<string>) => void;
}

/**
 * Imperative, bulk name resolution for surfaces that build many labels
 * OUTSIDE React's normal per-item render tree — raw DOM mention pills
 * (`mentionPillDom`, used by the contentEditable message editor) and a
 * markdown token walk (`MessageMarkdownRenderer.processMentionTokens`) both
 * need to turn N addresses into names inside a loop, where N is not known
 * until the text is parsed. Hooks cannot be called per-address in that loop
 * — this repo has a documented history of hooks-order bugs from exactly this
 * shape (see AGENTS.md's React Hooks Rules) — so this hook is called ONCE at
 * the top of the component and hands back two plain functions instead:
 *
 * - `resolve(address)` is safe to call per-address inside a loop or
 *   callback: it is a pure read of `identityFromMaps` + `resolveIdentity`,
 *   the SAME ladder `<MemberName>` and `useResolvedMemberName` use, so it
 *   never re-implements the tier-assembly or scope rules itself. That
 *   duplication — every call site re-deriving "which name wins" — is
 *   exactly what the eslint ratchet in `eslint.config.js` exists to keep
 *   from regrowing.
 * - `requestNames(addresses)` opts a whole BATCH of addresses into a profile
 *   fetch in one call, typically from a `useEffect` keyed on a memoized
 *   address set. Never call `request()` per rendered pill — that is the
 *   fetch storm `enrich` on a virtualised list is designed to avoid (see
 *   `UseResolvedNameOptions.enrich`, design decision 3).
 *
 * `resolve`'s function identity changes only when the provider's `sources`
 * or `defaultSpaceId` change (new profile data, a roster edit, or a space
 * switch) — not on every render — so a caller can put it in a dependency
 * array (e.g. the `useCallback` that builds each pill's label) without
 * rebuilding every pill on every unrelated render.
 *
 * A single-address surface (a header, a card) should use `<MemberName>` /
 * `useResolvedMemberName` directly instead — this hook exists only for the
 * "many addresses, outside JSX" shape above.
 */
export function useNameResolver(): NameResolver {
  const { sources, defaultSpaceId, request } = useIdentityContext();

  const resolve = React.useCallback(
    (address: string, opts: NameResolverOptions = {}): ResolvedMemberName => {
      const effectiveSpaceId = opts.spaceId ?? defaultSpaceId;
      const identity: MemberIdentity = identityFromMaps(address, effectiveSpaceId, sources);
      const scope = opts.global || !effectiveSpaceId ? 'global' : 'space';
      return resolveIdentity(identity, { scope });
    },
    [sources, defaultSpaceId],
  );

  const requestNames = React.useCallback(
    (addresses: Iterable<string>) => {
      for (const address of addresses) request(address);
    },
    [request],
  );

  return React.useMemo(() => ({ resolve, requestNames }), [resolve, requestNames]);
}
