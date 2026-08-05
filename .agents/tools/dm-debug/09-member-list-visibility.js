// === Why is someone MISSING from the space member list? ===
//
// The member list hides anyone whose row has an empty `inbox_address`
// (useChannelData.ts: `left: curr.inbox_address === ''`) or `isKicked`. So a
// member can exist on disk, have a perfectly good name, and still not render.
//
// `hiddenFromList` is the answer column:
//   hasInbox false  -> their join control never reached this client. Long-standing
//                      sync gap, not a naming problem.
//   hasInbox true but still missing from the UI -> something else; report it.
//
// Paste into the DevTools console. Read-only.

(async () => {
  const db = await new Promise((res, rej) => {
    const q = indexedDB.open('quorum_db');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  const all = (s) =>
    new Promise((res) => {
      try {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll();
        q.onsuccess = () => res(q.result);
        q.onerror = () => res([]);
      } catch {
        res([]);
      }
    });

  const members = await all('space_members');
  const spaces = await all('spaces');

  const rows = members.map((m) => ({
    space: spaces.find((s) => s.spaceId === m.spaceId)?.name ?? String(m.spaceId).slice(0, 10),
    who: String(m.user_address).slice(-6),
    hasInbox: !!m.inbox_address,
    isKicked: !!m.isKicked,
    hiddenFromList: !m.inbox_address || !!m.isKicked,
    override: m.display_name ?? '(none)',
    global: m.global_display_name ?? '(none)',
    joinedAt: m.joinedAt ?? '(none)',
  }));

  const hidden = rows.filter((r) => r.hiddenFromList);

  console.log(
    '%c=== member rows, and which the list hides ===',
    'color:#60a5fa;font-weight:bold;font-size:14px'
  );
  console.table(rows);

  if (hidden.length) {
    console.log(
      `%c${hidden.length} row(s) are hidden from the member list:`,
      'color:#fbbf24;font-weight:bold'
    );
    console.table(hidden);
    console.log(
      'hasInbox=false → their join never arrived here (the known sync gap).\n' +
        'hasInbox=true and still hidden → isKicked, or a real bug worth reporting.'
    );
  } else {
    console.log(
      '%c✔ No row is hidden. Anyone missing from the UI has NO ROW AT ALL — ' +
        'compare against who you can see posting.',
      'color:#4ade80;font-weight:bold'
    );
  }

  return rows;
})();
