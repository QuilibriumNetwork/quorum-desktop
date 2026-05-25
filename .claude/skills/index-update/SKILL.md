---
name: index-update
description: Use when the user asks to rebuild or refresh `.agents/INDEX.md` after adding, removing, or renaming files in `.agents/`. Triggers on "update the INDEX", "rebuild the agents index", "sync INDEX.md", "regenerate the docs index".
---

# Rebuild `.agents/INDEX.md`

Refresh the `.agents/INDEX.md` index by running the project script that scans `.agents/` and rewrites the file.

## Command

```bash
python3 .claude/skills/docs-manager/update-index.py
```

## What the script does

1. Scans the `.agents` directory tree for all markdown files.
2. Inserts a `[← Back to INDEX](/.agents/INDEX.md)` link below each file's title and at the end of each file.
3. Extracts each entry's title from the first `# heading`, or formats the filename if none exists.
4. Orders files by numeric prefix (`01-file.md`, `02-guide.md`) first, then alphabetically.
5. Groups entries by folder structure (`docs` → `bugs` → `tasks`, with subfolders).
6. Updates the timestamp in the `INDEX.md` footer.

Each folder is numbered independently. Numbered files always come before non-numbered ones in the same folder.

## When to run

After any of: creating new docs/bugs/tasks/reports in `.agents/`, renaming files, moving files into `.solved/` or `.done/`, deleting markdown under `.agents/`.
