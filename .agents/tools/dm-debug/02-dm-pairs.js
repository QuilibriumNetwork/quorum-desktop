// === Quorum DM Partners ===
// Lists this client's DM partners. Use to confirm A↔B symmetry: run on both
// clients, verify A's address appears in B's list and vice versa.
//
// Background: ../../docs/debugging/dm-architecture-and-debug-playbook.md

indexedDB.open('quorum_db').onsuccess = (e) => {
  const db = e.target.result;
  db.transaction('conversations').objectStore('conversations').getAll().onsuccess = (r) => {
    const dms = r.target.result
      .filter(c => c.type === 'direct')
      .map(c => ({
        partner: c.address,
        partnerShort: c.address?.slice(0, 12),
        name: c.displayName,
        hasIcon: !!c.icon && !String(c.icon).includes('unknown-user'),
        hasBio: !!c.bio,
      }));
    console.log(`%cDM partners (${dms.length}):`, 'font-weight: bold; color: #60a5fa');
    console.table(dms);
  };
};
