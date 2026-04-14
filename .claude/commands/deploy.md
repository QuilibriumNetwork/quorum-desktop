# Deploy to GitHub Pages

Deploy the current `main` branch to the `gh-pages` branch of the production repo (`quorum-app-prod`).

The production repo is a **separate repository** at `../quorum-app-prod` (sibling directory). Its `gh-pages` branch is the live site at `app.quorummessenger.com`.

## Steps

Follow these steps **exactly**, pausing for user confirmation before any destructive or irreversible action.

### 1. Pre-flight checks

- Verify the current branch is `main`. If not, **stop and tell the user**.
- Run `git status` and check for uncommitted changes. If any exist, **stop and tell the user** — the working tree must be clean before deploying.
- Show the user the last 3 commits on `main` so they know what will be deployed.
- **Ask the user to confirm** they want to deploy these commits before proceeding.

### 2. Build

- Run `yarn build` and show the output.
- If the build fails, **stop and report the error** — do not continue.
- The build outputs to `dist/web/`. Confirm that folder exists and show its size.
- Tell the user the build succeeded.

### 3. Prepare the production repo

- Verify the `../quorum-app-prod` directory exists. If not, **stop and tell the user** they need to clone `git@github.com:QuilibriumNetwork/quorum-app-prod.git` as a sibling directory.
- `cd ../quorum-app-prod`
- Run `git fetch origin` and `git checkout gh-pages` and `git pull origin gh-pages` to ensure it is up to date.

### 4. Replace production assets

- **Ask the user to confirm** before deleting and replacing files. Explain that the next step will delete the old production assets (everything except `CNAME`, `404.html`, `redirect.js`, `handleredirect.js`, `apple/`) and replace them with the new build.
- Delete old assets (preserve the SPA routing files and CNAME):
  ```
  rm -rf assets twitter channelwasm_bg.wasm wasm_exec.js *.ttf *.svg *.png *.ico index.html manifest.webmanifest browserconfig.xml yandex-browser-manifest.json
  ```
- Copy the new build from `dist/web/` in the quorum-desktop repo:
  ```
  cp -r ../quorum-desktop/dist/web/* .
  ```
- Run `git add -A`
- Run `git status` to show the user what changed.

### 5. Commit

- Ask the user: "What should the deploy commit message describe?" and wait for their answer.
- Use their answer as the commit message: `git commit -m "<their message>"`

### 6. Push

- Show the user the commit that is about to be pushed (`git log -1 --oneline`).
- **Ask the user to confirm** one final time before pushing.
- Run `git push origin gh-pages`.
- After pushing, report success with the commit hash that was deployed.

### 7. Tag the release (prod-tag)

- Switch back to the `quorum-desktop` repo: `cd ../quorum-desktop`
- Apply a production tag to the current HEAD of `main` using the `prod-YYYY-MM-DD` naming convention:
  1. Run `git log -1 --format="%h %ci %s"` to show what is being tagged.
  2. Check if today's tag already exists: `git tag -l "prod-$(date +%Y-%m-%d)*"`
  3. If it exists, increment the suffix: `prod-YYYY-MM-DD-2`, `prod-YYYY-MM-DD-3`, etc.
  4. **Show the user** the tag name, commit hash, and commit message.
  5. **Ask: "Tag and push?"** — wait for confirmation.
  6. After confirmation, create the annotated tag: `git tag -a <tag-name> HEAD -m "Production deployment"`
  7. Push the tag: `git push origin <tag-name>`
  8. Report the final result: tag name, commit, and live URL (`https://app.quorummessenger.com`).
