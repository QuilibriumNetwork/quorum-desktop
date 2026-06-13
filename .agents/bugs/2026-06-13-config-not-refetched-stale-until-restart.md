---
type: bug
title: "Desktop shows stale synced config (e.g. public-profile toggle) until restart — config only server-fetched at startup"
status: open
created: 2026-06-13
severity: medium
repo: quorum-desktop
root-cause: "Desktop's useConfig query reads IndexedDB only (buildConfigFetcher -> messageDB.getUserConfig; never the network). The only path that pulls the latest config from the server into IndexedDB is ConfigService.getConfig, which runs essentially once at app startup (RegistrationPersister). There is no periodic / foreground / websocket-driven config refetch. So a config change made on another device (e.g. mobile) reaches the server but desktop keeps serving its stale cached value until a restart."
is-real-root-cause-of: "quorum-mobile .agents/bugs/2026-06-10-isprofilepublic-not-syncing-mobile-to-desktop.md"
---

# Desktop shows stale synced config until restart

> Repo: **quorum-desktop** (filed from the mobile .agents while investigating the mobile-side
> profile-sync work, since the sibling bug was originally filed here). This is the **real**
> root cause of `2026-06-10-isprofilepublic-not-syncing-mobile-to-desktop.md`, which had
> previously been mis-diagnosed as a missing mobile read-back bridge.

## Symptom

A synced config value changed on one device (e.g. the public-profile toggle, bio, device
names, mute/favorite settings) does not appear on desktop until desktop is restarted
(or, as the user observed, a full hard reset / re-import). On a long-lived app where users
essentially never re-login, this means cross-device config changes effectively never
reflect on desktop in practice.

Concretely reported: mobile toggles `isProfilePublic` ON → server profile is published →
desktop User Settings still shows OFF.

## Root cause (verified in desktop source 2026-06-13)

1. **The config query reads local storage only, never the network.**
   `src/hooks/queries/config/useConfig.ts` runs `buildConfigFetcher`, whose `queryFn` is just
   `messageDB.getUserConfig({ address })` — an IndexedDB read. The file even comments
   `networkMode: 'always' // This query uses IndexedDB, not network`. So `useConfig` can only
   ever return whatever is already in IndexedDB.

2. **Only `ConfigService.getConfig` pulls fresh config from the server**, and it does so
   correctly (server `getUserSettings` + timestamp LWW vs the stored copy, writing the newer
   one to IndexedDB). But its runtime caller is startup/registration
   (`src/components/context/RegistrationPersister.tsx` → `MessageDB.getConfig`). There is **no**
   periodic refetch, no `refetchInterval`, no window-focus refetch, and no websocket-driven
   `invalidateQueries(buildConfigKey(...))` when a config-sync arrives.

3. **The settings screen also short-circuits on the cached query value.**
   `src/hooks/business/user/useUserSettings.ts:140-143`:
   ```ts
   if (cachedConfig) { applyConfig(cachedConfig); return; }
   ```
   So even reopening Settings reuses the cached (stale) config rather than forcing a fresh
   server pull.

Net effect: after desktop has started, nothing refreshes config from the server, so a
cross-device change is invisible until a restart re-runs the startup fetch.

## Why mobile is NOT the cause

- Mobile sends `isProfilePublic` to the synced config correctly (`updateProfile` →
  `configUpdates.isProfilePublic` → `saveConfig`).
- Desktop reads `isProfilePublic` from config correctly (`useUserSettings` line 133).
- The only gap is desktop's refetch cadence. quorum-mobile PR #81 (the read-back bridge)
  addresses the reverse direction and does not touch this.

## Hub-log migration impact (2026-06-13)

This bug is the same root-cause class as
[2026-06-13-space-members-missing-no-join-row.md](2026-06-13-space-members-missing-no-join-row.md):
**desktop fetches state once at startup and never reconciles after** (rosters there,
synced config here). The lead dev is bringing mobile's durable **hub log** to desktop —
a per-hub log replayed via `log-since` on every reconnect/foreground. That migration IS
the delivery vehicle for Option 1 below: a config-sync / settings-update signal replayed
over the hub log is exactly the websocket-driven trigger this bug needs. Once it lands,
the fix collapses to "on that replayed signal, `ConfigService.getConfig` →
`useInvalidateConfig()`" — no bespoke refetch transport required. Options 2 and 3 below
become throwaway band-aids on a transport the hub log replaces; do not build them ahead
of the migration. Sequence this bug's fix WITH the hub-log work, not before it.

## Suggested fix direction (desktop)

Add a trigger that refreshes config from the server after startup, then invalidates the
config query so the UI re-reads it. Options (lead-dev call):

1. **Websocket-driven (best — and the hub-log migration provides this):** when a
   config-sync / settings-update signal arrives over the hub websocket (i.e. is replayed
   by the incoming hub log), call `ConfigService.getConfig` (server fetch → IndexedDB)
   then `useInvalidateConfig()` so `useConfig` re-reads. Real-time, no polling.
2. **On window focus / app foreground:** re-run the server fetch + invalidate when the desktop
   window regains focus. Cheap, covers the "I changed it on my phone then came back to my
   desktop" case. (Superseded by Option 1 once the hub log lands.)
3. **Periodic:** a modest `refetchInterval` or a timer that re-runs the server fetch. Simplest,
   but polling. (Superseded by Option 1 once the hub log lands.)

Also reconsider the `useUserSettings` `cachedConfig` short-circuit (line 140-143) so opening
Settings can force a fresh pull, or so it re-reads after an invalidation.

## Verification (once fixed)

- [ ] With both clients open, toggle public profile on mobile → desktop reflects it without a
      restart (within the chosen refresh window).
- [ ] Toggle OFF on mobile → desktop reflects OFF (change propagates, not just blank-fill).
- [ ] Same for bio and other synced config fields (device names, mute/favorite).

## Related

- Real root cause of: quorum-mobile `.agents/bugs/2026-06-10-isprofilepublic-not-syncing-mobile-to-desktop.md`
- Mobile reverse-direction bridge: quorum-mobile PR #81 (`fix/profile-settings-sync-mobile-to-desktop`)
- Sibling work: quorum-mobile `.agents/tasks/2026-06-10-primary-username-sync-and-publish.md`
- Desktop files: `src/hooks/queries/config/{useConfig,buildConfigFetcher,useInvalidateConfig}.ts`, `src/hooks/business/user/useUserSettings.ts`, `src/components/context/RegistrationPersister.tsx`, `src/services/ConfigService.ts`

---

*Last updated: 2026-06-13*
