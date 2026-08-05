// === Quorum SELF-Identity Source Diagnostic ===
//
// Answers one question: when YOUR OWN name renders differently on two surfaces
// of the same app, which of the four stores does each surface read, and what
// does each one currently hold?
//
// Built for 2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-
// settings-field.md (.agents/issues/). §4 of that file says "read the row"
// first; this reads the row AND the three other candidates in one pass, so a
// single run separates the hypotheses instead of confirming only one.
//
// The four sources, and who reads each:
//
//   A. localStorage['passkeys-list'][0].displayName
//        -> NavRail avatar + hover tooltip (NavRail.tsx:94), the DM self entry
//           (DirectMessage.tsx:301), and the value stamped into your own roster
//           row at join (InvitationService.ts:771).
//        -> written ONLY by updateStoredPasskey(), i.e. onboarding and THIS
//           device's own Settings save. A config-blob pull never touches it.
//   B. IndexedDB user_config.name   (channel A, the encrypted settings blob)
//        -> the User Settings display-name field (useUserSettings.ts:140).
//        -> this is the one that DOES follow a rename made on another device.
//   C. IndexedDB space_members[you].display_name   (channel C OVERRIDE slot)
//        -> message authors and space member lists, and it outranks D forever.
//   C'. space_members[you].global_display_name     (channel C GLOBAL slot)
//        -> the tier mobile's rename broadcast actually writes.
//   D. GET /users/:addr/public-profile             (channel B)
//        -> the last fallback, plus the only carrier of the QNS .q name.
//
// Usage: paste the whole file into the DevTools console and run. Read the
// VERDICT lines at the bottom. No writes, no clipboard side effects.
//
// Privacy: prints display names and address tails only. It never reads the
// passkey key material (that lives under a different localStorage key).

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
  const nameForSpace = (id) =>
    spaces.find((s) => s.spaceId === id)?.name ?? '(unknown)';
  const selfRows = members.filter((m) => m.user_address === selfAddress);

  // ---- D. the published public profile -----------------------------------
  let pub = null;
  let pubStatus = '';
  try {
    const resp = await fetch(
      `${apiBase}/users/${selfAddress}/public-profile`,
      { credentials: 'include' }
    );
    pubStatus = resp.status;
    if (resp.ok) {
      const body = await resp.json();
      pub = body?.data ?? body;
    }
  } catch {
    pubStatus = 'ERR';
  }

  // ---- the render ladder, replicated exactly -----------------------------
  // useMembersWithPublicProfileFallback.ts:139-158 then
  // resolveSpaceMemberName (utils/resolveMemberName.ts:66) then shared
  // resolveDisplayName. Kept literal rather than tidy so a future drift in
  // either file shows up as a disagreement with the app, not as a silent pass.
  const present = (s) => {
    const t = (s ?? '').trim();
    return t.length ? t : null;
  };
  const truncate = (a) => (a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
  const resolveSurface = (row) => {
    const rosterGlobalName = present(row?.global_display_name);
    const effectiveGlobal = rosterGlobalName || present(pub?.display_name);
    // hook line 147: the OVERRIDE slot wins the merge outright when non-empty
    const merged =
      present(row?.display_name) || rosterGlobalName || present(pub?.display_name);
    const qns = present(pub?.primary_username);
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
      source: 'D. public profile primary_username',
      channel: 'B — the only carrier of QNS',
      value: pub?.primary_username ? `${pub.primary_username}.q` : '(none)',
      readBy: 'the .q rung of the ladder',
    },
  ]);

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
    // Bookmarks measured at 75% of one real blob. Break them down by field so
    // the fix is chosen on evidence — see
    // 2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md under .agents/issues/.
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

    const oneAvatar = sizeOf(config.profile_image);
    if (oneAvatar > 0) {
      console.log(
        `One avatar costs ${(oneAvatar / 1024).toFixed(1)} KB. ` +
          `${selfRows.length} space(s) of per-space avatars would add ~${(
            (oneAvatar * selfRows.length) / 1024
          ).toFixed(0)} KB to a ${(blobBytes / 1024).toFixed(0)} KB blob.`
      );
    }
  }

  // ---- verdicts ----------------------------------------------------------
  const say = (ok, text) =>
    console.log(
      `%c${ok ? '✔' : '✖'} ${text}`,
      `color:${ok ? '#4ade80' : '#f87171'};font-weight:bold`
    );

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

  // The repair discriminator (§4-B): a join stamp writes display_name and NO
  // profileTimestamp; every deliberate override goes through applyProfileUpdate,
  // which always stamps one. If that holds here, a one-shot repair is safe.
  const stamped = stuckOverrides.filter((r) => r._raw.profileTimestamp == null);
  say(
    stuckOverrides.length === 0 || stamped.length === stuckOverrides.length,
    stuckOverrides.length === 0
      ? 'No diverged override, so the repair discriminator is moot here.'
      : `${stamped.length}/${stuckOverrides.length} diverged override(s) carry NO profileTimestamp — ` +
          (stamped.length === stuckOverrides.length
            ? 'the join-stamp signature, so the §4-B one-shot repair is safe.'
            : 'some carry one, which a join stamp never writes. The §4-B discriminator is WRONG ' +
              'as stated and the repair must NOT ship until that is explained.')
  );

  const globalsLanding = perSpace.filter(
    (r) => present(r._raw.global_display_name) === present(config?.name)
  ).length;
  say(
    perSpace.length > 0 && globalsLanding === perSpace.length,
    `${globalsLanding}/${perSpace.length} space(s) have a global slot matching the config blob — ` +
      (perSpace.length > 0 && globalsLanding === perSpace.length
        ? 'the sender-side broadcast IS landing, so the fault is purely in precedence/rendering.'
        : 'some global slots are behind the config blob, so the broadcast is NOT landing everywhere ' +
          'and the receive path needs checking too.')
  );

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
