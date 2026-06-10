// === Quorum DM Profile-Source Diagnostic ===
// For every DM, prints side-by-side:
//   - stored conversation row: displayName + raw icon value (+ is-it-the-default flag)
//   - live public-profile API: display_name + profile_image presence
//
// Purpose: pin down WHY the sidebar shows a default avatar while the open
// conversation shows a real one. The open conversation falls back to the
// public profile (in-memory only); the sidebar reads the stored row. This
// snippet shows which source actually has the image for each contact.
//
// Usage: paste in DevTools console, run. No clipboard side effects.
// The real default-avatar path is '/unknown.png' (DefaultImages.UNKNOWN_USER).

(async () => {
  const DEFAULT_ICON = '/unknown.png';
  const UNKNOWN_NAME = 'Unknown User';

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

  const conversations = await all('conversations');
  const dms = conversations.filter((c) => c.type === 'direct');

  // The app talks to a fixed API host (see src/config/config.quorum.ts), NOT
  // same-origin — that's why an empty base returns ERR. Default to production;
  // override via window.__QUORUM_API_BASE__ if you point the app elsewhere.
  // Note: the endpoint may require the app's auth headers, so a raw fetch can
  // still 401/ERR even with the right host. The authoritative signal is the
  // stored row's icon (data:image/... = avatar persisted); this API column is
  // only a cross-check.
  const apiBase =
    window.__QUORUM_API_BASE__ || 'https://api.quorummessenger.com';

  const rows = [];
  for (const c of dms) {
    const storedIcon = c.icon;
    const iconIsDefault =
      !storedIcon || storedIcon === '' || storedIcon === DEFAULT_ICON;
    const nameIsPlaceholder = !c.displayName || c.displayName === UNKNOWN_NAME;

    let pubName = '(fetch failed)';
    let pubHasImage = '(fetch failed)';
    let pubStatus = '';
    try {
      const url = `${apiBase}/users/${c.address}/public-profile`;
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
    } catch (e) {
      pubStatus = 'ERR';
    }

    rows.push({
      partner: String(c.address).slice(0, 18) + '…',
      storedName: c.displayName,
      nameIsPlaceholder,
      storedIconIsDefault: iconIsDefault,
      storedIconSample:
        typeof storedIcon === 'string' ? storedIcon.slice(0, 40) : storedIcon,
      pubStatus,
      pubName,
      pubHasImage,
      // The verdict the fix cares about:
      sidebarCanRecoverAvatar:
        iconIsDefault && pubHasImage === 'YES' ? 'YES (fix should fill)' : iconIsDefault ? 'NO source' : 'already has',
    });
  }

  console.log('%c=== DM Profile Sources ===', 'color:#60a5fa;font-weight:bold;font-size:14px');
  console.table(rows);
  console.log('Full rows:', rows);
  return rows;
})();
