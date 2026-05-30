---
type: task
title: "Get npm Publish Access for @quilibrium/quorum-shared"
status: open
complexity: low
created: 2026-03-15
updated: 2026-03-15
---

# Get npm Publish Access for @quilibrium/quorum-shared

## Goal

Get permission to publish packages under the `@quilibrium` npm scope, so you can manage `quorum-shared` releases independently without needing the lead dev to publish every time.

## Steps

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

### 4. Publishing workflow (for future reference)

```bash
cd d:/GitHub/Quilibrium/quorum-shared

# 1. Make sure you're on the right branch and build passes
yarn build

# 2. Bump version in package.json (manually or with npm version)
npm version prerelease --preid=""

# 3. Publish
npm publish

# 4. Verify
npm view @quilibrium/quorum-shared version
```

## Optional: Enable 2FA

npm strongly recommends enabling two-factor authentication for publishing:
- Go to https://www.npmjs.com/settings/~/tfa
- Enable 2FA for **authorization and publishing**

---

_Created: 2026-03-15_
