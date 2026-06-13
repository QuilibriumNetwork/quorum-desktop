// === Quorum Space-Member Profile-Source Diagnostic ===
// The spaces analog of 05-profile-sources.js. For a given space, prints every
// member row in `space_members` side-by-side with:
//   - what's stored locally  : display_name, user_icon (+ is-it-empty flag),
//                              inbox_address presence, joinedAt
//   - the live public-profile : display_name + profile_image presence (404 = none)
//
// Purpose: classify WHY a sender renders as a 6-char truncated address in a
// space channel. Three buckets (see the dm-architecture playbook):
//   A. NO ROW          -> their `join` broadcast never reached this client. The
//                         deeper sync gap. Not recoverable from message traffic
//                         (the receive path only READS space_members).
//   B. ROW, EMPTY NAME -> row exists but display_name/user_icon never populated.
//                         An update-profile or sync-members could fill it.
//   C. ROW + PUBPROF   -> public profile has data the render fallback should use
//                         (this is what PR #191 covers, render-only).
//   D. NO PUBPROF (404)-> user never published a public profile AND no row data;
//                         only a working join/update-profile/sync can fix it.
//
// Usage:
//   1. Open the affected space/channel in the app first (so the data is loaded).
//   2. Paste this whole file into the DevTools console and run.
//   3. If you have more than one space, it lists them first — re-run with the
//      target spaceId:  __spaceMemberSources('<spaceId>')
//   4. Optionally pass a list of the truncated addresses you SEE in the UI to
//      get a focused table:  __spaceMemberSources('<spaceId>', ['CRcRk8', ...])
//      (match is by suffix, so the 6-char tail from the UI works directly.)
//
// No clipboard side effects; logs a table + the full array (also returned).

