---
name: prod-tag
description: Use when the user asks to tag a commit for production using the `prod-YYYY-MM-DD` convention — typically because another developer deployed without tagging, or to mark a manual production checkpoint. Triggers on "prod-tag this commit", "tag this for production", "add a prod tag", "missing prod tag", "tag the deploy".
---

# Tag a Commit for Production

Apply a production tag of the form `prod-YYYY-MM-DD` to a commit. Used independently of the deploy flow — e.g. when another developer pushed to `gh-pages` but forgot to tag the corresponding commit on `main`.

## Critical rule

Always confirm with the user before creating and pushing the tag. Never push silently.

## Workflow

### 1. Determine the commit to tag

- If the user supplies a commit hash, use it.
- If no hash, use the current `HEAD`.

### 2. Show what's being tagged

```bash
git log -1 --format="%h %ci %s" <commit>
```

Display this so the user can confirm it's the right commit.

### 3. Generate the tag name

- Base: `prod-YYYY-MM-DD` using today's date.
- Check for collisions: `git tag -l "prod-YYYY-MM-DD*"`.
- If today's tag already exists, append a suffix: `prod-YYYY-MM-DD-2`, `prod-YYYY-MM-DD-3`, etc.

### 4. Confirm

Show the user:
- Tag name
- Commit hash
- Commit message

Ask: "Tag and push?" — wait for an explicit yes.

### 5. Create and push

```bash
git tag -a <tag-name> <commit> -m "Production deployment"
git push origin <tag-name>
```

Report: tag name, commit, and remote URL.

## Rules

- Always use **annotated** tags (`-a`), never lightweight.
- Always use **today's actual date**, never a placeholder.
- Never push without user confirmation.
