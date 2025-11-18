---
description: Update .agents/INDEX.md file with latest documentation structure
---

Update the .agents/INDEX.md file by running `python3 .agents/update-index.py`

The script automatically:

1. **Scans** .agents directory for all markdown files
2. **Adds back links** `[← Back to INDEX](/.agents/INDEX.md)` below titles and at file ends
3. **Extracts titles** from `# headings` or formats filenames
4. **Orders files** by number prefix (`01-file.md`, `02-guide.md`) then alphabetically
5. **Groups by folder** structure (docs → bugs → tasks, with subfolders)
6. **Updates timestamp** in INDEX.md footer

Each folder handles numbering independently. Numbered files always come before non-numbered ones.
