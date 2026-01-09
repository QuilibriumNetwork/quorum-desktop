---
type: task
title: Add YAML Frontmatter to Knowledge Base System
status: done
complexity: medium
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Add YAML Frontmatter to Knowledge Base System

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/dev/docs/hooks/useMarkdownFiles.ts:1-150`
- `src/dev/docs/Tasks.tsx:1-330`
- `src/dev/docs/Bugs.tsx:1-242`
- `src/dev/docs/Docs.tsx:1-267`
- `src/dev/docs/Reports.tsx:1-241`
- `.agents/tasks/*.md` (all task files)
- `.agents/bugs/*.md` (all bug files)
- `.agents/docs/*.md` (all doc files)
- `.agents/reports/*.md` (all report files)

## What & Why

Currently, task/bug/doc/report metadata is inferred from folder structure and filename prefixes (e.g., `.done/`, `SOLVED_`). This makes filtering, cross-referencing, and tracking difficult. Adding YAML frontmatter to all markdown files will enable rich metadata, better filtering in the dev UI, and cross-document relationships tracking.

## Context

- **Existing pattern**: Docs-manager skill already creates structured markdown files
- **Current limitation**: Status determined by folder/filename, no tags, no relationships, no dates
- **Goal**: Unified metadata system across all document types (tasks, bugs, docs, reports)
- **Decision**: Keep separate pages (Tasks.tsx, Bugs.tsx, Docs.tsx, Reports.tsx) but share common component logic

---

## Implementation

### Phase 1: Define YAML Schema & Install Parser

- [ ] **Install gray-matter library** (`package.json`)
    - Done when: `yarn add -D gray-matter` completes successfully (devDependency only)
    - Done when: TypeScript types installed: `yarn add -D @types/gray-matter`
    - Note: Since /dev pages are dev-only, gray-matter is a devDependency
    - Verify: `const matter = require('gray-matter')` works in scanMarkdownFiles.cjs

- [ ] **Define YAML frontmatter schema** (create `src/dev/docs/types/frontmatter.ts`)
    - Done when: TypeScript interface exported for all frontmatter fields
    - Include fields:
      ```typescript
      export interface FrontmatterData {
        type?: 'task' | 'bug' | 'doc' | 'report';
        title?: string;
        status?: 'pending' | 'in-progress' | 'blocked' | 'done' | 'solved' | 'archived';
        complexity?: 'low' | 'medium' | 'high' | 'very-high'; // tasks only
        ai_generated?: boolean;
        reviewed_by?: 'human' | 'agent' | null;
        created?: string; // YYYY-MM-DD
        updated?: string; // YYYY-MM-DD
        related_issues?: string[]; // ["#14", "#15"]
        related_docs?: string[]; // [doc-slug-1]
        related_tasks?: string[]; // [task-slug-1]
        related_bugs?: string[]; // [bug-slug-1]
      }
      ```
    - Verify: Interface imports successfully in `useMarkdownFiles.ts`

### Phase 2: Update Build Script to Extract Frontmatter

- [ ] **Enhance scanMarkdownFiles.cjs to extract frontmatter** (`src/dev/docs/utils/scanMarkdownFiles.cjs:1-67`)
    - Done when: Build script extracts YAML frontmatter at build/dev time
    - Add gray-matter import at top:
      ```javascript
      const matter = require('gray-matter');
      ```
    - Update file processing (around line 25-34):
      ```javascript
      } else if (item.endsWith('.md')) {
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

        // Read file and extract frontmatter
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const parsed = matter(fileContent);

        files.push({
          name: item,
          path: relativePath,
          folder: baseFolder || 'root',
          frontmatter: parsed.data,  // ← ADD: includes type, status, created, etc.
        });
      }
      ```
    - Handle Windows paths: Ensure `replace(/\\/g, '/')` normalizes all paths to forward slashes
    - Verify: Run `node src/dev/docs/utils/scanMarkdownFiles.cjs` → check markdownFiles.json includes frontmatter

- [ ] **Update MarkdownFile interface** (`src/dev/docs/hooks/useMarkdownFiles.ts:3-12`)
    - Done when: `MarkdownFile` interface includes all frontmatter fields
    - Add fields from `FrontmatterData` interface
    - Keep existing fields (`name`, `path`, `folder`, `slug`)
    - Add `frontmatter?: FrontmatterData` field
    - Add `complexity?: 'low' | 'medium' | 'high' | 'very-high'` (for tasks)
    - Verify: TypeScript compiles without errors

- [ ] **Use frontmatter from markdownFiles.json** (`src/dev/docs/hooks/useMarkdownFiles.ts:105-141`)
    - Done when: Hook uses pre-extracted frontmatter from markdownFiles.json
    - Priority: If `file.frontmatter.status` exists, use it; otherwise fall back to `determineStatus()`
    - Priority: If `file.frontmatter.title` exists, use it; otherwise use `filenameToTitle()`
    - No need to fetch individual files at runtime - frontmatter already in JSON
    - Update `processedFiles` mapping to include frontmatter data
    - Verify: Files with YAML frontmatter show correct status/title in dev UI

### Phase 3: Update docs-manager Skill

- [ ] **Update docs-manager skill to write YAML frontmatter**
    - Done when: All new/updated files include YAML frontmatter header
    - Location: `.claude/skills/docs-manager/SKILL.md`
    - Add frontmatter template:
      ```yaml
      ---
      type: task
      title: "Descriptive title"
      status: pending
      ai_generated: true
      reviewed_by: null
      created: 2026-01-09
      updated: 2026-01-09
      # Only include non-empty fields (omit empty arrays for cleaner YAML)
      related_issues: ["#14"]  # Only if there are related issues
      ---
      ```
    - Auto-populate `type` based on destination folder (tasks/bugs/docs/reports)
    - Auto-populate `created` with current date
    - Auto-populate `ai_generated: true` for all AI-created documents
    - Auto-populate `reviewed_by: null` for new documents
    - Update `updated` field when modifying existing files
    - **Omit empty fields**: Don't include `related_*` arrays if empty (cleaner YAML)
    - Verify: Create new task with docs-manager → file has YAML frontmatter

### Phase 4: Migration Script for Existing Files

- [ ] **Create migration script** (create `scripts/add-yaml-frontmatter.js`)
    - Done when: Script parses all `.agents/**/*.md` files and adds frontmatter
    - Functionality:
      - Read all markdown files in `.agents/` folders (UTF-8 encoding)
      - Extract metadata from existing file content (see extraction rules below)
      - Generate frontmatter based on extracted metadata
      - Prepend frontmatter to file content (if not already present)
      - Preserve existing content exactly
      - Write files with UTF-8 encoding (no BOM)
    - Safety: Dry-run mode to preview changes before applying
    - Verify: Run in dry-run mode → shows proposed changes without modifying files

- [ ] **Implement metadata extraction logic**
    - Done when: Script correctly extracts metadata from various file formats
    - **Extract `type`**: Determine from folder path (cross-platform)
      ```javascript
      // Normalize path for cross-platform (Windows uses backslashes)
      const normalizedPath = filePath.replace(/\\/g, '/');

      // Match /.agents/tasks/ or /.agents/tasks/.done/ or /.agents/tasks/subfolder/
      if (normalizedPath.includes('/.agents/tasks/')) type = 'task';
      if (normalizedPath.includes('/.agents/bugs/')) type = 'bug';
      if (normalizedPath.includes('/.agents/docs/')) type = 'doc';
      if (normalizedPath.includes('/.agents/reports/')) type = 'report';
      // Type is based on top-level folder, not subfolder (.done, .archived, etc.)
      ```

    - **Extract `title`**: Use H1 heading (first line with `#`)
      ```javascript
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : null;
      ```

    - **Extract `status`**: Parse from markdown metadata OR subfolder/filename
      ```javascript
      // Helper function to normalize status strings
      function normalizeStatus(rawStatus) {
        const normalized = rawStatus.toLowerCase().replace(/\s+/g, '-');
        const mapping = {
          'pending': 'pending',
          'in-progress': 'in-progress',
          'in progress': 'in-progress',
          'blocked': 'blocked',
          'done': 'done',
          'completed': 'done',
          'complete': 'done',
          'solved': 'solved',
          'fixed': 'solved',
          'archived': 'archived',
          'active': 'active'
        };
        return mapping[normalized] || normalized;
      }

      // Priority 1: Look for **Status**: in markdown (within first 20 lines)
      const statusMatch = content.match(/\*\*Status\*\*:\s*(\w+(?:\s+\w+)?)/i);
      if (statusMatch) {
        const rawStatus = statusMatch[1].toLowerCase();
        status = normalizeStatus(rawStatus);
      }
      // Priority 2: Check subfolder/filename (cross-platform paths)
      else {
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (normalizedPath.includes('/.done/') || filename.startsWith('DONE_')) {
          status = 'done';
        } else if (normalizedPath.includes('/.archived/') || normalizedPath.includes('/.archive/') || filename.startsWith('ARCHIVED_')) {
          status = 'archived';
        } else if (normalizedPath.includes('/.solved/') || filename.startsWith('SOLVED_')) {
          status = 'solved';
        }
        // Priority 3: Default based on type
        else {
          status = type === 'bug' ? 'active' : 'pending';
        }
      }
      ```

    - **Extract `created` date**: Parse from markdown metadata near top
      ```javascript
      // Look for patterns like:
      // **Created**: 2025-12-30
      // Created: 2026-01-09
      // **Date:** 2025-12-03
      const createdMatch = content.match(/\*\*(?:Created|Date)\*\*:\s*(\d{4}-\d{2}-\d{2})/i);
      const created = createdMatch ? createdMatch[1] : null;
      ```

    - **Extract `updated` date**: Parse from footer (last 10 lines)
      ```javascript
      // Look for patterns like:
      // *Last Updated: 2026-01-09*
      // **2026-01-08 - Claude**: Updated...
      const lines = content.split('\n');
      const footer = lines.slice(-10).join('\n');
      const updatedMatch = footer.match(/(?:Last Updated|Updated):\s*(\d{4}-\d{2}-\d{2})/i) ||
                           footer.match(/\*\*(\d{4}-\d{2}-\d{2})\s*-/);
      const updated = updatedMatch ? updatedMatch[1] : null;
      ```

    - **Extract `related_issues`**: Parse GitHub issue/PR references (first 50 lines only)
      ```javascript
      // Look for patterns in header section only (avoid matching code examples)
      const headerLines = content.split('\n').slice(0, 50).join('\n');

      // Match patterns like:
      // **Reference**: [GitHub Issue #14](...), [PR #15](...)
      // https://github.com/.../issues/14
      // #14, #15
      const issueMatches = headerLines.matchAll(/#(\d+)|issues\/(\d+)|pull\/(\d+)/g);
      const issueNumbers = [...issueMatches].map(m => `#${m[1] || m[2] || m[3]}`);

      // Remove duplicates
      const related_issues = [...new Set(issueNumbers)];
      ```

    - **Extract `complexity`**: Parse from metadata (tasks only)
      ```javascript
      // Look for: **Complexity**: High
      const complexityMatch = content.match(/\*\*Complexity\*\*:\s*(\w+)/i);
      const complexity = complexityMatch ? complexityMatch[1].toLowerCase() : null;
      ```

    - **Extract `ai_generated`**: Detect AI-generated warning (omit if not found)
      ```javascript
      // Look for: > **⚠️ AI-Generated**: May contain errors (in first ~10 lines)
      const headerLines = content.split('\n').slice(0, 10).join('\n');
      const aiGeneratedMatch = headerLines.match(/>\s*\*\*⚠️\s*AI-Generated\*\*/i);
      const ai_generated = aiGeneratedMatch ? true : null;
      // Note: If null, field will be omitted from YAML (per YAML generation rules)
      ```

    - **Extract `reviewed_by`**: Omit for all existing files
      ```javascript
      // Existing files have no review tracking history
      // Field will be omitted from YAML (null value)
      const reviewed_by = null;
      // Future: Could parse review comments from Updates section if needed
      ```

    - **Fallback values**:
      - If `created` not found: use file creation date or current date
      - If `updated` not found: use file modification date or omit field
      - If `status` not found: use folder/filename detection
      - If `title` not found: derive from filename (existing `filenameToTitle()` logic)
      - If `ai_generated` not found: set to null (field will be omitted from YAML)
      - If `reviewed_by` not found: set to null (field will be omitted from YAML)

    - **YAML generation rules**:
      - Omit empty arrays (`related_*` fields with no values)
      - Omit optional fields that are null/undefined
      - Only include fields with actual values for cleaner YAML
      - Example: If no related_issues found, don't include `related_issues: []`

    - **File encoding**:
      - Read files as UTF-8: `fs.readFileSync(filePath, 'utf-8')`
      - Write files as UTF-8: `fs.writeFileSync(filePath, content, 'utf-8')`
      - No BOM (Byte Order Mark)

    - Verify: Test extraction on sample files from each category (task, bug, doc, report)

- [ ] **Test migration script thoroughly before running on all files**
    - Done when: Script tested on representative sample files with edge cases
    - Create test files in a temporary folder:
      - File with full metadata (status, created, updated, etc.)
      - File with minimal metadata (just title)
      - File with no metadata (blank or just content)
      - File in subfolder (`.done/`, `.archived/`, etc.)
      - File with filename prefix (`DONE_`, `SOLVED_`, etc.)
      - File with existing YAML frontmatter (should skip)
    - Run script in dry-run mode: `node scripts/add-yaml-frontmatter.js --dry-run`
    - Verify extracted metadata matches expectations for each test case
    - Fix any parsing issues before proceeding to full migration
    - Test on 2-3 real files from `.agents/` before batch processing

- [ ] **Run migration on all existing files**
    - Done when: All `.agents/**/*.md` files have YAML frontmatter
    - Process folders: tasks, bugs, docs, reports
    - Backup: Create git commit before running migration
    - Run script: `node scripts/add-yaml-frontmatter.js --apply`
    - Verify: Spot-check 5-10 random files to ensure frontmatter is correct

### Phase 5: UI Enhancements (Optional - Future)

- [ ] **Add filter chips for metadata** (Tasks.tsx, Bugs.tsx, Docs.tsx, Reports.tsx)
    - Done when: Users can filter by status, tags, date range
    - Show filters as chips above file list
    - Use existing `FlexRow` and `Button` primitives
    - Reference: Follow filter pattern from Docs.tsx search (line 104-114)
    - Deferred: Can be implemented later based on user feedback

- [ ] **Show related documents** (in MarkdownViewer component)
    - Done when: Related tasks/bugs/docs/reports shown as clickable links
    - Parse `related_*` fields from frontmatter
    - Render as section at bottom of document
    - Link to `/dev/tasks/{slug}`, `/dev/bugs/{slug}`, etc.
    - Deferred: Can be implemented later

---

## Verification

✓ **gray-matter library installed**
    - Run: `yarn list gray-matter`
    - Expect: Shows installed version

✓ **YAML frontmatter parsed correctly**
    - Test: Open `/dev/tasks` → file with frontmatter shows correct metadata
    - Test: File without frontmatter falls back to folder/filename detection

✓ **TypeScript compiles**
    - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
    - Expect: Zero errors

✓ **Migration script works**
    - Test: Run dry-run mode → see proposed changes
    - Test: Run with --apply → files updated with frontmatter
    - Verify: Git diff shows only frontmatter added, no content changes

✓ **docs-manager creates files with frontmatter**
    - Test: Use docs-manager skill to create new task
    - Verify: New file includes YAML frontmatter with correct fields

✓ **Backwards compatibility**
    - Test: Files without frontmatter still display correctly
    - Test: Old folder structure still works as fallback

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| File has malformed YAML | Ignore frontmatter, use fallback detection | 🔧 Needs handling | P0 | Medium |
| File has frontmatter AND is in .done/ folder | Frontmatter takes precedence | ✅ Already works | P0 | Low |
| Migration runs twice | Skip files that already have frontmatter | 🔧 Add detection | P1 | Low |
| Frontmatter has unknown fields | Ignore unknown fields, parse known ones | ✅ gray-matter handles | P2 | Low |
| File has no type field in frontmatter | Infer from folder (tasks/bugs/docs/reports) | 🔧 Add fallback | P0 | Low |

---

## Definition of Done

- [ ] All Phase 1-4 checkboxes complete
- [ ] TypeScript compiles without errors
- [ ] All verification tests pass
- [ ] Migration script tested on subset of files first
- [ ] All existing files have YAML frontmatter
- [ ] docs-manager skill generates frontmatter for new files
- [ ] No console errors or warnings in dev UI
- [ ] Backwards compatibility maintained for files without frontmatter

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2026-01-09 - Claude**: Initial task creation based on user requirements for YAML frontmatter system
**2026-01-09 - Claude**: Added `ai_generated` and `reviewed_by` fields to track review status
**2026-01-09 - Claude**: Updated migration script extraction logic to omit `ai_generated` and `reviewed_by` fields when information is not found in existing files (rather than using default values)

---

*Last Updated: 2026-01-09*
