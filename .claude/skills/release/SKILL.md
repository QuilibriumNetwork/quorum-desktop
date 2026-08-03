---
name: release
description: Use when the user asks to cut a release, bump the version, tag a new build, or publish release notes for quorum-desktop. Triggers on "release", "cut a release", "bump version", "new version", "tag a build", "release notes". Versioning only — this does NOT deploy to gh-pages (use the deploy skill for that).
allowed-tools:
  - Bash
  - Read
  - Edit
  - AskUserQuestion
---

# Release Management

Version-bump, git-tag, and GitHub-release workflow for **quorum-desktop**.

This skill handles **versioning only**. It does not build or deploy. Shipping
the build to `app.quorummessenger.com` stays with the separate **deploy** skill,
and the `prod-YYYY-MM-DD` deploy tags stay with the **prod-tag** skill. A typical
flow is: cut the release here, then run **deploy** to ship it.

## Versioning scheme

The version is **`<network-version>-<build>`**, e.g. `2.1.0-1`.

```
2.1.0-1        a release
2.1.0-2        next release (counter increments)
2.1.0-3        next release
...
2.1.1-1        Q network moved to 2.1.1 — base changes, counter RESETS
```

Two independent parts, and only one of them normally moves:

- **The base (`2.1.0`) is the Quilibrium network version this build runs
  against.** It is not the app's own version and it is not yours to bump. It
  changes **only** when the Q network itself releases a new version, and only
  when the user says so. Never infer a base change from the commit range.
- **The counter (`-1`, `-2`, …) is the build number.** It increments by one on
  every release, and **resets to `1`** when the base changes.

The whole stack shares this shape: quorum-shared is at `2.1.0-N` in its own
`package.json`, and quorum-mobile's artifacts are named `2.1.0-N.apk` from an
EAS-managed counter. Desktop matching it is the point of the scheme.

**Do NOT patch-bump.** `2.1.0-1` → `2.1.1-1` is wrong unless the network moved.
The old scheme (`2.1.2` → `2.1.3`) was retired because a bare `2.1.4` reads as a
claim about a Q network version that does not exist. Releases `v2.1.0` through
`v2.1.4` predate the change and are left in place as history; the first release
under this scheme steps down numerically from them, which is expected and
harmless (nothing compares these strings — there is no auto-updater, and
`electron-builder.json` has no `publish` block).

**Never zero-pad the counter.** `2.1.0-07` is invalid semver (leading zeros are
forbidden in numeric prerelease identifiers) and some tooling rejects it.

The version is stored **only in `package.json`** (the `version` field). Git tags
mirror it with a `v` prefix: `v2.1.0-1`, `v2.1.0-2`, ... The `v` stays: it is the
git convention and it distinguishes version tags from the `prod-YYYY-MM-DD`
deploy tags in the same repo.

**The UI picks this up automatically.** `web/vite.config.ts` reads
`package.json` at build time and inlines it as `__APP_VERSION__`;
`src/config/appVersion.ts` exposes it as `APP_VERSION`, and the settings
sidebar renders it. Bumping `package.json` is the only manual step — never
hand-edit a version string anywhere else.

## Version math (apply exactly)

Parse the current `package.json` version into `base` and `build` by splitting on
the **first** `-` (e.g. `2.1.0-7` → base=`2.1.0`, build=`7`).

- **Normal release** (default, effectively always): keep the base, increment the
  counter → `<base>-<build+1>`.
  - `2.1.0-7` → `2.1.0-8`
  - `2.1.0-9` → `2.1.0-10` (no padding, plain integer math)
- **Network bump** (only when the user states the new network version): new base,
  counter resets to `1` → `<new-base>-1`.
  - `2.1.0-42` → `2.1.1-1`
  - This stays monotonic in semver, since `2.1.1-1` > `2.1.0-42`.

**Special case — a version with no counter.** If `package.json` holds a bare
`major.minor.patch` with no `-N` suffix, it predates this scheme. Do not try to
compute from it. Ask the user for the network version to use as the base, then
set `<base>-1`.

## Workflow

### Step 1: Pre-flight

```bash
git rev-parse --abbrev-ref HEAD          # must be main
git status --porcelain                   # must be clean
git tag -l "v*" --sort=-creatordate | head -10
node -e "console.log(require('./package.json').version)"
```

- If the branch is not `main` → **STOP**, tell the user. (Releases are cut from `main`.)
- If there are uncommitted changes → **STOP**, tell the user to commit or stash first.
- Note the current version and the latest `v*` tag.

Sort by `creatordate`, **not** `version:refname`. Git's version sort has no
reliable ordering for prerelease suffixes without `versionsort.suffix` config,
and the pre-2.1.0-1 tags (`v2.1.0` … `v2.1.4`) sort *above* every current tag
under a naive version sort. "Most recently cut" is the property actually wanted
here, and creatordate gives it exactly.

### Step 2: Analyze commits since the last release

Find the reference point: the latest `v*` tag, or if none exist, the latest
`prod-*` tag, or the root commit.

