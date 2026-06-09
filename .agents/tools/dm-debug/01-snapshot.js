// === Quorum DM Snapshot ===
// Captures conversations, space_members, message counts, and user_config
// for the current client. Auto-copies JSON to clipboard (3 fallback methods).
//
// Usage: paste in DevTools console, run on BOTH clients, diff the outputs.
// Background: ../../docs/debugging/dm-architecture-and-debug-playbook.md

(async () => {
  const REPORT = { runAt: new Date().toISOString(), kind: 'snapshot', version: 1 };

  const db = await new Promise((res, rej) => {
    const req = indexedDB.open('quorum_db');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  const all = (storeName) => new Promise((res) => {
    try {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => res([]);
    } catch { res([]); }
  });

  REPORT.stores = Array.from(db.objectStoreNames);

  // Self identity: try a few likely stores.
  const userInfo = await all('user_info');
  const userConfig = await all('user_config');
  REPORT.self = {
    address: userInfo[0]?.address ?? userConfig[0]?.address ?? null,
    displayName: userInfo[0]?.displayName ?? null,
    hasGlobalBio: !!userConfig[0]?.bio,
    globalBio: userConfig[0]?.bio ?? null,
    hasProfileImage: !!userConfig[0]?.profile_image,
    allowSync: userConfig[0]?.allowSync ?? null,
  };

  const conversations = await all('conversations');
  const dms = conversations.filter(c => c.type === 'direct');
  REPORT.dmCount = dms.length;
  REPORT.dms = dms.map(c => ({
    partner: c.address,
    displayName: c.displayName,
    icon_state: c.icon == null ? 'null'
      : c.icon === '' ? 'empty-string'
      : typeof c.icon === 'string' && c.icon.includes('unknown-user') ? 'placeholder'
      : 'has-image',
    bio: c.bio ?? '(absent)',
    lastTimestamp: c.timestamp,
  }));

  const encStates = await all('encryption_states');
  REPORT.dmsWithSession = dms.map(c => {
    const convId = c.conversationId;
    const states = encStates.filter(e => e.conversationId === convId);
    return { partner: c.address, hasEncryptionState: states.length > 0, stateCount: states.length };
  });

  const spaceMembers = await all('space_members');
  REPORT.spaceMembersTotals = {
    totalRows: spaceMembers.length,
    withBio: spaceMembers.filter(m => m.bio).length,
    withIcon: spaceMembers.filter(m => m.user_icon && !String(m.user_icon).includes('unknown-user')).length,
  };

  const messages = await all('messages');
  REPORT.messageCount = messages.length;

  const json = JSON.stringify(REPORT, null, 2);

  // Auto-copy: 3 fallback methods
  let copied = false;
  try { await navigator.clipboard.writeText(json); copied = true; } catch {}
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {}
  }

  if (copied) {
    console.log('%c✅ Snapshot copied. Paste in the bug report.', 'color: #4ade80; font-weight: bold; font-size: 14px;');
  } else {
    console.log('%c⚠️ Auto-copy blocked. Copy the JSON below:', 'color: #fbbf24; font-weight: bold');
    console.log(json);
  }

  console.log('Full report:', REPORT);
  return REPORT;
})();
