import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Text, Flex, Button, Icon, Input, Select } from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
import { DevStat } from '../shell';
import {
  scanSequence,
  findGhostConversations,
  buildDirectConversationInventory,
  formatMeasurementRow,
  formatFullReport,
  computeScanWindowStart,
  SCAN_WINDOW_LABELS,
  type ScanResult,
  type ScanWindowOption,
  type ScanHistoryEntry,
  type GhostConversationRow,
  type DirectConversationInventory,
} from './dmDoctorCore';
import { readAllMessages, readAllConversations } from './dmDoctorDb';
import {
  installDmWarningCounters,
  getDmWarningState,
  type DmWarningCounterState,
  type DmWarningKey,
} from './warningCounters';

const WARNING_LABELS: Record<DmWarningKey, string> = {
  sessionReplaced: 'SESSION REPLACED by init envelope',
  unknownInbox: 'DM frame for unknown inbox',
  decryptFailish: 'decrypt fail/error/unable',
};

const WARNING_POLL_MS = 5000;

const WINDOW_OPTIONS: Array<{ value: ScanWindowOption; label: string }> = (
  ['since-load', '1h', '6h', '24h', 'all'] as ScanWindowOption[]
).map((value) => ({ value, label: SCAN_WINDOW_LABELS[value] }));

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

function formatIsoOrNa(ms: number | null): string {
  return ms === null ? 'n/a' : new Date(ms).toISOString();
}

