// === Quorum SELF-Identity Source Diagnostic ===
//
// When YOUR OWN name renders differently on two surfaces of the same app, this
// says which store each surface reads and what each one holds. Reading only the
// roster row cannot separate the causes; this reads all four in one pass.
//
// | store | who reads it | syncs? |
// |---|---|---|
// | A. localStorage['passkeys-list'][0] | NavRail tooltip, DM self entry, join-time roster stamp | never — only this device's own save writes it |
// | B. user_config.name (channel A) | the User Settings field | yes |
// | C. space_members[self].display_name (override) | message authors, member lists — outranks everything | reaches other members |
// | C'. space_members[self].global_display_name | the slot a rename broadcast writes | reaches other members |
// | D. /users/:addr/public-profile (channel B) | last fallback, only carrier of the QNS .q name | server-side |
//
// Paste into the DevTools console and read the VERDICT lines. Read-only.
// Prints display names and address tails only, never key material.
// See 2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md

window.__selfIdentitySources = async () => {
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

  // ---- A. the device-local passkey record -------------------------------
  let passkey = null;
  try {
    const raw = window.localStorage.getItem('passkeys-list');
    const list = raw ? JSON.parse(raw) : [];
    passkey = list[0] ?? null;
  } catch {
    /* leave null */
  }
  const selfAddress = passkey?.address;
  if (!selfAddress) {
    console.error(
      'No passkey found in localStorage["passkeys-list"] — is this the logged-in app tab?'
    );
    return null;
  }

  // ---- B. the encrypted config blob, as stored locally -------------------
  const configs = await all('user_config');
  const config = configs.find((c) => c.address === selfAddress) ?? null;

  // ---- C / C'. our own roster row, per space -----------------------------
  const members = await all('space_members');
  const spaces = await all('spaces');
  // The stored field is `spaceName` (quorum-shared Space type), NOT `name`.
  // This read `.name` until 2026-08-05, so every space rendered as "(unknown)"
  // in every table below — which made the encryption-state breakdown useless
  // for its whole purpose, namely deciding WHICH space is carrying the bloat.
  // `.name` is kept as a fallback in case an older row shape survives.
  const nameForSpace = (id) => {
    const s = spaces.find((sp) => sp.spaceId === id);
    return s?.spaceName || s?.name || '(unknown)';
  };
  const selfRows = members.filter((m) => m.user_address === selfAddress);

  // ---- D. the published public profile -----------------------------------
  let pub = null;
  let pubStatus = '';
  try {
    // No `credentials: 'include'` — it makes the browser demand an explicit
    // Access-Control-Allow-Origin plus Allow-Credentials, which this endpoint
    // does not send, so the request fails CORS from a dev origin. The app's own
    // client does not send credentials either.
    const resp = await fetch(`${apiBase}/users/${selfAddress}/public-profile`);
    pubStatus = resp.status;
    if (resp.ok) {
      const body = await resp.json();
      pub = body?.data ?? body;
    }
  } catch {
    pubStatus = 'ERR';
  }

  // ---- the render ladder, replicated exactly -----------------------------
  // ⚠️ STALE REFERENCE (2026-08-11): this replicated the ladder as it stood
  // before PR #327. Both files named below were deleted — the ladder is now
  // shared `resolveIdentity` (quorum-shared/src/utils/resolveDisplayName.ts),
  // fed by `src/identity/identityProvider.tsx`. The replication below has NOT
  // been re-derived against those, so treat a disagreement with the app as
  // "this script is out of date" first, and check the current ladder before
  // concluding the app is wrong.
  //   was: useMembersWithPublicProfileFallback.ts:139-158 then
  //        resolveSpaceMemberName (utils/resolveMemberName.ts:66) then shared
  //        resolveDisplayName.
  // Kept literal rather than tidy so a future drift shows up as a
  // disagreement with the app, not as a silent pass.
  const present = (s) => {
    const t = (s ?? '').trim();
    return t.length ? t : null;
  };
  const truncate = (a) => (a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
  // The QNS name normally travels only in the public profile, but the config
  // blob carries it too — so the ladder stays accurate even when the fetch fails.
  const qnsName = present(pub?.primary_username) || present(config?.primaryUsername);
  const resolveSurface = (row) => {
    const rosterGlobalName = present(row?.global_display_name);
    const effectiveGlobal = rosterGlobalName || present(pub?.display_name);
    // hook line 147: the OVERRIDE slot wins the merge outright when non-empty
    const merged =
      present(row?.display_name) || rosterGlobalName || present(pub?.display_name);
    const qns = qnsName;
    if (qns && merged && merged !== effectiveGlobal) return merged;
    if (qns) return `${qns}.q`;
    const demoted = merged === UNKNOWN_NAME ? null : merged;
    if (demoted) return demoted;
    return truncate(selfAddress);
  };

  // ---- config blob size budget -------------------------------------------
  // Whether a per-space avatar can live in the config blob is a SIZE question,
  // and the size is knowable rather than arguable. The blob has an observed
  // working ceiling around 1 MB (see .agents/docs/config-sync-system.md →
  // "Size Limits"); an avatar is a base64 data URI of roughly 40-80 KB. This
  // prints the real headroom on THIS account instead of a guess.
  const sizeOf = (v) => (v === undefined ? 0 : JSON.stringify(v).length);
  const blobBytes = sizeOf(config);
  const budget = config
    ? [
        { part: 'WHOLE BLOB', bytes: blobBytes, note: '~1 MB observed ceiling' },
        { part: 'spaceKeys (encryption states)', bytes: sizeOf(config.spaceKeys), note: 'the known bloat source' },
        { part: 'profile_image (your global avatar)', bytes: sizeOf(config.profile_image), note: 'one avatar, for scale' },
        { part: 'bookmarks', bytes: sizeOf(config.bookmarks) },
        { part: 'notificationSettings', bytes: sizeOf(config.notificationSettings) },
        { part: 'conversationSettings', bytes: sizeOf(config.conversationSettings), note: 'the per-entry-LWW precedent' },
        { part: 'everything else', bytes: blobBytes - sizeOf(config.spaceKeys) - sizeOf(config.profile_image) - sizeOf(config.bookmarks) - sizeOf(config.notificationSettings) - sizeOf(config.conversationSettings) },
      ]
    : [];

  // ---- report -------------------------------------------------------------
  // Defined up here rather than beside the verdicts: the size section below
  // also renders pass/fail lines, and a `const` used above its declaration is a
  // TDZ crash, not a hoist.
  const say = (ok, text) =>
    console.log(
      `%c${ok ? '✔' : '✖'} ${text}`,
      `color:${ok ? '#4ade80' : '#f87171'};font-weight:bold`
    );

  const settingsField = config?.name ?? '(config has no name)';
  const navRailName = passkey?.displayName || 'User';

  console.log(
    '%c=== SELF identity sources ===',
    'color:#60a5fa;font-weight:bold;font-size:14px'
  );
  console.table([
    {
      source: 'A. localStorage passkeys-list',
      channel: 'device-local, never synced',
      value: navRailName,
      readBy: 'NavRail tooltip, DM self row, join-time roster stamp',
    },
    {
      source: 'B. IndexedDB user_config.name',
      channel: 'A — encrypted config blob',
      value: settingsField,
      readBy: 'User Settings display-name field',
    },
    {
      source: 'D. public profile display_name',
      channel: 'B — published profile',
      value: pub ? pub.display_name || '(empty)' : `(none, HTTP ${pubStatus})`,
      readBy: 'final fallback for everyone else',
    },
    {
      source: 'QNS primary_username',
      channel: pub?.primary_username ? 'B — public profile' : 'config blob fallback',
      value: qnsName ? `${qnsName}.q` : '(none)',
      readBy: 'the .q rung of the ladder',
    },
  ]);
  if (!pub) {
    console.log(
      `%cPublic profile not readable from this origin (HTTP ${pubStatus}) — ` +
        'the two D rows fall back to the config blob. Everything else is local ' +
        'and unaffected.',
      'color:#fbbf24'
    );
  }

  const perSpace = selfRows.map((row) => ({
    _raw: row,
    space: nameForSpace(row.spaceId),
    spaceId: String(row.spaceId).slice(0, 12) + '…',
    'C override display_name': row.display_name ?? '(empty)',
    "C' global_display_name": row.global_display_name ?? '(empty)',
    profileTimestamp: row.profileTimestamp ?? '(none)',
    globalProfileTimestamp: row.globalProfileTimestamp ?? '(none)',
    overrideOutranksGlobal:
      !!present(row.display_name) &&
      present(row.display_name) !== present(row.global_display_name),
    rendersAs: resolveSurface(row),
  }));

  console.log(
    '%c=== your own roster row, per space (channel C) ===',
    'color:#60a5fa;font-weight:bold;font-size:14px'
  );
  if (perSpace.length) {
    // `_raw` is carried for the verdicts below, not for the eye — drop it here.
    console.table(perSpace.map(({ _raw, ...visible }) => visible));
  } else {
    console.log('(no space_members row for your own address in any space)');
  }

  if (budget.length) {
    console.log(
      '%c=== config blob size budget ===',
      'color:#60a5fa;font-weight:bold;font-size:14px'
    );
    console.table(
      budget.map((b) => ({ ...b, kb: (b.bytes / 1024).toFixed(1) }))
    );
    // Bookmarks measured at 75% of one real blob, 94% of it a base64 sender
    // avatar copied into every bookmark. Break them down by field so the fix is
    // chosen on evidence — see
    // 2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md under .agents/issues/.done/.
    const marks = config.bookmarks ?? [];
    if (marks.length) {
      const sum = (f) =>
        marks.reduce((n, b) => n + sizeOf(b?.cachedPreview?.[f]), 0);
      console.table(
        ['senderIcon', 'imageUrl', 'thumbnailUrl', 'textSnippet'].map((f) => ({
          'cachedPreview field': f,
          kb: (sum(f) / 1024).toFixed(1),
        })).concat([{ 'cachedPreview field': `(${marks.length} bookmarks)`, kb: (sizeOf(marks) / 1024).toFixed(1) }])
      );
    }

    // ---- which bookmark store are we even looking at? -------------------
    //
    // 🔴 `config.bookmarks` above is NOT the live bookmark store. It is the copy
    // embedded in the stored config blob, and it is refreshed only when
    // `saveConfig` next runs. The live rows are their own object store.
    //
    // That matters for verifying the strip, and reading the wrong one gives a
    // FALSE NEGATIVE: the sweep rewrites the `bookmarks` store on launch, but
    // the number printed above keeps showing the old size until the next config
    // save. Read both, and say which state this account is actually in.
    const liveMarks = await all('bookmarks');
    const iconBytes = (list) =>
      list.reduce((n, b) => n + sizeOf(b?.cachedPreview?.senderIcon), 0);
    const liveIconKb = iconBytes(liveMarks) / 1024;
    const configIconKb = iconBytes(marks) / 1024;
    const sweepRan = !!localStorage.getItem(
      `bookmarkSenderIconsStripped:v1:${selfAddress}`
    );

    console.table([
      {
        store: "IndexedDB 'bookmarks' (LIVE rows)",
        count: liveMarks.length,
        'senderIcon kb': liveIconKb.toFixed(1),
        'refreshed by': 'the one-time sweep, on launch',
      },
      {
        store: "user_config.bookmarks (blob COPY)",
        count: marks.length,
        'senderIcon kb': configIconKb.toFixed(1),
        'refreshed by': 'the next saveConfig',
      },
    ]);

    if (!sweepRan && liveIconKb > 1) {
      say(
        false,
        `Embedded avatars still present (${liveIconKb.toFixed(1)} KB live) and the sweep has ` +
          'NOT run on this device. This build does not contain the bookmark-avatar fix — ' +
          'this is a BASELINE reading, not a verification.'
      );
    } else if (sweepRan && configIconKb > 1) {
      say(
        true,
        `Sweep has run (live store clean at ${liveIconKb.toFixed(1)} KB). The blob copy still ` +
          `reads ${configIconKb.toFixed(1)} KB because no config save has happened since — ` +
          'uploads are ALREADY thin (saveConfig strips on the way out); this local copy ' +
          'catches up on the next save. Change any setting and re-run to see it drop.'
      );
    } else if (sweepRan) {
      say(
        true,
        'Converged — both the live store and the blob copy are free of embedded avatars.'
      );
    } else {
      say(true, 'No embedded bookmark avatars on this account (nothing to strip).');
    }

    const oneAvatar = sizeOf(config.profile_image);
    if (oneAvatar > 0) {
      console.log(
        `One avatar costs ${(oneAvatar / 1024).toFixed(1)} KB. ` +
          `${selfRows.length} space(s) of per-space avatars would add ~${(
            (oneAvatar * selfRows.length) / 1024
          ).toFixed(0)} KB to a ${(blobBytes / 1024).toFixed(0)} KB blob.`
      );
    }

    // ---- is this blob actually being published? --------------------------
    //
    // Nothing checks the blob's size before uploading, so an overrun is
    // whatever the server returns. Worse, THREE different states all leave the
    // config saved locally and looking healthy, and only one of them means the
    // upload happened:
    //
    //   1. allowSync off            → never uploads, by design
    //   2. refuse-to-publish guard  → held, because this device cannot prove a
    //                                 key for every Space it lists
    //   3. uploaded fine
    //
    // `saveConfig` writes the local row in all three, so "my settings saved" is
    // not evidence of sync. Print the state instead of leaving it inferred.
    const blobKb = blobBytes / 1024;
    const keyedSpaceIds = new Set((config.spaceKeys ?? []).map((sk) => sk.spaceId));
    const wouldDrop = (config.spaceIds ?? []).filter((id) => !keyedSpaceIds.has(id));

    console.log(
      '%c=== is this blob being published? ===',
      'color:#60a5fa;font-weight:bold;font-size:14px'
    );
    say(
      config.allowSync !== false,
      config.allowSync === false
        ? 'allowSync is OFF — this device never uploads its config. Every setting below is ' +
            'local-only, and no other device will ever see any of it.'
        : 'allowSync is on.'
    );
    say(
      wouldDrop.length === 0,
      wouldDrop.length
        ? `${wouldDrop.length} Space(s) in spaceIds have no matching spaceKey, so saveConfig ` +
            'REFUSES to publish (it will not upload a truncated Space list). The save is ' +
            'local-only until those Spaces finish syncing, and NOTHING retries a held save.'
        : 'Space list and keys agree — no refuse-to-publish hold.'
    );

    // ~1 MB is the observed working ceiling; ~21 MB is where failures were seen.
    // Between them is untested, not safe.
    say(
      blobKb < 1024,
      blobKb < 1024
        ? `Blob is ${blobKb.toFixed(0)} KB, inside the ~1 MB observed working range.`
        : `Blob is ${blobKb.toFixed(0)} KB — OVER the ~1 MB observed working ceiling. ` +
            'Uploads in this range are untested rather than known-broken, but nothing ' +
            'checks the size before publishing, so a failure surfaces only as a server ' +
            'error. See .agents/docs/config-sync-system.md → Size Limits.'
    );

    // The dominant contributor, historically and again here. A CREATED space
    // pre-allocates ~10k polynomial evals (~2 MB); a JOINED one costs ~12 KB.
    // Deleting a space has also been observed to LEAK its state rather than
    // remove it, so orphans accumulate. Break it down per space so the reading
    // says which spaces are responsible instead of one large total.
    const keyBreakdown = (config.spaceKeys ?? [])
      .map((sk) => ({
        space: nameForSpace(sk.spaceId),
        spaceId: String(sk.spaceId).slice(0, 12) + '…',
        kb: +(sizeOf(sk) / 1024).toFixed(1),
        likely: sizeOf(sk) > 500 * 1024 ? 'CREATED here (~10k evals)' : 'joined',
      }))
      .sort((a, b) => b.kb - a.kb);
    if (keyBreakdown.length) {
      console.table(keyBreakdown);
      const fat = keyBreakdown.filter((k) => k.kb > 500);
      if (fat.length) {
        console.log(
          `%c⚠ ${fat.length} encryption state(s) over 500 KB, ${fat
            .reduce((n, k) => n + k.kb, 0)
            .toFixed(0)} KB total. This is the known evals bloat — ` +
            '.agents/issues/.open/2025-12-09-encryption-state-evals-bloat.md (open, high). ' +
            'Not a bookmark problem: check that count against the number of Spaces you ' +
            'actually CREATED, since deleted Spaces have been seen to leak their state.',
          'color:#f87171;font-weight:bold'
        );
      }
    }
  }

  // ---- verdicts ----------------------------------------------------------
  console.log(
    '%c=== VERDICT ===',
    'color:#fbbf24;font-weight:bold;font-size:14px'
  );

  const navRailStale = navRailName !== settingsField;
  say(
    !navRailStale,
    navRailStale
      ? `NavRail shows "${navRailName}" while Settings shows "${settingsField}" — ` +
          'source A is a device-local snapshot that no cross-device rename can ever reach.'
      : 'NavRail and Settings agree (source A happens to match the config blob).'
  );

  const stuckOverrides = perSpace.filter((r) => r.overrideOutranksGlobal);
  say(
    stuckOverrides.length === 0,
    stuckOverrides.length
      ? `${stuckOverrides.length}/${perSpace.length} space(s) hold a per-space OVERRIDE that has ` +
          'diverged from the global slot. It was an echo when written and is not one now, so ' +
          'echo-demotion cannot see it and it outranks every global update permanently. ' +
          'This is §3 of the issue, CONFIRMED.'
      : 'No space holds a diverged override — §3 of the issue is REFUTED, look downstream at rendering.'
  );

  // Post-fix instruments. The tripwire should stay empty: after the Phase 1
  // work only the Space Settings editor may write our own override slot.
  const tripwire = (() => {
    try {
      return JSON.parse(localStorage.getItem('quorum:diag:selfOverrideWrites')) ?? [];
    } catch {
      return [];
    }
  })();
  say(
    tripwire.length === 0,
    tripwire.length === 0
      ? 'Tripwire clean — nothing has written our own per-space override.'
      : `Tripwire caught ${tripwire.length} write(s) to our OWN override slot. Only the ` +
          'Space Settings editor may do this. Inspect quorum:diag:selfOverrideWrites — ' +
          'each entry carries the stack that wrote it.'
  );

  const cleared = (() => {
    try {
      return JSON.parse(localStorage.getItem('quorum:diag:clearedSpaceOverrides')) ?? [];
    } catch {
      return [];
    }
  })();
  if (cleared.length) {
    console.log(
      `%cℹ The one-time migration cleared ${cleared.length} legacy override(s). ` +
        'Previous values are in quorum:diag:clearedSpaceOverrides — it is irreversible, ' +
        'so that record is the only copy.',
      'color:#60a5fa'
    );
  }

  // A global slot behind the config blob is only a fault for a space some device
  // has actually broadcast into since the rename — a space no device has announced
  // to will legitimately lag. Reported, not judged.
  const behind = perSpace.filter(
    (r) => present(r._raw.global_display_name) !== present(config?.name)
  );
  if (behind.length) {
    console.log(
      `%cℹ ${behind.length}/${perSpace.length} space(s) have a global slot behind the ` +
        'config blob. Expected for any space no device has announced into since the ' +
        'rename; a fault only if every device HAS announced there.',
      'color:#fbbf24'
    );
  }

  const out = {
    selfAddress,
    passkeyDisplayName: navRailName,
    configName: settingsField,
    publicProfileName: pub?.display_name ?? null,
    primaryUsername: pub?.primary_username ?? null,
    perSpace: perSpace.map(({ _raw, ...visible }) => visible),
  };
  console.log('Full result:', out);
  return out;
};

__selfIdentitySources();
