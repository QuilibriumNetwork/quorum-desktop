import { useQuery } from '@tanstack/react-query';
import { resolveName, deriveAddress } from '@quilibrium/quorum-shared';

export interface ResolvedQnsName {
  /** The Qm… address the name points to, or null if not publicly resolvable. */
  address: string | null;
  /** The raw record returned by the resolver (null when the name is unknown). */
  record: Awaited<ReturnType<typeof resolveName>>;
}

/**
 * Resolve a QNS @username to a Qm… address via the shared resolver.
 *
 * `name` should already have the leading '@' stripped. The query is disabled
 * for empty input. A resolved record carries a hex ed448 `resolveKey`, which we
 * derive into the canonical Qm… address; if the name has no public resolveKey,
 * `address` is null (resolvable name but not publicly addressable).
 *
 * 5-minute staleTime/gcTime matches mobile's QNS resolution cache window.
 */
export const useResolveQnsName = (name: string, opts?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['qns', 'resolve', name],
    enabled: (opts?.enabled ?? true) && name.length >= 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ResolvedQnsName> => {
      const record = await resolveName(name);
      const address = record?.resolveKey
        ? deriveAddress(record.resolveKey)
        : null;
      return { address, record };
    },
  });
