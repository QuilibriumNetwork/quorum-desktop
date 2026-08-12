import React, { useState, useEffect, useCallback } from 'react';
import {
  Flex,
  Button,
  Icon,
} from '../../components/primitives';
import { DevPage, DevPageHeader } from '../shell';
import {
  getDbInfo,
  dumpStore,
  dumpDatabase,
  formatDumpForCopy,
  classifyStore,
  type DbInfo,
  type StoreName,
  type StoreDump,
} from './dbDumpUtil';

export const DbInspector: React.FC = () => {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreName | null>(null);
  const [storeData, setStoreData] = useState<StoreDump | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Load the live schema (version + stores + counts) on mount
  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDbInfo();
      setInfo(result);
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

  const totalRecords = info
    ? Object.values(info.counts).reduce((a, b) => a + b, 0)
    : 0;

  const versionMismatch = info != null && info.dbVersion !== info.appDbVersion;

  return (
    <DevPage>
        <DevPageHeader
          icon="database"
          title="DB Inspector"
          subtitle={
            info
              ? `${info.dbName} v${info.dbVersion} · IndexedDB browser with redacted sensitive data`
              : 'IndexedDB browser with redacted sensitive data'
          }
          actions={
            <>
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
            </>
          }
        />

        {/* Copy status toast */}
        {copyStatus && (
          <div className="fixed top-4 right-4 bg-surface-2 border border-accent px-4 py-2 rounded-lg shadow-lg z-50">
            <span className="text-sm text-main">{copyStatus}</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <span className="text-strong text-red-500">{error}</span>
          </div>
        )}

        {/* Schema drift: the DB on this origin isn't the one this build writes.
            Usually means branch-switching against the same localhost origin —
            see the dev gotcha in .agents/docs/quorum-db-schema.md. */}
        {!loading && versionMismatch && info && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <span className="text-strong text-yellow-500">
              Schema drift: database is at v{info.dbVersion}, this build expects v
              {info.appDbVersion}
            </span>
            <span className="text-sm text-subtle mt-1">
              {info.missingStores.length > 0
                ? `Missing stores: ${info.missingStores.join(', ')}. `
                : ''}
              Reset the DB (Settings → Danger Zone → Reset App Data) or reload the app to
              let it upgrade.
            </span>
          </div>
        )}

        {/* Stores present in the DB that have no redaction rule yet */}
        {!loading && info && info.unclassifiedStores.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <span className="text-strong text-yellow-500">
              Unclassified stores: {info.unclassifiedStores.join(', ')}
            </span>
            <span className="text-sm text-subtle mt-1">
              Every field is redacted until they are added to SAFE_STORES or
              SENSITIVE_STORES in dbDumpUtil.ts.
            </span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <Icon name="spinner" size="xl" className="animate-spin text-accent" />
            <span className="text-subtle mt-2">Loading database...</span>
          </div>
        )}

        {/* Main content */}
        {!loading && info && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Store list */}
            <div className="lg:col-span-1">
              <div className="bg-surface-1 rounded-lg border border-default p-4">
                <Flex justify="between" align="center" className="mb-4">
                  <span className="text-lg text-strong">Stores</span>
                  <span className="text-sm text-subtle">{totalRecords} total records</span>
                </Flex>

                <div className="space-y-2">
                  {info.stores.map((storeName) => {
                    const count = info.counts[storeName] || 0;
                    const classification = classifyStore(storeName);
                    const isSensitive = classification !== 'safe';
                    const isSelected = selectedStore === storeName;

                    return (
                      <button
                        key={storeName}
                        onClick={() => loadStore(storeName)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          isSelected
                            ? 'bg-accent-rgb/20 border border-accent-rgb/50'
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
                                title={
                                  classification === 'unclassified'
                                    ? 'Unclassified store — all fields redacted'
                                    : 'Contains redacted data'
                                }
                              />
                            )}
                            <span
                              className={`text-sm font-mono ${
                                isSelected ? 'text-strong' : 'text-main'
                              }`}
                            >
                              {storeName}
                            </span>
                          </Flex>
                          <span className="text-xs text-subtle bg-surface-2 px-2 py-0.5 rounded">
                            {count}
                          </span>
                        </Flex>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-default">
                  <Flex gap="xs" align="center">
                    <Icon name="lock" size="xs" className="text-yellow-500" />
                    <span className="text-xs text-subtle">
                      Sensitive data redacted
                    </span>
                  </Flex>
                </div>
              </div>
            </div>

            {/* Store detail */}
            <div className="lg:col-span-2">
              {!selectedStore && (
                <div className="bg-surface-1 rounded-lg border border-default p-8 text-center">
                  <Icon name="database" size="2xl" className="text-subtle mb-4" />
                  <span className="text-subtle">Select a store to view records</span>
                </div>
              )}

              {selectedStore && storeLoading && (
                <div className="bg-surface-1 rounded-lg border border-default p-8 text-center">
                  <Icon name="spinner" size="xl" className="animate-spin text-accent" />
                  <span className="text-subtle mt-2">Loading {selectedStore}...</span>
                </div>
              )}

              {selectedStore && storeData && !storeLoading && (
                <div className="bg-surface-1 rounded-lg border border-default">
                  {/* Store header */}
                  <div className="p-4 border-b border-default">
                    <Flex justify="between" align="center">
                      <Flex gap="sm" align="center">
                        <span className="text-lg text-strong font-mono">
                          {storeData.name}
                        </span>
                        {storeData.classification !== 'safe' && (
                          <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-0.5 rounded">
                            {storeData.classification === 'unclassified'
                              ? 'Unclassified'
                              : 'Redacted'}
                          </span>
                        )}
                      </Flex>
                      <Flex gap="sm" align="center">
                        <span className="text-sm text-subtle">
                          {storeData.count} records
                          {storeData.truncated && ` (showing first ${storeData.records?.length})`}
                        </span>
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
                      <span className="text-subtle text-center py-8">
                        No records in this store
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Console usage hint */}
        <div className="mt-8 bg-surface-1 rounded-lg border border-default p-4">
          <span className="text-sm text-strong mb-2">
            Console Commands
          </span>
          <div className="font-mono text-xs space-y-1 text-subtle">
            <div><span className="text-accent">__dbDump()</span> - Dump all stores (no messages)</div>
            <div><span className="text-accent">__dbDump(true)</span> - Dump all stores including messages</div>
            <div><span className="text-accent">__dbCounts()</span> - Show record counts table</div>
            <div><span className="text-accent">__dbStore('action_queue')</span> - Dump specific store</div>
            <div><span className="text-accent">__dbInfo()</span> - Live DB version, store list, drift</div>
          </div>
        </div>
    </DevPage>
  );
};
