// === Quorum Encryption States (DM sessions) ===
// Lists encryption states grouped by conversationId. A DM with no
// encryption_states row = no session established. Cross-reference with
// 02-dm-pairs.js: a conversation row without an encryption state means
// the UI shows the DM but the protocol can't send to it.
//
// Background: ../../docs/debugging/dm-architecture-and-debug-playbook.md

indexedDB.open('quorum_db').onsuccess = (e) => {
  const db = e.target.result;
  db.transaction('encryption_states').objectStore('encryption_states').getAll().onsuccess = (r) => {
    const grouped = {};
    for (const s of r.target.result) {
      const k = s.conversationId ?? '(no conversationId)';
      grouped[k] = (grouped[k] || 0) + 1;
    }
    const table = Object.entries(grouped).map(([conv, count]) => ({
      conversationId: conv.slice(0, 40),
      stateCount: count,
    }));
    console.log(`%cEncryption states: ${r.target.result.length} rows across ${table.length} conversations`,
      'font-weight: bold; color: #60a5fa');
    console.table(table);
  };
};
