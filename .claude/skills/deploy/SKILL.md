---
name: deploy
description: Use when the user asks to deploy this app to production, push to GitHub Pages, ship the current build to `app.quorummessenger.com`, or update the live site. Triggers on "deploy", "deploy to prod", "publish", "ship it", "push to gh-pages", "update production".
---

# Deploy to GitHub Pages

Deploy the current `main` branch of `quorum-desktop` to the `gh-pages` branch of the production repo (`quorum-app-prod`). That branch serves the live site at `app.quorummessenger.com`.

The production repo is a **separate repository** at `../quorum-app-prod` (sibling directory of this repo).

## Critical rule

Pause and ask for user confirmation before any destructive or irreversible action: before building, before deleting old assets, before committing, and before pushing. Never proceed silently through these gates.

## Steps

### 1. Pre-flight checks

- Verify the current branch is `main`. If not, **stop and tell the user**.
- Run `git status`. If there are uncommitted changes, **stop and tell the user** — the working tree must be clean before deploying.
- Show the user the last 3 commits on `main` for reference (the entire app is built, not just these commits).
- **Run the version check below.** Do this *before* the confirmation gate, not after.
- **Ask the user to confirm** they want to build and deploy `main` to production.

#### Version check — run the release BEFORE building, never after

`web/vite.config.ts` reads `package.json` at config-load time and inlines the
version into the bundle as `__APP_VERSION__`, which the settings sidebar renders.
**The version is baked in at build time**, so a version bump after the build
produces a bundle that displays the *old* number. There is no way to fix that
except rebuilding.

```bash
CURRENT=$(node -p "require('./package.json').version")
git rev-list "v$CURRENT..HEAD" --count 2>/dev/null || echo "TAG_MISSING"
```

Interpret the result:

| Result | Meaning | Action |
|---|---|---|
| `0` | HEAD is exactly the commit released as `v$CURRENT` | Fine. Proceed to build. |
| `N > 0` | N commits sit on top of the last release, so this build would ship new code under an already-deployed version number | **Stop and tell the user.** Offer to run the **release** skill first. |
| `TAG_MISSING` | `package.json` was bumped but `v$CURRENT` was never tagged | **Stop and ask.** Either the release is half-done or the tag was never pushed; do not guess. |

When the count is non-zero, say so plainly and surface the choice — cutting the
release first is almost always right, since deploying without it ships changes
under a stale version and makes the live build indistinguishable from the
previous one in the UI. If the user chooses to deploy anyway, that is their call:
proceed, but do not silently pretend the numbers line up.

**If a build has already happened when this is discovered**, the build is stale
and must be discarded. Reset the production repo working tree
(`git -C ../quorum-app-prod restore --source=HEAD --staged --worktree .` then
`git clean -fdq`) before running the release, then rebuild from scratch. Copying
a pre-bump build into production is the failure this check exists to prevent.

### 2. Build

- Run `yarn build` and show the output.
- If the build fails, **stop and report the error** — do not continue.
- Confirm `dist/` exists and show its size.
- **Confirm the built bundle carries the expected version**, with a control that
  proves the check could have failed:
  ```bash
  V=$(node -p "require('./package.json').version")
  grep -o ".\{10\}$V.\{10\}" dist/assets/index-*.js | head -1   # expect a hit
  grep -c "$V" dist/assets/*.js | grep -v ':0$'                 # which files carry it
  ```
  The version appears in the bundle unquoted and backtick-delimited (e.g.
  ``[`v`,`2.1.0-2`]``), so a `grep '"2.1.0-2"'` with double quotes matches
  nothing and reads as a false negative. Match the bare string.
  As the control, grep for the *previous* version and confirm it is absent — a
  hit means a stale chunk survived and the build is not what it claims to be.

  **Anchor that `:0$`.** Unanchored, `grep -v ':0'` also discards real counts
  like `:10` and `:20`, and lets other `:0`-containing lines through. Running
  the control unanchored on 2026-08-13 reported two files carrying an old
  version that in fact carried nothing — a false alarm on the one check whose
  entire job is to be trustworthy. Escape the dots too (`2\.0\.9`); an
  unescaped version string is a regex where `.` matches any character.
- Report success to the user.

### 3. Prepare the production repo

- Verify the `../quorum-app-prod` directory exists. If not, **stop and tell the user** they need to clone `git@github.com:QuilibriumNetwork/quorum-app-prod.git` as a sibling directory.
- `cd ../quorum-app-prod`
- Run `git fetch origin`, `git checkout gh-pages`, `git pull origin gh-pages`.