```bash
git log <LATEST_VERSION_TAG>..HEAD --format="%h%x09%s"
```

- If there are **no new commits** since the last `v*` tag → "Nothing to release." and stop.
- Categorize each commit by conventional-commit prefix:
  - `feat:` / `feat(...)` → **Features**
  - `fix:` → **Bug Fixes**
  - `doc:` / `docs:` → **Documentation**
  - `chore:`, `refactor:`, `style:`, `test:`, `build:`, `ci:`, `perf:` → **Maintenance**
  - `feat!:`, `fix!:`, or a body containing `BREAKING CHANGE` → **Breaking**
  - anything else → **Other**

The categorization is **only** for grouping the release notes. It does **NOT**
drive the version bump — `feat:` commits do not make this a minor release.

### Step 3: Decide the new version

Keep the base, increment the counter (per the version math above). `2.1.0-7` →
`2.1.0-8`. That is the answer every time unless the user says the network moved.

- **Default (any normal release)**: increment the counter silently. Do NOT ask,
  and do NOT touch the base because the range contains `feat:` or breaking
  commits — the base tracks the Q network, not this repo's changes. State the
  chosen version in Step 5 so the user can object before the push gate.
- **Network bump only on explicit instruction**: change the base **only** if the
  user names the new Q network version in this conversation. Then reset the
  counter to `1`. Never infer a base change.
- **No counter in the current version**: see the special case in the version
  math. Ask for the base, do not guess.

### Step 4: Bump `package.json`

Edit the `version` field in `package.json` to the chosen new version. Change
**only** that field. Do not touch any other file (no `version.ts`, no
`CHANGELOG.md` — release notes live on the GitHub release).

### Step 5: Commit & tag

Report to the user first:
- Previous version → New version (bump kind: counter increment / network bump)
- Number of commits included
- A one-line summary of the categorized changes

Then:

```bash
git add package.json
git commit -m "chore(release): v<NEW_VERSION>"
git tag -a v<NEW_VERSION> -m "v<NEW_VERSION>"
```

- If the tag `v<NEW_VERSION>` already exists → **STOP** and report. (Should not
  happen with correct math, but guard anyway.)

### Step 6: Push & GitHub release

Use **AskUserQuestion**:
- "Push release to remote and create the GitHub release?"
- Options: "Yes, push and release" (Recommended) / "No, I'll do it later"

If **no**: stop here. Tell the user the commit and tag exist locally and how to
push them later (`git push origin main --tags`).

If **yes**:

```bash
git push origin main --tags
```

Then create the GitHub release on `QuilibriumNetwork/quorum-desktop` with grouped
changelog notes:

```bash
gh release create "v<NEW_VERSION>" --title "v<NEW_VERSION>" --notes "<changelog>"
```

These are all full releases — **never** pass `--prerelease`. The `-N` suffix is
semver's prerelease field, but that is an artifact of encoding the build counter,
not a statement that the build is unfinished. GitHub does not infer it either:
`gh release create` only marks a release as prerelease when explicitly told to.

### Step 7: Report

Display:
- Previous version → new version
- Commit hash and tag name
- GitHub release URL (if created)
- A reminder: "To ship this build live, run the **deploy** skill."

## Release notes format

Generate notes with only the sections that have changes, in this order:

```markdown
## Breaking Changes
- Description (short-hash)

## Features
- Description (short-hash)

## Bug Fixes
- Description (short-hash)

## Documentation
- Description (short-hash)

## Maintenance
- Description (short-hash)
```

- Write each line from the **user's perspective** — what changed for them, not
  the raw commit subject. Drop the conventional-commit prefix.
- Keep the `(short-hash)` at the end of each line for traceability.
- Use standard punctuation, not em dashes.
- **Never** mention Claude, AI, Anthropic, or any tooling in release notes,
  commit messages, or tags.

## Edge cases

- **No new commits since last `v*` tag** → "Nothing to release." Stop.
- **Uncommitted changes** → STOP, ask the user to commit or stash first.
- **Not on `main`** → STOP, releases are cut from `main`.
- **Tag already exists** → STOP and report; do not overwrite.
- **`gh` CLI unavailable or not authenticated** → the `git push` still
  succeeds; tell the user the tag is pushed and they can create the GitHub
  release manually at the repo's Releases page.
- **Version has no `-N` counter** → predates this scheme. Ask for the Q network
  version to use as the base, then set `<base>-1`. Do not compute.
- **New version sorts below an existing tag** → expected for the first release
  after the scheme change (`v2.1.4` → `v2.1.0-1`) and only for that one.
  Proceed. If it happens again later, the math is wrong: stop and re-read the
  version math section.

## Files modified

- `package.json` — the `version` field only.
- Git commit: `chore(release): v<base>-<build>`
- Git tag: `v<base>-<build>` (annotated)
- GitHub release with grouped changelog notes

The UI version badge needs no edit: it reads `package.json` through
`__APP_VERSION__` at build time.

---

*Last updated: 2026-08-03*
