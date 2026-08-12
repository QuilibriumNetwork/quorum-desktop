/**
 * Identity Coverage — the resident panel.
 *
 * Step 4 of `2026-08-01-identity-announce-cadence-research.md` under .agents/issues/:
 * the instrument that turns "we think the identity fixes worked" into a number
 * you take twice, before and after, in one click.
 *
 * Reads straight from IndexedDB, so it measures what PERSISTED — not what
 * rendered once from an in-memory fallback. Reloading the app and taking a
 * second snapshot is the point, not a caveat.
 */

import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Text, Flex, Button, Icon } from '../../components/primitives';
import { DevPage, DevPageHeader, DevStat, type DevStatTone } from '../shell';
import {
  buildIdentityCoverageSnapshot,
  computeCoverageDelta,
  formatIdentityCoverageReport,
  formatSigned,
  summarisePublicProfileProbe,
  HISTORICAL_BASELINE,
  type IdentityCoverageSnapshot,
} from './identityCoverageCore';
import {
  probePublicProfiles,
  readIdentityCoverageStores,
} from './identityCoverageDb';
import {
  getIdentityDiagnosticsState,
  subscribeIdentityDiagnostics,
} from '../../identity';

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/** Green when the count is zero, red otherwise — the acceptance criterion for
 *  the whole task is this number reaching zero and staying there. */
function countTone(value: number): DevStatTone {
  return value === 0 ? 'good' : 'bad';
}

/** For a delta, any increase is bad and flat-or-down is good — the opposite
 *  polarity to `countTone`, which reads a raw count. */
function deltaTone(value: number): DevStatTone {
  return value > 0 ? 'bad' : 'good';
}

/** Same rule, as a class, for the table cells that colour their own text
 *  rather than going through `DevStat`. */
function countToneClass(value: number): string {
  return value === 0 ? 'text-green-500' : 'text-red-500';
}

/**
 * Live counter for `src/identity/diagnostics.ts` — the resolver-side
 * instrument, distinct from everything else on this page. Everything above
 * reads IndexedDB, a snapshot you take on demand; this reads an in-memory
 * event log that updates itself the moment a resolution degrades, just from
 * clicking around the app normally (open the nav rail, open Kick/Mute/Block,
 * scroll a channel) — no special mode, no snapshot button.
 *
 * `useSyncExternalStore` rather than a `useEffect` + `useState` subscribe
 * dance: the diagnostic module already exposes a plain subscribe/getSnapshot
 * pair (`subscribeIdentityDiagnostics` / `getIdentityDiagnosticsState`),
 * which is exactly what this hook is for, and it avoids the classic bug of
 * missing an update that fires between render and effect-mount.
 *
 * "0 degraded resolutions this session" is a positive signal, not merely the
 * absence of a warning — the operator can read it as "the instrument is
 * live and has caught nothing" rather than wonder whether it's running at
 * all.
 */
