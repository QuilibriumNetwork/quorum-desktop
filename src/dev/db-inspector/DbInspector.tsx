import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Text,
  Flex,
  Button,
  Icon,
} from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
import {
  getStoreCounts,
  dumpStore,
  dumpDatabase,
  formatDumpForCopy,
  ALL_STORES,
  SENSITIVE_STORES,
  type StoreName,
  type StoreDump,
} from './dbDumpUtil';

const SENSITIVE_SET = new Set<string>(SENSITIVE_STORES);

export const DbInspector: React.FC = () => {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreName | null>(null);
  const [storeData, setStoreData] = useState<StoreDump | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Load store counts on mount
  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStoreCounts();
      setCounts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load database');
    } finally {
      setLoading(false);
    }
  };

  const loadStore = useCallback(async (storeName: StoreName) => {
    setSelectedStore(storeName);
    setStoreLoading(true);
    setStoreData(null);
    try {
      const data = await dumpStore(storeName, 50);
      setStoreData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${storeName}`);
    } finally {
      setStoreLoading(false);
    }
  }, []);

  const copyFullDump = async (includeMessages = false) => {
    setCopyStatus('Generating...');
    try {
      const dump = await dumpDatabase({ includeMessages });
      const json = formatDumpForCopy(dump);
      await navigator.clipboard.writeText(json);
      setCopyStatus('Copied to clipboard!');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      setCopyStatus('Failed to copy');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const copyStoreData = async () => {
    if (!storeData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(storeData, null, 2));
      setCopyStatus('Store copied!');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus('Failed to copy');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const totalRecords = counts
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <Container className="min-h-screen bg-app">
      <DevNavMenu currentPath="/dev/db-inspector" sticky />

      <Container padding="lg" className="mx-auto max-w-6xl">
        {/* Header */}
        <Flex justify="between" align="center" className="mb-6">
          <Flex gap="sm" align="center">
            <Icon name="database" size="xl" className="text-accent" />
            <div>
              <Text as="h1" variant="strong" size="2xl" weight="bold">
                DB Inspector
              </Text>
              <Text variant="subtle" size="sm">
                IndexedDB browser with redacted sensitive data
              </Text>
            </div>
          </Flex>

          <Flex gap="sm">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadCounts}
              disabled={loading}
            >
              <Icon name="refresh" size="sm" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyFullDump(false)}
              disabled={loading}
            >
              <Icon name="copy" size="sm" />
              Copy All (no msgs)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => copyFullDump(true)}
              disabled={loading}
            >
              <Icon name="copy" size="sm" />
              Copy All
            </Button>
          </Flex>
        </Flex>

        {/* Copy status toast */}
        {copyStatus && (
          <div className="fixed top-4 right-4 bg-surface-2 border border-accent px-4 py-2 rounded-lg shadow-lg z-50">
            <Text variant="main" size="sm">{copyStatus}</Text>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <Text variant="strong" className="text-red-500">{error}</Text>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <Icon name="spinner" size="xl" className="animate-spin text-accent" />
            <Text variant="subtle" className="mt-2">Loading database...</Text>
          </div>
        )}

        {/* Main content */}
        {!loading && counts && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Store list */}
            <div className="lg:col-span-1">
              <div className="bg-surface-1 rounded-lg border border-default p-4">
                <Flex justify="between" align="center" className="mb-4">
                  <Text variant="strong" size="lg">Stores</Text>
                  <Text variant="subtle" size="sm">{totalRecords} total records</Text>
                </Flex>

                <div className="space-y-2">
                  {ALL_STORES.map((storeName) => {
                    const count = counts[storeName] || 0;
                    const isSensitive = SENSITIVE_SET.has(storeName);
                    const isSelected = selectedStore === storeName;

                    return (
                      <button
                        key={storeName}
                        onClick={() => loadStore(storeName)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          isSelected
                            ? 'bg-accent/20 border border-accent/50'
                            : 'hover:bg-surface-2 border border-transparent'
                        }`}
                      >
                        <Flex justify="between" align="center">
                          <Flex gap="sm" align="center">
                            {isSensitive && (
                              <Icon
                                name="lock"
                                size="xs"
                                className="text-yellow-500"
                                title="Contains redacted data"
                              />
                            )}
                            <Text
                              variant={isSelected ? 'strong' : 'main'}
                              size="sm"
                              className="font-mono"
                            >
                              {storeName}
                            </Text>
                          </Flex>
                          <Text
                            variant="subtle"
                            size="xs"
                            className="bg-surface-2 px-2 py-0.5 rounded"
                          >
                            {count}
                          </Text>
                        </Flex>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-default">
                  <Flex gap="xs" align="center">
                    <Icon name="lock" size="xs" className="text-yellow-500" />
                    <Text variant="subtle" size="xs">
                      Sensitive data redacted
                    </Text>
                  </Flex>
                </div>
              </div>
            </div>

            {/* Store detail */}
            <div className="lg:col-span-2">
              {!selectedStore && (
                <div className="bg-surface-1 rounded-lg border border-default p-8 text-center">
                  <Icon name="database" size="2xl" className="text-subtle mb-4" />
                  <Text variant="subtle">Select a store to view records</Text>
                </div>
              )}

              {selectedStore && storeLoading && (
                <div className="bg-surface-1 rounded-lg border border-default p-8 text-center">
                  <Icon name="spinner" size="xl" className="animate-spin text-accent" />
                  <Text variant="subtle" className="mt-2">Loading {selectedStore}...</Text>
                </div>
              )}

              {selectedStore && storeData && !storeLoading && (
                <div className="bg-surface-1 rounded-lg border border-default">
                  {/* Store header */}
                  <div className="p-4 border-b border-default">
                    <Flex justify="between" align="center">
                      <Flex gap="sm" align="center">
                        <Text variant="strong" size="lg" className="font-mono">
                          {storeData.name}
                        </Text>
                        {SENSITIVE_SET.has(storeData.name) && (
                          <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-0.5 rounded">
                            Redacted
                          </span>
                        )}
                      </Flex>
                      <Flex gap="sm" align="center">
                        <Text variant="subtle" size="sm">
                          {storeData.count} records
                          {storeData.truncated && ` (showing first ${storeData.records?.length})`}
                        </Text>
                        <Button variant="ghost" size="sm" onClick={copyStoreData}>
                          <Icon name="copy" size="sm" />
                        </Button>
                      </Flex>
                    </Flex>
                  </div>

                  {/* Records */}
                  <div className="p-4 max-h-[600px] overflow-auto">
                    {storeData.records && storeData.records.length > 0 ? (
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all text-main">
                        {JSON.stringify(storeData.records, null, 2)}
                      </pre>
                    ) : (
                      <Text variant="subtle" className="text-center py-8">
                        No records in this store
                      </Text>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Console usage hint */}
        <div className="mt-8 bg-surface-1 rounded-lg border border-default p-4">
          <Text variant="strong" size="sm" className="mb-2">
            Console Commands
          </Text>
          <div className="font-mono text-xs space-y-1 text-subtle">
            <div><span className="text-accent">__dbDump()</span> - Dump all stores (no messages)</div>
            <div><span className="text-accent">__dbDump(true)</span> - Dump all stores including messages</div>
            <div><span className="text-accent">__dbCounts()</span> - Show record counts table</div>
            <div><span className="text-accent">__dbStore('action_queue')</span> - Dump specific store</div>
          </div>
        </div>
      </Container>
    </Container>
  );
};
