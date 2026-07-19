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

**Default behaviour: plain patch bump — increment the LAST number only.** We stay
on the current `major.minor` line and bump the patch digit every release:

```
2.1.0          a release
2.1.1          next release (patch bump)
2.1.2          next release
2.1.3          ...
```

This is what happens on **almost every release**: `2.1.2` → `2.1.3`. The major and
minor stay put. Do NOT auto-escalate to a minor (`2.2.0`) or major (`3.0.0`) bump
just because the commit range contains `feat:` or breaking-change commits — that
inference is wrong for this repo and has caused repeated mistakes. Escalating the
minor or major is **rare** and happens **only** when the user explicitly asks for
it (e.g. `/release minor`) or confirms it. When in doubt, patch-bump.

The version is stored **only in `package.json`** (the `version` field). Git tags
mirror it with a `v` prefix: `v2.1.0`, `v2.1.1`, `v2.1.2`, ...

## Version math (apply exactly)

Parse the current `package.json` version into `major.minor.patch` (e.g.
`2.1.2` → major=`2`, minor=`1`, patch=`2`).

- **Patch bump** (default): `major.minor.(patch+1)`.
  - `2.1.2` → `2.1.3`
- **Minor escalation** (only on explicit user request): `major.(minor+1).0`.
  - `2.1.2` → `2.2.0`
- **Major escalation** (only on explicit user request): `(major+1).0.0`.
  - `2.1.2` → `3.0.0`

**Special case — the very first release.** If `package.json` is still at the
placeholder `0.0.0` and no `v*` tags exist, the first release is **`2.1.0`** (the
agreed starting point), not a computed bump. Set it directly.

## Workflow

### Step 1: Pre-flight

```bash
git rev-parse --abbrev-ref HEAD          # must be main
git status --porcelain                   # must be clean
git tag -l "v*" --sort=-version:refname | head -10
node -e "console.log(require('./package.json').version)"
```

- If the branch is not `main` → **STOP**, tell the user. (Releases are cut from `main`.)
- If there are uncommitted changes → **STOP**, tell the user to commit or stash first.
- Note the current version and the latest `v*` tag.

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

The new version is a **plain patch bump** (per the version math above): keep
`major.minor`, increment the last number. `2.1.2` → `2.1.3`. That is the answer
almost every time — do not overthink it.

- **First release ever** (placeholder `0.0.0`, no `v*` tags): the new version is
  `2.1.0`. Set it directly and proceed.
- **Default (any normal release)**: patch-bump silently. Do NOT ask, and do NOT
  escalate to minor/major just because the range contains `feat:` or breaking
  commits. State the chosen version in Step 5 so the user can object before the
  push gate.
- **Explicit escalation only**: bump the minor or major **only** if the user
  invoked `/release minor` / `/release major`, or otherwise explicitly asked for
  it in this conversation. Never escalate on your own inference.

### Step 4: Bump `package.json`

Edit the `version` field in `package.json` to the chosen new version. Change
**only** that field. Do not touch any other file (no `version.ts`, no
`CHANGELOG.md` — release notes live on the GitHub release).

### Step 5: Commit & tag

Report to the user first:
- Previous version → New version (bump kind: suffix / patch / minor / major / initial)
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

All patch releases (`v2.1.1`, `v2.1.2`, `v2.1.3`, ...) are full releases — no
`--prerelease` flag.

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
- **First release** → version is `2.1.0`, set directly (no computed bump).

## Files modified

- `package.json` — the `version` field only.
- Git commit: `chore(release): vX.Y.Z`
- Git tag: `vX.Y.Z` (annotated)
- GitHub release with grouped changelog notes

---

*Last updated: 2026-07-17*
