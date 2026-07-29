import React, { useCallback, useEffect, useState } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Text, Flex, Button, Icon, Input } from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
import {
  scanSequence,
  findGhostConversations,
  formatMeasurementRow,
  type ScanResult,
  type GhostConversationRow,
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

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

export const DmDoctor: React.FC = () => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address ?? null;

  const [prefix, setPrefix] = useState('');
  const [expectedInput, setExpectedInput] = useState('20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanExpected, setScanExpected] = useState(20);
  const [scanPrefix, setScanPrefix] = useState('');
  const [ghosts, setGhosts] = useState<GhostConversationRow[] | null>(null);
  const [warningState, setWarningState] = useState<DmWarningCounterState | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

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
      setScanResult(scanSequence(messages, prefix, expected, ownAddress));
      setGhosts(findGhostConversations(conversations, ownAddress));
      setScanExpected(expected);
      setScanPrefix(prefix);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [expectedInput, prefix, ownAddress]);

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
          </Flex>
          <Text variant="subtle" size="xs" className="mt-2">
            Scans the WHOLE messages store for "{'{prefix} N'}" (case-insensitive),
            same matching as .agents/tools/dm-debug/07-receiver-probe.js.
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
                Results — prefix "{scanPrefix}"
              </Text>
              <Text
                variant="strong"
                size="xl"
                className={scanResult.missing.length ? 'text-red-500' : 'text-green-500'}
              >
                {scanResult.landed}/{scanExpected} landed
              </Text>
            </Flex>

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
                        No rows matched this prefix.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
              <div key={key} className="bg-surface-2 rounded p-3">
                <Text variant="subtle" size="xs">{WARNING_LABELS[key]}</Text>
                <Text
                  variant="strong"
                  size="2xl"
                  className={warningState && warningState.counts[key] > 0 ? 'text-red-500' : ''}
                >
                  {warningState?.counts[key] ?? 0}
                </Text>
                {warningState && warningState.lastHits[key].length > 0 && (
                  <Text variant="subtle" size="xs" className="mt-1 block">
                    last: {warningState.lastHits[key][0]}
                  </Text>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ghost conversations */}
        <div className="bg-surface-1 rounded-lg border border-default p-4 mt-6 mb-8">
          <Flex gap="sm" align="center" className="mb-3">
            <Icon name="ghost" size="md" className="text-accent" />
            <Text variant="strong" size="lg">Ghost / duplicate conversation rows</Text>
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
      </div>
    </div>
  );
};
