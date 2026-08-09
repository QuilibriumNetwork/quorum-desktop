// === Quorum Backup Payload Size — where does a .qmbak's weight come from? ===
//
// READ-ONLY. Opens the DB, measures nothing else, writes nothing.
//
// Answers one question: of the encryption states this account is carrying, how
// many belong to a Space or conversation that still EXISTS, and how many are
// orphans left behind by Spaces that were deleted?
//
// Why it matters: `getAllEncryptionStates()` is an unfiltered getAll, so the
// backup export used to include orphans too. A created Space pre-allocates a
// ~2 MB polynomial eval pool, and deleting the Space has been observed to leak
// that state rather than remove it (2025-12-09-encryption-state-evals-bloat.md).
// Orphans are dead weight in a backup BY CONSTRUCTION: the restore rebuilds
// Spaces by iterating the Spaces in the file, so a state whose Space is absent
// can never be matched to anything.
//
// The `.qmbak` on disk is ~2x the payload, because the ciphertext is hex-encoded
// (2 characters per byte), so the file column below is the number that matters.
//
// Paste into the dev console with the app open and logged in.

indexedDB.open('quorum_db').onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction(['spaces', 'conversations', 'encryption_states']);
  const out = {};
  let pending = 3;

  const done = () => {
    if (--pending) return;

    const liveSpaces = new Set(out.spaces.map((s) => s.spaceId));
    const liveConvos = new Set(out.conversations.map((c) => c.conversationId));

    const kb = (n) => Math.round(n / 1024);
    const rows = [];
    let liveBytes = 0;
    let orphanBytes = 0;
    let orphanCount = 0;

    for (const s of out.encryption_states) {
      const bytes = JSON.stringify(s).length;
      const [left, right] = String(s.conversationId ?? '').split('/');
      const isPairShaped = left && left === right;

      let kind;
      if (!isPairShaped) kind = 'other (kept)';
      else if (liveSpaces.has(left)) kind = 'live Space';
      else if (liveConvos.has(s.conversationId)) kind = 'live DM';
      else kind = '❌ ORPHAN';

      if (kind === '❌ ORPHAN') {
        orphanBytes += bytes;
        orphanCount++;
      } else {
        liveBytes += bytes;
      }

      rows.push({
        conversationId: String(s.conversationId ?? '').slice(0, 22) + '…',
        kind,
        KB: kb(bytes),
      });
    }

    rows.sort((a, b) => b.KB - a.KB);
    console.table(rows);

    const total = liveBytes + orphanBytes;
    console.table([
      {
        part: 'states worth keeping',
        payloadMB: (liveBytes / 1048576).toFixed(2),
        approxFileMB: ((liveBytes * 2) / 1048576).toFixed(2),
      },
      {
        part: `ORPHANS (${orphanCount}) — unusable by any restore`,
        payloadMB: (orphanBytes / 1048576).toFixed(2),
        approxFileMB: ((orphanBytes * 2) / 1048576).toFixed(2),
      },
      {
        part: 'total encryption states',
        payloadMB: (total / 1048576).toFixed(2),
        approxFileMB: ((total * 2) / 1048576).toFixed(2),
      },
    ]);

    console.log(
      `[backup-size] ${out.spaces.length} Space(s), ` +
        `${out.conversations.length} conversation(s), ` +
        `${out.encryption_states.length} encryption state(s)`
    );
    if (orphanCount > 0) {
      console.log(
        `[backup-size] filtering orphans should shrink the .qmbak by about ` +
          `${((orphanBytes * 2) / 1048576).toFixed(1)} MB`
      );
    }
  };

  for (const store of ['spaces', 'conversations', 'encryption_states']) {
    tx.objectStore(store).getAll().onsuccess = (r) => {
      out[store] = r.target.result;
      done();
    };
  }
};