const LiveResolutionDiagnostics: React.FC = () => {
  const state = useSyncExternalStore(
    subscribeIdentityDiagnostics,
    getIdentityDiagnosticsState,
    getIdentityDiagnosticsState,
  );

  return (
    <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
      <Flex justify="between" align="center" className="mb-2 flex-wrap gap-2">
        <Text variant="strong" size="lg">
          Live resolution diagnostics (this session)
        </Text>
        <Text variant="strong" size="xl" className={countToneClass(state.degradedTotal)}>
          {state.degradedTotal} degraded resolution{state.degradedTotal === 1 ? '' : 's'}
        </Text>
      </Flex>
      <Text variant="subtle" size="xs" className="mb-3 block">
        Fires the instant a name resolves to a truncated address from a
        provider that was missing data it should have had (your own identity
        with no local source, or a Space roster this provider never loaded) —
        NOT for a genuinely unknown member, which is counted separately below
        and never warned to the console. Click around the app normally; this
        updates live. Resets on reload — it is a session counter, not a
        persisted log.
      </Text>
      <Flex gap="lg" className="flex-wrap mb-2">
        <DevStat
          label="Degraded"
          value={state.degradedTotal}
          hint="provider missing data it should have had"
          tone={countTone(state.degradedTotal)}
        />
        <DevStat
          label="Expected (no source anywhere)"
          value={state.expectedTotal}
          hint="likely a genuinely unknown member — not warned"
        />
      </Flex>
      {state.events.length > 0 && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-default">
                <th className="py-1 pr-4">When</th>
                <th className="py-1 pr-4">Surface</th>
                <th className="py-1 pr-4">Address</th>
                <th className="py-1 pr-4">Scope</th>
                <th className="py-1 pr-4">Reason</th>
                <th className="py-1">×</th>
              </tr>
            </thead>
            <tbody>
              {state.events.slice(0, 20).map((e) => (
                <tr
                  key={`${e.address}|${e.scope}|${e.spaceId ?? ''}|${e.reason}`}
                  className="border-b border-default/50"
                >
                  <td className="py-1 pr-4 font-mono text-xs">{e.at}</td>
                  <td className="py-1 pr-4">{e.surface}</td>
                  <td className="py-1 pr-4 font-mono text-xs">
                    {truncateAddress(e.address)}
                    {e.isSelf && ' (you)'}
                  </td>
                  <td className="py-1 pr-4">
                    {e.scope}
                    {e.spaceId ? ` (${truncateAddress(e.spaceId)})` : ''}
                  </td>
                  <td className={`py-1 pr-4 ${e.degraded ? 'text-red-500' : ''}`}>{e.reason}</td>
                  <td className="py-1">{e.occurrences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const IdentityCoverage: React.FC = () => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address ?? null;

  const [history, setHistory] = useState<IdentityCoverageSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeProgress, setProbeProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const latest = history[history.length - 1] ?? null;
  const delta = useMemo(
    () =>
      history.length >= 2
        ? computeCoverageDelta(history[0], history[history.length - 1])
        : null,
    [history]
  );

  const takeSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stores = await readIdentityCoverageStores();
      const snapshot = buildIdentityCoverageSnapshot({
        atIso: new Date().toISOString(),
        ownAddress,
        spaces: stores.spaces,
        members: stores.members,
        messages: stores.messages,
        conversations: stores.conversations,
      });
      setHistory((prev) => [...prev, snapshot]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Snapshot failed');
    } finally {
      setLoading(false);
    }
  }, [ownAddress]);

  /**
   * Probe every address that has no local identity — both the senders with no
   * member row and the rows carrying nothing — and attach the summary to the
   * most recent snapshot. Opt-in because it is one network call per address.
   */
  const runPublicProfileProbe = useCallback(async () => {
    if (!latest) return;
    setProbing(true);
    setError(null);
    try {
      const addresses = new Set<string>();
      for (const space of latest.spaces) {
        for (const sender of space.missingSenders) {
          if (!sender.isSelf) addresses.add(sender.address);
        }
        for (const row of space.rowsWithoutIdentity) {
          addresses.add(row.address);
        }
      }
      for (const row of latest.dms.rowsWithoutIdentity) {
        addresses.add(row.address);
      }

      const list = [...addresses];
      if (list.length === 0) {
        setProbeProgress('Nothing to probe — no addresses lack local identity.');
        return;
      }

      setProbeProgress(`0/${list.length}`);
      const results = await probePublicProfiles(list, (done, total) =>
        setProbeProgress(`${done}/${total}`)
      );
      const summary = summarisePublicProfileProbe(results);

      setHistory((prev) =>
        prev.map((snapshot, index) =>
          index === prev.length - 1
            ? { ...snapshot, publicProfile: summary }
            : snapshot
        )
      );
      setProbeProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Public-profile probe failed');
    } finally {
      setProbing(false);
    }
  }, [latest]);

  const copyReport = useCallback(async () => {
    try {
      const report = formatIdentityCoverageReport({
        generatedAtIso: new Date().toISOString(),
        history,
      });
      await navigator.clipboard.writeText(report);
      setCopyStatus('Report copied!');
    } catch {
      setCopyStatus('Failed to copy');
    } finally {
      setTimeout(() => setCopyStatus(null), 2000);
    }
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setProbeProgress(null);
  }, []);

  return (
    <DevPage width="standard">
        <DevPageHeader
          icon="id-badge"
          title="Identity Coverage"
          subtitle={`How many people cannot render as anything but a truncated address. Own address: ${
            ownAddress ? truncateAddress(ownAddress) : 'unknown (not signed in)'
          }`}
        />

        {copyStatus && (
          <div className="fixed top-4 right-4 bg-surface-2 border border-accent px-4 py-2 rounded-lg shadow-lg z-50">
            <Text variant="main" size="sm">
              {copyStatus}
            </Text>
          </div>
        )}

        <LiveResolutionDiagnostics />

        {/* Controls */}
        <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
          <Flex gap="md" align="center" className="flex-wrap">
            <Button variant="primary" onClick={takeSnapshot} disabled={loading}>
              <Icon
                name={loading ? 'spinner' : 'search'}
                size="sm"
                className={loading ? 'animate-spin' : undefined}
              />
              {loading ? 'Reading…' : 'Take snapshot'}
            </Button>
            {latest && (
              <Button
                variant="secondary"
                onClick={runPublicProfileProbe}
                disabled={probing}
              >
                <Icon
                  name={probing ? 'spinner' : 'globe-search'}
                  size="sm"
                  className={probing ? 'animate-spin' : undefined}
                />
                {probing
                  ? `Probing ${probeProgress ?? ''}`
                  : 'Probe public profiles'}
              </Button>
            )}
            {history.length > 0 && (
              <>
                <Button variant="primary" onClick={copyReport}>
                  <Icon name="copy" size="sm" />
                  Copy report
                </Button>
                <Button variant="secondary" onClick={clearHistory}>
                  Clear ({history.length})
                </Button>
              </>
            )}
          </Flex>
          <Text variant="subtle" size="xs" className="mt-2 block">
            Counts a person as having no identity when the per-space override
            slot AND the global slot are both empty — the two-slot model the
            older console probe (06-space-member-sources.js) predates. Read
            straight from IndexedDB, so this measures what persisted. Take one
            snapshot, reload the app, take another: the delta is the
            measurement. Baseline for comparison — {HISTORICAL_BASELINE}
          </Text>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-6">
            <Text variant="strong" className="text-red-500">
              {error}
            </Text>
          </div>
        )}

        {probeProgress && !probing && (
          <div className="bg-surface-1 border border-default rounded-lg p-3 mt-6">
            <Text variant="subtle" size="sm">
              {probeProgress}
            </Text>
          </div>
        )}

        {/* Delta */}
        {delta && (
          <div className="bg-surface-1 rounded-lg border border-accent p-4 mt-6">
            <Text variant="strong" size="lg" className="mb-3">
              Delta — first snapshot to last (negative is improvement)
            </Text>
            <Flex gap="lg" className="flex-wrap">
              <DevStat
                label="Senders with no member row"
                value={formatSigned(delta.sendersWithNoRow)}
                tone={deltaTone(delta.sendersWithNoRow)}
              />
              <DevStat
                label="Rows with no identity"
                value={formatSigned(delta.rowsNoIdentity)}
                tone={deltaTone(delta.rowsNoIdentity)}
              />
              <DevStat
                label="No-identity total"
                value={formatSigned(delta.noIdentityTotal)}
                tone={deltaTone(delta.noIdentityTotal)}
              />
              <DevStat
                label="DM rows with no identity"
                value={formatSigned(delta.dmRowsNoIdentity)}
                tone={deltaTone(delta.dmRowsNoIdentity)}
              />
            </Flex>
          </div>
        )}

        {/* Latest snapshot */}
        {latest && (
          <>
            <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
              <Flex justify="between" align="center" className="mb-4">
                <Text variant="strong" size="lg">
                  Latest snapshot — {latest.atIso}
                </Text>
                <Text
                  variant="strong"
                  size="2xl"
                  className={countToneClass(latest.totals.noIdentityTotal)}
                >
                  {latest.totals.noIdentityTotal} with no identity
                </Text>
              </Flex>

              <Flex gap="lg" className="flex-wrap mb-4">
                <DevStat
                  label="Senders with no member row"
                  value={latest.totals.sendersWithNoRow}
                  hint="their join never arrived"
                  tone={countTone(latest.totals.sendersWithNoRow)}
                />
                <DevStat
                  label="Rows with no identity"
                  value={latest.totals.rowsNoIdentity}
                  hint="row arrived carrying nothing"
                  tone={countTone(latest.totals.rowsNoIdentity)}
                />
                <DevStat
                  label="Distinct senders"
                  value={latest.totals.distinctSenders}
                />
                <DevStat label="Member rows" value={latest.totals.memberRows} />
                <DevStat
                  label="Rows with no name"
                  value={latest.totals.rowsNoName}
                />
                <DevStat
                  label="Rows with no avatar"
                  value={latest.totals.rowsNoIcon}
                />
              </Flex>

              <Text variant="subtle" size="xs" className="block">
                The two headline figures are kept apart because they have
                different causes and different fixes: a missing row is a
                join/sync transport gap, an empty row is an announce/digest gap.
                They are disjoint sets, so the total is their sum. Read from{' '}
                {latest.messagesScanned} message rows, {latest.memberRowsScanned}{' '}
                member rows, {latest.conversationsScanned} conversation rows.
              </Text>
            </div>

            {/* Public-profile probe */}
            {latest.publicProfile && (
              <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
                <Text variant="strong" size="lg" className="mb-3">
                  Public-profile probe
                </Text>
                <Flex gap="lg" className="flex-wrap mb-2">
                  <DevStat label="Probed" value={latest.publicProfile.probed} />
                  <DevStat
                    label="Recoverable at render"
                    value={latest.publicProfile.recoverable}
                    hint="public profile can fill it"
                    tone="warn"
                  />
                  <DevStat
                    label="No source anywhere"
                    value={latest.publicProfile.noSource}
                    hint="never opted in — irreducible"
                    tone={countTone(latest.publicProfile.noSource)}
                  />
                  <DevStat
                    label="Fetch errors"
                    value={latest.publicProfile.errors}
                    hint="not evidence of a missing profile"
                  />
                </Flex>
              </div>
            )}

            {/* Per space */}
            <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
              <Text variant="strong" size="lg" className="mb-3">
                Per space (worst first)
              </Text>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-default">
                      <th className="py-1 pr-4">Space</th>
                      <th className="py-1 pr-4">Senders</th>
                      <th className="py-1 pr-4">No member row</th>
                      <th className="py-1 pr-4">Rows</th>
                      <th className="py-1 pr-4">Rows w/o identity</th>
                      <th className="py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.spaces.map((space) => (
                      <tr
                        key={space.spaceId}
                        className="border-b border-default/50"
                      >
                        <td className="py-1 pr-4">
                          {space.spaceName}
                          {space.selfMissingRow && (
                            <span className="ml-2 bg-yellow-500/20 text-yellow-500 text-xs px-2 py-0.5 rounded font-medium">
                              own row missing
                            </span>
                          )}
                        </td>
                        <td className="py-1 pr-4">{space.distinctSenders}</td>
                        <td
                          className={`py-1 pr-4 ${countToneClass(space.sendersWithNoRow)}`}
                        >
                          {space.sendersWithNoRow}
                        </td>
                        <td className="py-1 pr-4">{space.memberRows}</td>
                        <td
                          className={`py-1 pr-4 ${countToneClass(space.rowsNoIdentity)}`}
                        >
                          {space.rowsNoIdentity}
                        </td>
                        <td
                          className={`py-1 font-medium ${countToneClass(space.noIdentityTotal)}`}
                        >
                          {space.noIdentityTotal}
                        </td>
                      </tr>
                    ))}
                    {latest.spaces.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-subtle">
                          No spaces in the local database.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DMs */}
            <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
              <Text variant="strong" size="lg" className="mb-3">
                Direct messages
              </Text>
              <Flex gap="lg" className="flex-wrap">
                <DevStat label="Direct rows" value={latest.dms.directRows} />
                <DevStat
                  label="Rows with no identity"
                  value={latest.dms.rowsNoIdentity}
                  tone={countTone(latest.dms.rowsNoIdentity)}
                />
                <DevStat label="Rows with no name" value={latest.dms.rowsNoName} />
                <DevStat label="Rows with no avatar" value={latest.dms.rowsNoIcon} />
                {latest.dms.selfRows > 0 && (
                  <DevStat
                    label="Self-keyed rows"
                    value={latest.dms.selfRows}
                    hint="excluded — ghost conversation"
                    tone="warn"
                  />
                )}
              </Flex>
            </div>

            {/* Snapshot history */}
            {history.length > 1 && (
              <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
                <Text variant="strong" size="lg" className="mb-3">
                  Snapshots this session
                </Text>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-default">
                        <th className="py-1 pr-4">#</th>
                        <th className="py-1 pr-4">Taken at</th>
                        <th className="py-1 pr-4">No member row</th>
                        <th className="py-1 pr-4">Rows w/o identity</th>
                        <th className="py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((snapshot, index) => (
                        <tr
                          key={snapshot.atIso}
                          className="border-b border-default/50"
                        >
                          <td className="py-1 pr-4">{index + 1}</td>
                          <td className="py-1 pr-4 font-mono text-xs">
                            {snapshot.atIso}
                          </td>
                          <td className="py-1 pr-4">
                            {snapshot.totals.sendersWithNoRow}
                          </td>
                          <td className="py-1 pr-4">
                            {snapshot.totals.rowsNoIdentity}
                          </td>
                          <td
                            className={`py-1 font-medium ${countToneClass(snapshot.totals.noIdentityTotal)}`}
                          >
                            {snapshot.totals.noIdentityTotal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!latest && !loading && (
          <div className="bg-surface-1 rounded-lg border border-default p-8 mt-6 text-center">
            <Text variant="subtle">
              Take a snapshot to read the current identity coverage.
            </Text>
          </div>
        )}
    </DevPage>
  );
};
