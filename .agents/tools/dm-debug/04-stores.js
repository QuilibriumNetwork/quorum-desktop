// === Quorum IndexedDB store names ===
// Use this when a snippet fails with "object store not found". Store names
// drift between builds (e.g. passkey_info → user_info). Substitute the
// right name in your snippet.

indexedDB.open('quorum_db').onsuccess = (e) => {
  console.log('%cIndexedDB stores in quorum_db:', 'font-weight: bold; color: #60a5fa');
  console.log(Array.from(e.target.result.objectStoreNames));
};
