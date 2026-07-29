// 07-receiver-probe.js — DM-loss receiver probe
// (the reusable snippet described in tasks/2026-07-29-dm-loss-next-session-handoff.md §4)
//
// PASTE INTO THE RECEIVING DESKTOP'S DevTools CONSOLE **BEFORE** THE SENDER STARTS,
// so the warning counters cover the whole test window. It does two things:
//   1. wraps console.log/warn/error/info to count the tell-tale receive-path
//      warnings (session replaced, unknown inbox, decrypt failures) from install
//   2. reads IndexedDB (`quorum_db` → `messages`) directly, bypassing the UI
//
// Usage, after sending "V 1" … "V 20" from the phone:
//     await window.__probe.report('V')        // expected count defaults to 20
//     await window.__probe.report('V', 30)    // if you sent 30
//
// TIMING RULE: take one reading right after the sends and ANOTHER ~10 minutes
// later — a count taken while messages are still landing says nothing, and the
// second reading is what distinguishes loss from a long latency tail.
//
// Caveats:
// - The DB read is the measurement. The warning counters are best-effort: if the
//   app's logger captured its console references before the probe installed,
//   they stay at 0 even when warnings fired — check the console text too.
// - Works on dev AND production builds (warn-level lines survive prod — the
//   366-drop capture of 2026-07-29 came from a production build's console).
// - If Chrome DevTools refuses the paste, type "allow pasting" first.

(() => {
  if (window.__probe) {
    console.log(
      '[probe] already installed at', window.__probe.installedAt,
      '— counters preserved. window.__probe.reset() to zero them.'
    );
    return;
  }

  const counters = { sessionReplaced: 0, unknownInbox: 0, decryptFailish: 0 };
  const MATCHES = [
    ['sessionReplaced', (s) => s.includes('SESSION REPLACED by init envelope')],
    ['unknownInbox', (s) => s.includes('DM frame for unknown inbox')],
    ['decryptFailish', (s) => /decrypt/i.test(s) && /fail|error|unable/i.test(s)],
  ];
  for (const name of ['log', 'warn', 'error', 'info']) {
    const orig = console[name].bind(console);
    console[name] = (...args) => {
      try {
        const s = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
        for (const [k, test] of MATCHES) if (test(s)) counters[k]++;
      } catch {}
      orig(...args);
    };
  }

  const readMessages = () =>
    new Promise((resolve, reject) => {
      const open = indexedDB.open('quorum_db'); // no version → opens current, never upgrades
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const rq = db.transaction('messages', 'readonly').objectStore('messages').getAll();
        rq.onsuccess = () => { db.close(); resolve(rq.result); };
        rq.onerror = () => { db.close(); reject(rq.error); };
      };
    });

  window.__probe = {
    installedAt: new Date().toISOString(),
    counters,
    reset() {
      for (const k of Object.keys(counters)) counters[k] = 0;
      return 'counters zeroed';
    },
    async report(prefix, expected = 20) {
      const msgs = await readMessages();
      const re = new RegExp('^\\s*' + prefix + '\\s*(\\d+)\\s*$', 'i');
      const hits = [];
      for (const m of msgs) {
        const raw = m?.content?.text;
        for (const t of Array.isArray(raw) ? raw : [raw]) {
          if (typeof t !== 'string') continue;
          const mt = re.exec(t);
          if (mt) hits.push(Number(mt[1]));
        }
      }
      const nums = [...new Set(hits)].sort((a, b) => a - b);
      const missing = [];
      for (let i = 1; i <= expected; i++) if (!nums.includes(i)) missing.push(i);
      const out = {
        prefix,
        expected,
        landed: nums.length,
        missing,
        duplicates: hits.length - nums.length,
        warningsSinceInstall: { ...counters },
        probeInstalledAt: this.installedAt,
        readAt: new Date().toISOString(),
        scanned: msgs.length,
      };
      console.log(
        `[probe] ${prefix}: ${nums.length}/${expected} landed` +
          (missing.length ? `, MISSING: ${missing.join(', ')}` : ', none missing') +
          ` | warnings since install: replaced=${counters.sessionReplaced}` +
          ` unknownInbox=${counters.unknownInbox} decrypt=${counters.decryptFailish}`
      );
      return out;
    },
  };

  console.log(
    '[probe] armed at', window.__probe.installedAt,
    "— send the test messages now, then: await window.__probe.report('V')"
  );
})();
