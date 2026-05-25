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
- **Ask the user to confirm** they want to build and deploy `main` to production.

### 2. Build

- Run `yarn build` and show the output.
- If the build fails, **stop and report the error** — do not continue.
- Confirm `dist/web/` exists and show its size.
- Report success to the user.

### 3. Prepare the production repo

- Verify the `../quorum-app-prod` directory exists. If not, **stop and tell the user** they need to clone `git@github.com:QuilibriumNetwork/quorum-app-prod.git` as a sibling directory.
- `cd ../quorum-app-prod`
- Run `git fetch origin`, `git checkout gh-pages`, `git pull origin gh-pages`.

### 4. Replace production assets

- **Ask the user to confirm** before deleting and replacing files. Explain: the next step deletes the old production assets (everything except `CNAME`, `404.html`, `redirect.js`, `handleredirect.js`, `apple/`) and replaces them with the new build.
- Delete old assets (preserve SPA routing files and `CNAME`):
  ```bash
  rm -rf assets twitter channelwasm_bg.wasm wasm_exec.js *.ttf *.svg *.png *.ico index.html manifest.webmanifest browserconfig.xml yandex-browser-manifest.json
  ```
- Copy the new build from `dist/web/`:
  ```bash
  cp -r ../quorum-desktop/dist/web/* .
  ```
- Run `git add -A`, then `git status` to show what changed.

### 5. Commit

- Ask the user: "What should the deploy commit message describe?" and wait for their answer.
- Use their answer as the commit message: `git commit -m "<their message>"`.

### 6. Push

- Show the user the commit about to be pushed (`git log -1 --oneline`).
- **Ask the user to confirm** one final time.
- Run `git push origin gh-pages`.
- Report success with the commit hash that was deployed.

### 7. Tag the release

After a successful push, switch back to the `quorum-desktop` repo and apply a production tag to the current HEAD of `main`. Use the **prod-tag** skill for the full workflow (date-based naming, suffix increment, annotated tag, push, confirmation gates).

End by reporting: tag name, commit hash, and live URL (`https://app.quorummessenger.com`).