export const DmDoctor: React.FC = () => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address ?? null;

  // "since page load" window option and the report's shared-context field both
  // key off this — captured once, at mount.
  const [pageLoadMs] = useState(() => Date.now());
  const [pageLoadIso] = useState(() => new Date(pageLoadMs).toISOString());

  const [prefix, setPrefix] = useState('');
  const [expectedInput, setExpectedInput] = useState('20');
  const [windowOption, setWindowOption] = useState<ScanWindowOption>('6h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanExpected, setScanExpected] = useState(20);
  const [scanPrefix, setScanPrefix] = useState('');
  const [ghosts, setGhosts] = useState<GhostConversationRow[] | null>(null);
  const [inventory, setInventory] = useState<DirectConversationInventory | null>(null);
  const [warningState, setWarningState] = useState<DmWarningCounterState | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const historyIdRef = useRef(0);

  // Defensive re-install: the panel's own life cycle is not the intended
  // install point (that's the dev-only startup import in web/main.tsx, so
  // counting starts at t=0), but installDmWarningCounters() is idempotent, so
  // calling it here just guarantees the counters exist if this page is ever
  // opened without that startup wiring having run (e.g. a broken HMR state).
  useEffect(() => {
    setWarningState(installDmWarningCounters());
    const interval = setInterval(() => {
      setWarningState(getDmWarningState());
    }, WARNING_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const expected = Math.max(1, parseInt(expectedInput, 10) || 0) || 20;
      const [messages, conversations] = await Promise.all([
        readAllMessages(),
        readAllConversations(),
      ]);
      const startMs = computeScanWindowStart(windowOption, Date.now(), pageLoadMs);
      const result = scanSequence(messages, prefix, expected, ownAddress, {
        option: windowOption,
        startMs,
      });
      setScanResult(result);
      setGhosts(findGhostConversations(conversations, ownAddress));
      setInventory(buildDirectConversationInventory(conversations, messages, ownAddress));
      setScanExpected(expected);
      setScanPrefix(prefix);

      historyIdRef.current += 1;
      setHistory((prev) => [
        ...prev,
        {
          id: `scan-${historyIdRef.current}`,
          atIso: new Date().toISOString(),
          prefix,
          expected,
          ownAddress,
          messagesScanned: messages.length,
          conversationsScanned: conversations.length,
          scanResult: result,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [expectedInput, prefix, ownAddress, windowOption, pageLoadMs]);

  const clearHistory = useCallback(() => setHistory([]), []);

  const copyMeasurementRow = useCallback(async () => {
    if (!scanResult) return;
    try {
      const row = formatMeasurementRow(scanResult, {
        when: new Date().toISOString().slice(0, 10),
        run: `DM doctor scan (prefix "${scanPrefix}")`,
        configuration: ownAddress
          ? `own=${truncateAddress(ownAddress)}`
          : 'own address unknown',
        expected: scanExpected,
        source: 'DM doctor panel (/dev/dm-doctor)',
      });
      await navigator.clipboard.writeText(row);
      setCopyStatus('Measurement row copied!');
    } catch {
      setCopyStatus('Failed to copy');
    } finally {
      setTimeout(() => setCopyStatus(null), 2000);
    }
  }, [scanResult, scanPrefix, scanExpected, ownAddress]);

  const copyFullReport = useCallback(async () => {
    try {
      const report = formatFullReport({
        generatedAtIso: new Date().toISOString(),
        ownAddress,
        pageLoadedAtIso: pageLoadIso,
        history,
        ghosts,
        inventory,
        warningState,
      });
      await navigator.clipboard.writeText(report);
      setCopyStatus('Full report copied!');
    } catch {
      setCopyStatus('Failed to copy');
    } finally {
      setTimeout(() => setCopyStatus(null), 2000);
    }
  }, [ownAddress, pageLoadIso, history, ghosts, inventory, warningState]);

  const distribution = scanResult
    ? Object.entries(scanResult.byConversation).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="min-h-screen bg-app">
      <DevNavMenu currentPath="/dev/dm-doctor" sticky />

      <div className="p-6 mx-auto max-w-5xl">
        <Flex gap="sm" align="center" className="mb-2">
          <Icon name="bug" size="xl" className="text-accent" />
          <div>
            <Text as="h1" variant="strong" size="2xl" weight="bold">
              DM Doctor
            </Text>
            <Text variant="subtle" size="sm">
              Resident diagnostic for the DM-loss / misfiling investigation. Own
              address: {ownAddress ? truncateAddress(ownAddress) : 'unknown (not signed in)'}
            </Text>
          </div>
        </Flex>

        {copyStatus && (
          <div className="fixed top-4 right-4 bg-surface-2 border border-accent px-4 py-2 rounded-lg shadow-lg z-50">
            <Text variant="main" size="sm">{copyStatus}</Text>
          </div>
        )}

        {/* Controls */}
        <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
          <Text variant="strong" size="lg" className="mb-3">
            Sequence scan
          </Text>
          <Flex gap="md" align="end" className="flex-wrap">
            <div className="w-32">
              <Input
                label="Prefix"
                placeholder="e.g. V"
                value={prefix}
                onChange={(value: string) => setPrefix(value.slice(0, 1))}
              />
            </div>
            <div className="w-40">
              <Input
                label="Expected count"
                type="number"
                placeholder="20"
                value={expectedInput}
                onChange={(value: string) => setExpectedInput(value)}
              />
            </div>
            <div className="w-44">
              <Text variant="subtle" size="xs" className="mb-1 block">
                Window
              </Text>
              <Select
                value={windowOption}
                options={WINDOW_OPTIONS}
                onChange={(value: string) => setWindowOption(value as ScanWindowOption)}
                width="176px"
                dropdownPlacement="bottom"
              />
            </div>
            <Button variant="primary" onClick={runScan} disabled={loading}>
              <Icon name={loading ? 'spinner' : 'search'} size="sm" className={loading ? 'animate-spin' : undefined} />
              {loading ? 'Scanning...' : 'Run'}
            </Button>
            {scanResult && (
              <Button variant="secondary" onClick={copyMeasurementRow}>
                <Icon name="copy" size="sm" />
                Copy measurement row
              </Button>
            )}
            {history.length > 0 && (
              <Button variant="primary" onClick={copyFullReport}>
                <Icon name="copy" size="sm" />
                Copy full report
              </Button>
            )}
          </Flex>
          <Text variant="subtle" size="xs" className="mt-2">
            Scans the WHOLE messages store for "{'{prefix} N'}" (case-insensitive),
            same matching as .agents/tools/dm-debug/07-receiver-probe.js. Prefix
            letters get reused across test rounds, so matches outside the
            selected window are excluded from the counts below but never hidden
            from the report.
          </Text>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-6">
            <Text variant="strong" className="text-red-500">{error}</Text>
          </div>
        )}

        {/* Results */}
        {scanResult && (
          <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
            <Flex justify="between" align="center" className="mb-4">
              <Text variant="strong" size="lg">
                Results — prefix "{scanPrefix}" ({SCAN_WINDOW_LABELS[scanResult.window.option]})
              </Text>
              <Text
                variant="strong"
                size="xl"
                className={scanResult.missing.length ? 'text-red-500' : 'text-green-500'}
              >
                {scanResult.landed}/{scanExpected} landed
              </Text>
            </Flex>

            {scanResult.window.matchesOutsideWindow > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-4">
                <Text variant="strong" size="sm" className="text-yellow-500">
                  {scanResult.window.matchesOutsideWindow} match(es) for this prefix fall OUTSIDE the
                  selected window (oldest {formatIsoOrNa(scanResult.window.outsideOldestMs)}, newest{' '}
                  {formatIsoOrNa(scanResult.window.outsideNewestMs)}) — a previous run may have used this
                  same letter. Not counted in landed/missing above; widen the window to see them.
                </Text>
              </div>
            )}

            {scanResult.window.spanSuspicious && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-4">
                <Text variant="strong" size="sm" className="text-yellow-500">
                  SPAN-SUSPICIOUS: in-window hits span {Math.round(scanResult.window.spanSeconds ?? 0)}s
                  (over 30 minutes) — the window likely caught more than one run. Narrow the window.
                </Text>
              </div>
            )}

            <Flex gap="lg" className="flex-wrap mb-4">
              <div>
                <Text variant="subtle" size="xs">Missing</Text>
                <Text variant={scanResult.missing.length ? 'strong' : 'main'} size="sm" className={scanResult.missing.length ? 'text-red-500' : ''}>
                  {scanResult.missing.length ? scanResult.missing.join(', ') : 'none'}
                </Text>
              </div>
              <div>
                <Text variant="subtle" size="xs">Duplicates</Text>
                <Text variant={scanResult.duplicates ? 'strong' : 'main'} size="sm" className={scanResult.duplicates ? 'text-yellow-500' : ''}>
                  {scanResult.duplicates}
                </Text>
              </div>
              <div>
                <Text variant="subtle" size="xs">Rows scanned across</Text>
                <Text variant="main" size="sm">{distribution.length} conversation(s)</Text>
              </div>
            </Flex>

            <Text variant="strong" size="sm" className="mb-2">Per-conversation distribution</Text>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-default">
                    <th className="py-1 pr-4">Conversation key (spaceId)</th>
                    <th className="py-1 pr-4">Count</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.map(([spaceId, count]) => {
                    const isGhost = Boolean(ownAddress) && spaceId === ownAddress;
                    return (
                      <tr key={spaceId} className="border-b border-default/50">
                        <td className="py-1 pr-4 font-mono">{truncateAddress(spaceId)}</td>
                        <td className="py-1 pr-4">{count}</td>
                        <td className="py-1">
                          {isGhost ? (
                            <span className="bg-red-500/20 text-red-500 text-xs px-2 py-0.5 rounded font-medium">
                              GHOST — filed under this account's own address
                            </span>
                          ) : (
                            <span className="text-subtle text-xs">ok</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {distribution.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-subtle">
                        No rows matched this prefix in-window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Scan history */}
        <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
          <Flex justify="between" align="center" className="mb-3">
            <Flex gap="sm" align="center">
              <Icon name="clock" size="md" className="text-accent" />
              <Text variant="strong" size="lg">Session scan history ({history.length})</Text>
            </Flex>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory}>
                <Icon name="trash" size="sm" />
                Clear history
              </Button>
            )}
          </Flex>
          {history.length === 0 ? (
            <Text variant="subtle" size="sm">
              No scans run yet this session. Every scan you run is kept here (and in "Copy full
              report") until you clear it or reload the page.
            </Text>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-default">
                    <th className="py-1 pr-4">#</th>
                    <th className="py-1 pr-4">Read at</th>
                    <th className="py-1 pr-4">Prefix</th>
                    <th className="py-1 pr-4">Window</th>
                    <th className="py-1 pr-4">Landed</th>
                    <th className="py-1">Outside window</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => (
                    <tr key={entry.id} className="border-b border-default/50">
                      <td className="py-1 pr-4">{i + 1}</td>
                      <td className="py-1 pr-4 font-mono">{entry.atIso}</td>
                      <td className="py-1 pr-4">{entry.prefix}</td>
                      <td className="py-1 pr-4">{SCAN_WINDOW_LABELS[entry.scanResult.window.option]}</td>
                      <td className="py-1 pr-4">
                        {entry.scanResult.landed}/{entry.expected}
                      </td>
                      <td className="py-1">{entry.scanResult.window.matchesOutsideWindow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Warnings */}
        <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
          <Flex justify="between" align="center" className="mb-3">
            <Flex gap="sm" align="center">
              <Icon name="warning" size="md" className="text-yellow-500" />
              <Text variant="strong" size="lg">Warning counters (since app start)</Text>
            </Flex>
            <Button variant="ghost" size="sm" onClick={() => setWarningState(getDmWarningState())}>
              <Icon name="refresh" size="sm" />
            </Button>
          </Flex>
          {warningState?.installedAt && (
            <Text variant="subtle" size="xs" className="mb-3">
              Installed at {warningState.installedAt}
            </Text>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(Object.keys(WARNING_LABELS) as DmWarningKey[]).map((key) => (
              <DevStat
                key={key}
                className="bg-surface-2 rounded p-3"
                label={WARNING_LABELS[key]}
                value={warningState?.counts[key] ?? 0}
                tone={
                  warningState && warningState.counts[key] > 0 ? 'bad' : 'neutral'
                }
                hint={
                  warningState && warningState.lastHits[key].length > 0
                    ? `last: ${warningState.lastHits[key][0]}`
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* Ghost conversations (flagged summary) */}
        <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6">
          <Flex gap="sm" align="center" className="mb-3">
            <Icon name="ghost" size="md" className="text-accent" />
            <Text variant="strong" size="lg">Ghost / duplicate conversation rows (flagged summary)</Text>
          </Flex>
          {ghosts === null ? (
            <Text variant="subtle" size="sm">Run a scan to check for ghost conversations.</Text>
          ) : ghosts.length === 0 ? (
            <Text variant="subtle" size="sm">None found.</Text>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-default">
                    <th className="py-1 pr-4">Address</th>
                    <th className="py-1 pr-4">Display name</th>
                    <th className="py-1 pr-4">Last message id</th>
                    <th className="py-1">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {ghosts.map((row) => (
                    <tr key={row.conversationId} className="border-b border-default/50">
                      <td className="py-1 pr-4 font-mono">{truncateAddress(row.address)}</td>
                      <td className="py-1 pr-4">{row.displayName || '(none)'}</td>
                      <td className="py-1 pr-4 font-mono">
                        {row.lastMessageId ? truncateAddress(row.lastMessageId) : '(none)'}
                      </td>
                      <td className="py-1">
                        <span className="bg-red-500/20 text-red-500 text-xs px-2 py-0.5 rounded font-medium">
                          {row.reasons.join(', ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Direct conversations inventory (authoritative — unconditional) */}
        <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6 mb-8">
          <Flex gap="sm" align="center" className="mb-1">
            <Icon name="clipboard-list" size="md" className="text-accent" />
            <Text variant="strong" size="lg">Direct conversations inventory (every row, unconditionally)</Text>
          </Flex>
          <Text variant="subtle" size="xs" className="mb-3">
            The ghost card above only ever prints its own positives — a suspicious row it doesn't
            flag looks identical to a row it never saw. This lists every `type: 'direct'` row so you
            can judge for yourself, plus any messages-store keys with no matching conversation row.
          </Text>
          {inventory === null ? (
            <Text variant="subtle" size="sm">Run a scan to build the inventory.</Text>
          ) : (
            <>
              <Text variant="subtle" size="xs" className="mb-2">
                total direct rows: {inventory.totalDirectRows}
              </Text>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-default">
                      <th className="py-1 pr-4">Conversation id</th>
                      <th className="py-1 pr-4">Address</th>
                      <th className="py-1 pr-4">Display name</th>
                      <th className="py-1 pr-4">Messages</th>
                      <th className="py-1">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-subtle">
                          No direct conversation rows and no orphan keys.
                        </td>
                      </tr>
                    )}
                    {inventory.rows.map((row) => (
                      <tr key={`${row.conversationId}-${row.address}`} className="border-b border-default/50">
                        <td className="py-1 pr-4 font-mono">{truncateAddress(row.conversationId)}</td>
                        <td className="py-1 pr-4 font-mono">{truncateAddress(row.address)}</td>
                        <td className="py-1 pr-4">{row.displayName}</td>
                        <td className="py-1 pr-4">{row.messageCount}</td>
                        <td className="py-1">
                          {row.flags.length === 0 ? (
                            <span className="text-subtle text-xs">none</span>
                          ) : (
                            row.flags.map((flag) => (
                              <span
                                key={flag}
                                className="bg-red-500/20 text-red-500 text-xs px-2 py-0.5 rounded font-medium mr-1"
                              >
                                {flag}
                              </span>
                            ))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
