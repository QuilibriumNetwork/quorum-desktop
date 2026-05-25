---
name: doc-update
description: Use when the user asks to refresh or sync a documentation file in `.agents/docs/` against the current codebase. Triggers on "update this doc", "refresh the modals doc", "sync the docs with the code", "the doc is out of date", "verify the references in <doc>".
---

# Update a `.agents/docs/` Documentation File

Refresh a doc under `.agents/docs/` so its file references, line numbers, code snippets, and architectural claims match the current state of the codebase.

## Resolve the target doc

The user names a doc — full path, partial path, or just a slug.

1. If a full path is given (e.g. `.agents/docs/features/modals.md`), use it.
2. If only a name is given (`modals`, `modals.md`), search `.agents/docs/` and subdirectories.
3. If multiple matches, list them and ask the user to clarify.

## Update process

1. **Read the existing doc.** Understand its scope.
2. **Extract every file reference** (e.g. `src/components/Modal.tsx:123`, function names, component names).
3. **Verify each reference**:
   - Files still exist at the cited paths
   - Line numbers are accurate
   - Code snippets match the current implementation
   - Component / function names haven't been renamed
4. **Review architecture claims**:
   - Data flow descriptions still hold
   - Integration points haven't moved
   - Dependencies are still correct
5. **Apply updates**:
   - Fix outdated paths and line numbers
   - Replace stale code snippets
   - Revise architectural descriptions
   - Add new related components / features that the doc should now cover
   - Remove references to deleted code
   - Bump the "Updated" timestamp at the end of the file

## Preserve

- Document structure and section ordering
- Technical decisions and their rationale (unless obsolete)
- Known limitations (verify they still apply)
- Tone and writing style

## After updating

Run the index update to sync `.agents/INDEX.md`:

```bash
python3 .claude/skills/docs-manager/update-index.py
```

## Output

Report a summary of changes:

- Files / lines updated
- Sections modified
- Anything that needs manual review (e.g. unclear whether the described behavior still holds)
