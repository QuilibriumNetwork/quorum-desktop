---
type: reference
title: "npm Publish Access + Release Flow for @quilibrium/quorum-shared"
status: done
complexity: low
created: 2026-03-15
updated: 2026-07-16
---

# npm Publish Access + Release Flow for @quilibrium/quorum-shared

> **Status (2026-07-16): access resolved.** Publish access to the `@quilibrium` scope is in place — the migration has shipped 30+ `quorum-shared` versions (currently `2.1.0-34`), many via our own PRs + self-publish. The setup steps below are kept for reference / re-onboarding a new machine. **The part that stays live is the release flow in [§4](#4-release-flow-how-versions-actually-ship).**

## Goal

Have permission to publish packages under the `@quilibrium` npm scope, so we can manage `quorum-shared` releases independently without needing the lead dev to publish every time.

## Steps (one-off, already done — kept for a fresh machine)

### 1. Create an npm account (your side)

- Go to https://www.npmjs.com/signup and create an account (or log in if you already have one)
- Run `npm adduser` in your terminal to authenticate your machine
- Verify with `npm whoami` — should show your npm username

### 2. Ask the lead dev to add you to the org (their side)

Send something like:

> Can you add me to the `@quilibrium` npm organization with publish access? My npm username is `<your-username>`.

What they need to do:
- Go to https://www.npmjs.com/settings/quilibrium/members
- Click "Invite" and enter your npm username
- Set role to **"Developer"** (can publish packages) or **"Admin"** (can also manage members)

### 3. Verify access (your side)

Once they confirm:

```bash
# Check you're a member
npm org ls quilibrium

# Test publish access (dry run — doesn't actually publish)
cd d:/GitHub/Quilibrium/quorum-shared
npm publish --dry-run
```

If the dry run succeeds, you're good to go.

### 4. Release flow (how versions actually ship)

This is the live part of the doc. After a feature PR merges into `quorum-shared`'s `main`, a version is published so desktop/mobile can consume it.

> **Versioning convention — do NOT "fix" it.** `quorum-shared` uses `2.1.0-N` (a plain integer prerelease suffix that increments: `-33` → `-34` → `-35`, never resetting to SemVer `2.1.1`). This is a **deliberate lead-dev convention**, not an accident. `npm version prerelease` happens to produce exactly this (`2.1.0-34` → `2.1.0-35`), so it's safe to use. Do not propose migrating shared to conventional `X.Y.Z` releases. (Desktop, separately, uses plain SemVer patch bumps — different repo, different rule.)

```bash
cd d:/GitHub/Quilibrium/quorum-shared

# 0. On main, up to date, with the merged feature PR already in.
git checkout main && git pull

# 1. Bump the prerelease integer. This IS the whole convention.
npm version prerelease           # 2.1.0-34 → 2.1.0-35, no manual editing

# 2. Publish (prepublishOnly runs the build automatically — see package.json).
npm publish

# 3. Commit + push the bump. Match the established commit message format:
git commit -am "chore(release): bump version to $(node -p "require('./package.json').version")"
git push

# 4. Verify what's live
npm view @quilibrium/quorum-shared version
```

Notes:
- `prepublishOnly` already runs `npm run build`, so a separate `yarn build` before publish is redundant (the earlier version of this doc had it as a manual step).
- Recent history sometimes lands the bump as its own commit (`chore(release): bump version to 2.1.0-NN`) separate from the feature PR; sometimes it's `bump version for publish`. The `chore(release):` form is the current convention — prefer it.
- **Consumers**: desktop reads shared via a local `link:` symlink, so it sees changes without a version bump. **Mobile** depends on the published npm version (`^2.1.0-NN`) and needs an explicit bump + `yarn install` in a mobile PR. See [../cross-repo-workflow.md](../cross-repo-workflow.md) → "Versioning (the `link:` symlink)".

## 2FA

npm recommends two-factor auth for publishing:
- https://www.npmjs.com/settings/~/tfa → enable 2FA for **authorization and publishing**

---

_Created: 2026-03-15 · Last updated: 2026-07-16_