window.__spaceMemberSources = async (spaceId, focusSuffixes) => {
  const DEFAULT_ICON = '/unknown.png';
  const UNKNOWN_NAME = 'Unknown User';
  const apiBase =
    window.__QUORUM_API_BASE__ || 'https://api.quorummessenger.com';

  const db = await new Promise((res, rej) => {
    const req = indexedDB.open('quorum_db');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  const all = (storeName) =>
    new Promise((res) => {
      try {
        const req = db
          .transaction(storeName, 'readonly')
          .objectStore(storeName)
          .getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res([]);
      } catch {
        res([]);
      }
    });

  const members = await all('space_members');

  // No spaceId given: list the spaces present so the caller can pick one.
  if (!spaceId) {
    const bySpace = {};
    for (const m of members) {
      (bySpace[m.spaceId] = bySpace[m.spaceId] || []).push(m);
    }
    const spaceList = await all('spaces').catch(() => []);
    const nameFor = (id) =>
      spaceList.find((s) => s.spaceId === id)?.name ?? '(unknown)';
    console.log(
      '%c=== Spaces present in space_members ===',
      'color:#60a5fa;font-weight:bold;font-size:14px'
    );
    console.table(
      Object.entries(bySpace).map(([id, ms]) => ({
        spaceId: id,
        name: nameFor(id),
        memberRows: ms.length,
        rowsWithName: ms.filter(
          (m) => m.display_name && m.display_name !== UNKNOWN_NAME
        ).length,
        rowsWithIcon: ms.filter(
          (m) => m.user_icon && m.user_icon !== DEFAULT_ICON
        ).length,
      }))
    );
    console.log(
      '%cRe-run focused on one space:%c __spaceMemberSources("<spaceId>")',
      'color:#fbbf24',
      'color:#a3e635'
    );
    return Object.keys(bySpace);
  }

  let scoped = members.filter((m) => m.spaceId === spaceId);

  // Optional focus on specific truncated addresses seen in the UI.
  if (Array.isArray(focusSuffixes) && focusSuffixes.length) {
    const tails = focusSuffixes.map((s) => String(s).toLowerCase());
    scoped = scoped.filter((m) =>
      tails.some((t) => String(m.user_address).toLowerCase().endsWith(t))
    );
  }

  const rows = [];
  for (const m of scoped) {
    const storedIcon = m.user_icon;
    const iconIsEmpty =
      !storedIcon || storedIcon === '' || storedIcon === DEFAULT_ICON;
    const nameIsPlaceholder =
      !m.display_name || m.display_name === UNKNOWN_NAME;

    let pubName = '(fetch failed)';
    let pubHasImage = '(fetch failed)';
    let pubStatus = '';
    try {
      const url = `${apiBase}/users/${m.user_address}/public-profile`;
      const resp = await fetch(url, { credentials: 'include' });
      pubStatus = resp.status;
      if (resp.ok) {
        const body = await resp.json();
        const data = body?.data ?? body;
        pubName = data?.display_name || '(empty)';
        pubHasImage = data?.profile_image ? 'YES' : 'no';
      } else if (resp.status === 404) {
        pubName = '(no public profile)';
        pubHasImage = 'n/a';
      }
    } catch {
      pubStatus = 'ERR';
    }

    // Verdict: which bucket is this member in?
    let bucket;
    if (!nameIsPlaceholder && !iconIsEmpty) {
      bucket = 'OK (row has name+icon)';
    } else if (pubHasImage === 'YES' || pubName === '(empty)' || pubStatus === 200) {
      bucket = 'C: pub-profile can fill (render-only fix)';
    } else if (pubStatus === 404) {
      bucket = 'D: no row data + no public profile (needs join/sync)';
    } else {
      bucket = 'B: empty row, pub-profile unverified';
    }

    rows.push({
      address: String(m.user_address).slice(-6),
      storedName: m.display_name ?? '(none)',
      nameIsPlaceholder,
      iconIsEmpty,
      iconSample:
        typeof storedIcon === 'string' ? storedIcon.slice(0, 32) : storedIcon,
      hasInbox: !!m.inbox_address,
      isKicked: !!m.isKicked,
      joinedAt: m.joinedAt ?? '(none)',
      pubStatus,
      pubName,
      pubHasImage,
      bucket,
    });
  }

  console.log(
    `%c=== Space-Member Sources (space ${String(spaceId).slice(0, 12)}…, ${rows.length} rows) ===`,
    'color:#60a5fa;font-weight:bold;font-size:14px'
  );
  console.table(rows);
  console.log('Full rows:', rows);
  console.log(
    '%cReminder:%c "NO ROW" members (sender visible in chat but absent here) = ' +
      'their join never reached you. List visible-but-missing addresses by ' +
      'comparing the chat senders against this table.',
    'color:#fbbf24',
    'color:inherit'
  );
  return rows;
};

// === Companion: find senders with NO member row (bucket A) ===
// The table above can only show rows that EXIST. A member whose `join` never
// reached this client has no row at all, so they're invisible to it. This
// helper reads the `messages` store for the space, collects every distinct
// sender, and flags the ones absent from `space_members`. Those are the
// "joined + posted but still a truncated address, unrecoverable from traffic"
// users — the strongest evidence for the join/sync transport gap.
//
// Usage:  __spaceMissingSenders('<spaceId>')
window.__spaceMissingSenders = async (spaceId) => {
  if (!spaceId) {
    console.log(
      '%cPass a spaceId:%c __spaceMissingSenders("<spaceId>")  (run __spaceMemberSources() first to list them)',
      'color:#fbbf24',
      'color:#a3e635'
    );
    return;
  }
  const db = await new Promise((res, rej) => {
    const req = indexedDB.open('quorum_db');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  const all = (s) =>
    new Promise((res) => {
      try {
        const req = db.transaction(s, 'readonly').objectStore(s).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res([]);
      } catch {
        res([]);
      }
    });

  const messages = await all('messages');
  const members = await all('space_members');
  const memberAddrs = new Set(
    members.filter((m) => m.spaceId === spaceId).map((m) => m.user_address)
  );

  // Distinct senders in this space's messages.
  const senders = {};
  for (const msg of messages) {
    if (msg.spaceId !== spaceId) continue;
    const id = msg.content?.senderId;
    if (!id) continue;
    senders[id] = (senders[id] || 0) + 1;
  }

  const rows = Object.entries(senders).map(([addr, count]) => ({
    sender: String(addr).slice(-6),
    fullAddress: addr,
    messageCount: count,
    hasMemberRow: memberAddrs.has(addr),
    verdict: memberAddrs.has(addr)
      ? 'has row (check 06 table for fields)'
      : 'NO ROW — join never arrived (bucket A)',
  }));
  rows.sort((a, b) => Number(a.hasMemberRow) - Number(b.hasMemberRow));

  const missing = rows.filter((r) => !r.hasMemberRow);
  console.log(
    `%c=== Senders in space ${String(spaceId).slice(0, 12)}… (${rows.length} distinct, ${missing.length} with NO member row) ===`,
    'color:#60a5fa;font-weight:bold;font-size:14px'
  );
  console.table(rows);
  if (missing.length) {
    console.log(
      '%c⚠ These senders posted but have NO space_members row — their join broadcast never reached this client. ' +
        'Normal message traffic will never recover their name/avatar (the receive path only reads space_members). ' +
        'Cross-check each against its public profile via __spaceMemberSources (they won\'t appear there since there\'s no row).',
      'color:#f87171;font-weight:bold'
    );
  } else {
    console.log(
      '%c✅ Every sender has a member row. The truncated-address users are bucket B/C/D — check the 06 table.',
      'color:#4ade80;font-weight:bold'
    );
  }
  return rows;
};

// Auto-run: with no spaceId it prints the space picker.
__spaceMemberSources();