### 4. Replace production assets

**Production owns exactly three paths. The build owns everything else.**

| Production-owned (never delete) | Why |
|---|---|
| `CNAME` | the custom domain; losing it takes the site off `app.quorummessenger.com` |
| `.gitignore` | belongs to the `gh-pages` branch, not to any build |
| `apple/` | Apple emoji sprites, served but **not** produced by `yarn build` (only `twitter/` is) |

Everything else on `gh-pages` is build output and gets replaced wholesale.

> **`404.html`, `redirect.js` and `handleredirect.js` are build output, not
> production files.** They live in `quorum-desktop/public/` and Vite copies them
> into `dist/`, so every deploy overwrites them. Editing them on `gh-pages`
> looks like it works and is silently reverted by the next deploy — change them
> in `public/` instead.

- **Ask the user to confirm** before deleting and replacing files. Explain that
  everything except the three paths above is about to be removed and replaced by
  the new build.
- Delete the old build. **Do not enumerate what to delete** — invert it and keep
  only what production owns, so an asset type the build stops shipping cannot
  linger:
  ```bash
  git ls-files -z | grep -zvE '^(CNAME|\.gitignore|apple/)' | xargs -0 -r rm -f
  find . -mindepth 1 -type d -empty -not -path './.git*' -delete
  ```
  Sanity-check the scale before trusting it — swap `rm -f` for `wc -l` on the
  same pipeline. Most tracked files are *survivors*, not deletions, because
  `apple/` holds several thousand emoji sprites: on 2026-08-13 it selected 3,892
  files to delete out of 7,695 tracked. A run that proposes deleting nearly
  everything means the keep-pattern stopped matching.

  The previous version of this step listed extensions (`*.ttf *.svg *.png *.ico`
  …) and had drifted: it missed `*.gif`, which the build does ship, and still
  named `browserconfig.xml` and `yandex-browser-manifest.json`, which have
  existed in neither the build nor production for some time.
- Confirm the keep-set survived before copying anything over it:
  ```bash
  ls -d CNAME .gitignore apple    # all three must exist
  ```
- Copy the new build from `dist/`:
  ```bash
  cp -r ../quorum-desktop/dist/* .
  ```
- Run `git add -A`, then `git status` to show what changed.
- **Read the deletions in that status.** Lines beginning `D` mean the build no
  longer ships a file production was serving. Sometimes that is intended (an
  asset was genuinely dropped); sometimes it means the build is incomplete. Name
  them to the user rather than committing past them.

### 5. Commit

- Ask the user: "What should the deploy commit message describe?" and wait for their answer.
- Use their answer as the commit message: `git commit -m "<their message>"`.

### 6. Push

- Show the user the commit about to be pushed (`git log -1 --oneline`).
- **Ask the user to confirm** one final time.
- Run `git push origin gh-pages`.
- Report success with the commit hash that was deployed.

### 7. Verify the live site

Do not report the deploy as done on the strength of a successful push. Pages
takes a minute or so to propagate, and a push proves only that the commit
landed. Wait, then measure:

```bash
sleep 45
curl -s -H 'Cache-Control: no-cache' https://app.quorummessenger.com/index.html \
  | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'          # must match the new hash
curl -s "https://app.quorummessenger.com/assets/<new-hash>.js" \
  | grep -o ".\{10\}$(node -p "require('./package.json').version").\{10\}" | head -1
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://app.quorummessenger.com/assets/<old-hash>.js"   # control: expect 404
```

The 404 on the previous bundle is the control. Without it, a cached or
half-propagated deploy where both builds are served looks identical to a clean
one. If it still returns 200 after a couple of minutes, say so rather than
calling the deploy verified.

### 8. Tag the release

After a successful push, switch back to the `quorum-desktop` repo and apply a production tag to the current HEAD of `main`. Use the **prod-tag** skill for the full workflow (date-based naming, suffix increment, annotated tag, push, confirmation gates).

End by reporting: version deployed, tag name, commit hash, and live URL
(`https://app.quorummessenger.com`). If any gate was declined, name what was
skipped rather than reporting a clean run.

## Related skills

- **release** — bumps `package.json`, tags `v<version>`, publishes the GitHub
  release. Runs *before* this skill, never after. See the version check in step 1.
- **prod-tag** — applies the `prod-YYYY-MM-DD` deploy marker in step 8.

---

*Last updated: 2026-08-13*
