---
description: Update a documentation file in .agents/docs to reflect current codebase state
argument-hint: [doc-name-or-path]
---

Update the documentation file specified by $ARGUMENTS to reflect the current state of the codebase.

**ARGUMENT RESOLUTION:**

1. If a full path is provided (e.g., `.agents/docs/features/modals.md`), use it directly
2. If just a name is provided (e.g., `modals` or `modals.md`), search in `.agents/docs/` and subdirectories
3. If multiple matches found, list them and ask user to clarify

**UPDATE PROCESS:**

1. **Read the existing documentation** - Understand what the doc covers
2. **Identify referenced files** - Extract all file paths mentioned (e.g., `src/components/Modal.tsx:123`)
3. **Verify each reference** - Check if:
   - Files still exist at specified paths
   - Line numbers are still accurate
   - Code snippets match current implementation
   - Component/function names haven't changed
4. **Review architecture claims** - Verify that:
   - Data flow descriptions are still accurate
   - Integration points haven't changed
   - Dependencies are still correct
5. **Update the documentation**:
   - Fix outdated file paths and line numbers
   - Update code snippets to match current implementation
   - Revise architectural descriptions if needed
   - Add any new related components/features
   - Remove references to deleted code
   - Keep the "Updated" timestamp current

**WHAT TO PRESERVE:**

- Original document structure and organization
- Technical decisions and their rationale (unless obsolete)
- Known limitations (verify they still apply)
- Overall tone and writing style

**WHAT TO UPDATE:**

- File paths and line numbers
- Code examples and snippets
- Component/function names
- Integration points and data flow
- Dependencies and imports
- "Updated" timestamp at the end

**AFTER UPDATING:**

Run the index update script to sync changes:
```bash
python3 .claude/skills/docs-manager/update-index.py
```

**OUTPUT:**

Provide a summary of changes made:
- Files/lines updated
- Sections modified
- Any items that need manual review (e.g., unclear if feature still works as described)
