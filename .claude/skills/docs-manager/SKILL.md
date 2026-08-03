---
name: "docs-manager"
description: "Automatically manages bugs, tasks, documentation, and reports in the .agents/ folder following project conventions. Activates when creating bug reports, documenting features, tracking tasks, generating reports, audits, researches, analyses, updating existing documentation, or organizing work in the established .agents workflow structure."
---

# Documentation Manager

Automatically manages bugs, tasks, documentation, and reports in the `.agents/` folder following project conventions and established workflow patterns.

## Description

This skill automates the creation, updating, and organization of documentation files in the `.agents/` folder structure following the established workflow from `agents-workflow.md`. It handles bugs, tasks, feature documentation, and reports (including audits, researches, and analyses) with appropriate templates, naming conventions, and folder organization.

**Use this skill when the user mentions:**
- Creating bug reports, tracking issues, documenting problems, debugging
- Creating tasks, planning features, tracking work, implementation planning
- Creating documentation, documenting features, explaining architecture
- Creating reports, audits, researches, analyses, investigations, assessments
- Updating or organizing existing issues (bugs/tasks)/docs/reports
- Moving completed work between folders (.open/.deferred/.done/.archived)
- Following the established .agents workflow

**Automatically triggers on phrases like:**
- "create a doc...
- "create a bug report..."
- "create a task..."
- "create a report..."
- "create an audit..."
- "audit..."
- "generate an audit..."
- "perform audit..."
- "conduct audit..."
- "security audit..."
- "code audit..."
- "document this research..."
- "analyze this..."
- "investigate..."
- "assess..."
- "document this feature..."
- "track this task..."
- "file this issue..."
- "add to .agents..."
- "move to .done..."
- "update the bug report..."
- "update the doc..."
- "update the task..."
- "update the report..."
- "update the audit..."

## Skill Coordination

This skill focuses on **document creation and content management** within the `.agents` folder structure. For folder structure changes and system integration, the `agents-folder-manager` skill handles infrastructure modifications.

**Coordination with agents-folder-manager:**
- Relies on existing folder structure for document placement
- May request folder structure changes for new content types
- Benefits from folder manager's template updates when new folders are added

## Core Capabilities

### 1. Bug Report Management
- Creates detailed bug reports in `.agents/issues/` (frontmatter `type: bug`)
- Follows established template with symptoms, root cause, solution
- Uses kebab-case naming: `feature-specific-bug-description.md`
- Includes required AI-generated warning
- Automatically moves to `.agents/issues/.done/` once the fix has been verified

### 2. Task Creation & Management
- Creates comprehensive task files in `.agents/issues/` (frontmatter `type: task`)
- Follows complexity-based templates (Trivial/Low/Medium/High/Critical)
- Includes proper status tracking, file references, verification steps
- Updates existing tasks with current codebase state
- Manages task lifecycle: **open** (`.open/`) → **in-progress** (root of `issues/`) → **on-hold** (root of `issues/`) → **done** (`.done/`)

### 3. Documentation Creation
- Creates feature documentation in `.agents/docs/features/`
- Follows architectural documentation patterns
- Includes integration details, technical decisions, limitations
- Cross-references related documentation and components

### 4. Report Management
- Creates reports, audits, researches, and analyses in `.agents/reports/`
- Supports various report types: security audits, feature assessments, research findings
- Follows structured reporting templates with executive summaries
- Includes methodology, findings, recommendations, and action items
- Cross-references with related tasks, bugs, and documentation

### 5. Index Automation
- **Automatically runs update-index.py** after any file operation
- **Executes yarn scan-docs** for comprehensive project documentation sync
- Maintains synchronized INDEX.md reflecting current .agents state
- Handles file moves between folders (.open, .deferred, .done, .archived)
- Updates cross-references and directory organization
- Preserves numeric ordering and proper categorization

### 6. Workflow Integration
- Respects folder structure: issues/, docs/, reports/ — issues/ uses .open/.deferred/.done/.archived subfolders
- Maintains consistent naming conventions and templates
- Preserves completed work and implementation notes
- Updates cross-references and maintains documentation index

## Instructions

When the user requests documentation management, follow this workflow:

**Prerequisites**: If the `.agents/` folder does not exist in the project, prompt the user to run `/init-agents` first before creating any documents.

**🔄 IMPORTANT**: Always run the index update script after any file operation to keep INDEX.md synchronized with the current state of the .agents directory.

### Step 1: Determine Document Type
Analyze the request to identify:
- **Bug Report**: Error conditions, unexpected behavior, debugging needed
- **Task**: Implementation work, feature development, specific changes needed
- **Documentation**: Architecture, feature explanation, technical guidance
- **Report**: Audits, research findings, analysis results, assessments, investigations

### Step 2: Apply Appropriate Template

**IMPORTANT**:
- Never include time estimates or schedules in tasks (e.g., "1 hour", "1 day", "30 minutes"). Tasks will primarily be completed by AI agents which work much faster than human estimates. Use complexity levels only: Trivial, Low, Medium, High, Critical.
- For complex tasks (Medium/High/Critical), Claude should first review the entire .agents folder context including INDEX.md, AGENTS.md, agents-workflow.md, existing tasks, and related documentation to understand established patterns and avoid duplicating solutions.
- Do NOT automatically launch specialized review agents after creating documents. Only run agent reviews if the user explicitly requests it.

**Status System** (applies to all file types):
- **`open`**: Not started yet, ready to work on (**ALWAYS the default for new tasks/bugs**)
- **`in-progress`**: **ONLY** when actively implementing a task right now, or when a task was partially implemented
- **`on-hold`**: Blocked by external factors, waiting on dependencies, or paused due to technical blockers that prevent full implementation
- **`done`**: Completed, fixed, or finalized (default for documentation and reports)
- **`archived`**: Task/bug is no longer relevant, superseded, or abandoned (only for files in `.archived/` folders)

**IMPORTANT - Task Status Rules:**
- When **creating** a new task → ALWAYS use `status: open`
- When **actively working** on implementation → change to `status: in-progress`
- When **blocked** (missing dependencies, external blockers, can't complete fully) → use `status: on-hold`
- When **completed** → use `status: done` and move to `.done/` folder
- When **archiving** (no longer relevant, superseded, abandoned) → use `status: archived` and move to `.archived/` folder
- **Never** create a new task with `status: in-progress` unless you are immediately implementing it
- **Never** move a `type: bug` issue to `.done/` unless the fix has been **verified**. If you can test the fix yourself (e.g., TypeScript compiles, lint passes, unit tests pass), do so and then mark it done. If verification requires manual/browser/runtime testing you cannot perform, provide the user with specific test instructions and only mark it done after they confirm the fix works. This rule is keyed on the frontmatter `type:`, not on the folder.
- **Note**: You rarely need to set `archived` status unless explicitly asked to archive a task/bug

**Complexity System** (tasks only):
- **`low`**: Simple changes, 1-2 files, clear solution
- **`medium`**: Moderate complexity, multiple files, some design decisions
- **`high`**: Complex feature, many files, significant architectural decisions
- **`very-high`**: Critical infrastructure changes, system-wide impact, major refactoring

**Priority System** (bugs only):
- **`low`**: Minor issue, workaround available, low impact
- **`medium`**: Moderate impact, affects some users, should be fixed soon
- **`high`**: Significant impact, affects many users, needs prompt attention
- **`critical`**: Severe impact, breaks core functionality, immediate fix required

**Note**: Documentation and report files should use `status: done` since they represent finalized documentation and completed analysis/audit reports.

**Folder-Based Status Rules** (CRITICAL):
Bugs and tasks both live in `.agents/issues/`. Which one an item is lives ONLY in its `type: bug` / `type: task` frontmatter — NEVER in its folder path. Setting `type:` is mandatory on every issue. The folder IS the source of truth for `status:` — when moving files between folders, the status MUST be updated to match the folder's purpose:

- **Root of `issues/`** (being worked on right now):
  - Update `status: in-progress` (or `status: on-hold` if blocked)
  - Should stay short — most new issues start in `.open/`, not here

- **Moving to `.open/` folder** (not started, or an unfixed bug nobody is on):
  - Update `status: open`

- **Moving to `.deferred/` folder** (consciously postponed):
  - Update `status: deferred`
  - Update `updated` date to current date

- **Moving to `.done/` folder** (completed tasks and fixed bugs):
  - Update `status: done`
  - Update `updated` date to current date
  - For `type: bug` issues, only after the fix has been **verified** (see rule above)

- **Moving to `.archived/` folder** (tasks or bugs — obsolete, cancelled, invalid, won't-fix):
  - Update `status: archived`
  - Update `updated` date to current date
  - Archived items are no longer relevant, superseded, or abandoned but preserved for reference

**Epic subfolders**: A large issue with many sub-issues gets its own named folder under `issues/` (e.g. `issues/quorum-shared-migration/`), behaving as a miniature issues tree with its own `.open/`, `.done/`, `.archived/`. It sits at the root of `issues/` while in progress, and moves inside `.done/` when the whole epic is finished.

**Default Status by Location**:
- Files at the root of `issues/` → `status: in-progress` (or `on-hold` if blocked) — root should stay short
- Files in `.open/` → `status: open`
- Files in `.deferred/` → `status: deferred`
- Files in `.done/` → `status: done`
- Files in `.archived/` → `status: archived`
- Files in docs folders → `status: done`

#### For Bug Reports (`.agents/issues/`):
```markdown
---
type: bug
title: "[Clear Bug Description]"
status: open
priority: medium
ai_generated: true
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# [Clear Bug Description]

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms
[What goes wrong - observable behavior]

## Root Cause
[Why it happens - technical analysis]

## Solution
[How it was fixed - specific changes made]
- File changes: `src/path/to/file.ts:123`
- Key insight: [what made the difference]

## Prevention
[How to avoid in future - patterns/practices]
```

#### For Tasks (`.agents/issues/`):
Use complexity-appropriate template:

**Low Complexity:**
```markdown
---
type: task
title: "[Action-Oriented Title]"
status: open
complexity: low
ai_generated: true
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# [Action-Oriented Title]

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/path/to/file.ts:123`

## What & Why
[2-3 sentences: current state → desired state → value]

## Implementation
1. **Update component** (`src/path/file.tsx:45`)
   - Specific change description
   - Reference: Follow pattern from `existing-file.tsx:123`

2. **Add type definition** (`src/types/Type.ts:67`)
   - Add interface property
   - Export type

## Verification
✅ **Feature works as expected**
   - Test: [specific action] → [expected result]

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

## Definition of Done
- [ ] All implementation complete
- [ ] TypeScript passes
- [ ] Manual testing successful
- [ ] No console errors
```

**Medium Complexity:**
```markdown
---
type: task
title: "[Feature Title]"
status: open
complexity: medium
ai_generated: true
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_docs: []    # Add if applicable
related_tasks: []   # Add if applicable
---

# [Feature Title]

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/path/to/file.ts:123`
- `src/path/to/other-file.ts:45`

## What & Why
[Detailed description: current state → desired state → value delivered]

## Context
- **Existing pattern**: [reference similar implementation]
- **Constraints**: [technical limitations to consider]

## Implementation

### Phase 1: [Core Changes]
1. **[Specific task]** (`src/path/file.tsx:123`)
   - Change description
   - Reference: Follow pattern from `existing-file.tsx:123`

2. **[Related task]** (`src/path/other.ts:45`)
   - Change description

### Phase 2: [Integration & Polish]
1. **[Integration task]** (`src/path/file.tsx:200`)
   - Wire up with existing components
   - Update imports and exports

## Verification
✅ **Feature works as expected**
   - Test: [specific action] → [expected result]

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **No regressions**
   - Test: [existing functionality still works]

## Definition of Done
- [ ] All phases complete
- [ ] TypeScript passes
- [ ] Manual testing successful
- [ ] No console errors
- [ ] Related docs updated if needed
```

**High Complexity:**
```markdown
---
type: task
title: "[Complex Feature Title]"
status: open
complexity: high
ai_generated: true
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_issues: []  # Add if applicable, e.g., ["#14", "#15"]
related_docs: []    # Add if applicable
related_tasks: []   # Add if applicable
---

# [Complex Feature Title]

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files**: [list of all affected files with line numbers]

## What & Why
[Detailed description with technical value]

## Context
- **Existing pattern**: [reference similar implementation]
- **Constraints**: [technical limitations]
- **Dependencies**: [prerequisites]

## Prerequisites
- [ ] Review .agents documentation: INDEX.md, AGENTS.md, and agents-workflow.md for context
- [ ] Check existing issues in .agents/issues/ for similar patterns and solutions
- [ ] Review related documentation in .agents/docs/ for architectural context
- [ ] [Required setup/dependencies]
- [ ] Branch created from `develop`
- [ ] No conflicting PRs

## Implementation

### Phase 1: Core Logic
- [ ] **[Specific task]** (`file.tsx:123`)
  - Done when: [observable completion signal]
  - Verify: [specific test]
  - Reference: [existing pattern to follow]

### Phase 2: Integration (requires Phase 1)
- [ ] **[Next task]** (`file.tsx:456`)
  - Done when: [completion criteria]
  - Verify: [verification method]

## Verification
✅ **[Critical functionality]**
   - Test: [step-by-step test]
✅ **TypeScript compiles**
✅ **Mobile compatible**
✅ **Edge cases handled**

## Definition of Done
- [ ] All phases complete
- [ ] All verification tests pass
- [ ] No console errors
- [ ] Task updated with learnings
```

#### For Documentation (`.agents/docs/features/`):

**CRITICAL DISTINCTION - Documentation vs Tasks**:
- **Documentation** describes the **current state** of a feature - what it IS and how it WORKS
- **Tasks** track implementation progress - status, phases, checklists, what needs to be DONE

**Documentation files MUST NOT include**:
- ❌ "Feature Status" or "Implementation Status" sections with phases
- ❌ "Verification Checklist" or "Definition of Done" sections
- ❌ Implementation history language ("we added", "we fixed", "was implemented", "changes made")
- ❌ Phase tracking ("Phase 1 complete", "Phase 2 pending")
- ❌ Changelog-style entries or implementation notes
- ❌ Status indicators (Pending, In Progress, Complete)

**Documentation files SHOULD**:
- ✅ Describe features in present tense as they currently exist
- ✅ Explain architecture, data flow, and integration points
- ✅ Include usage examples and code snippets
- ✅ Document technical decisions and their rationale
- ✅ List known limitations and their impact
- ✅ Reference related documentation and components

```markdown
---
type: doc
title: "[Feature Name]"
status: done
ai_generated: true
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_docs: []    # Add if applicable
related_tasks: []   # Add if applicable
---

# [Feature Name]

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview
[What the feature does and why it exists - written as current state, not history]

## Architecture
[Technical implementation details - describe how it works NOW]
- **Key components**: List main files/classes with line references
- **Data flow**: How information moves through system
- **Integration points**: How it connects to other features

## Usage Examples
[Code examples showing how to use the feature]

## Technical Decisions
[Rationale for key architectural choices - explain WHY, not WHEN]
- **[Decision 1]**: Rationale and trade-offs
- **[Decision 2]**: Alternative approaches considered

## Known Limitations
[Current constraints and their impact]
- [Limitation 1]: Impact and potential workarounds
- [Limitation 2]: Design trade-offs accepted

## Related Documentation
- [Cross-references to other relevant docs]
- [Links to API references]
- [Related tasks or bugs]
```

#### For Reports (`.agents/reports/`):
```markdown
---
type: report
title: "[Report Title]"
ai_generated: true
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_tasks: []  # Add if applicable
related_docs: []   # Add if applicable
---

# [Report Title]

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary
[Brief overview of key findings and recommendations]

## Scope & Methodology
- **Scope**: [What was analyzed/investigated]
- **Methodology**: [How the analysis was conducted]
- **Tools/Approaches**: [Specific methods or tools used]
- **Timeframe**: [When analysis was conducted]

## Findings
### [Finding Category 1]
- **Issue**: [Description of what was found]
- **Impact**: [Severity/importance level]
- **Evidence**: [Supporting details, file locations, examples]

### [Finding Category 2]
- **Issue**: [Description]
- **Impact**: [Level of concern]
- **Evidence**: [Supporting information]

## Recommendations
### High Priority
1. **[Action Item 1]**
   - **Why**: [Justification]
   - **How**: [Implementation approach]
   - **Files**: `src/path/to/file.ts:123`

2. **[Action Item 2]**
   - **Why**: [Reasoning]
   - **How**: [Steps needed]

### Medium/Low Priority
- [Less critical recommendations]

## Action Items
- [ ] **[Specific task]** - Assigned to: [who] - Due: [when]
- [ ] **[Follow-up task]** - Priority: [level]

## Related Documentation
- [Links to related tasks, bugs, documentation]
- [Cross-references to relevant code or features]

## Appendix
[Supporting data, detailed logs, additional context]

---

_Created: YYYY-MM-DD_
_Report Type: [Audit/Research/Analysis/Assessment]_
```

### Step 3: File Placement and Naming
- **All files**: Always prefix with the creation date: `YYYY-MM-DD-feature-specific-descriptive-name.md`
  - Use today's actual date (e.g., `2026-03-10-modal-zindex-stacking-issue.md`)
  - Follow the date with a kebab-case descriptive name
  - This applies to bugs, tasks, docs, and reports — no exceptions
- Place in appropriate folder:
  - New/not-started issues (bugs or tasks): `.agents/issues/.open/`
  - Issues being worked on right now: root of `.agents/issues/`
  - Postponed issues: `.agents/issues/.deferred/`
  - Completed tasks and fixed bugs: `.agents/issues/.done/`
  - Feature docs: `.agents/docs/features/`
  - Reports/audits: `.agents/reports/`
  - Completed reports: `.agents/reports/.done/`
  - Archived issues: `.agents/issues/.archived/`

### Step 4: Cross-Reference Management
- Add references to related documentation
- Update existing docs that reference this item
- Maintain bidirectional links where appropriate
- Reference specific file:line locations when relevant

### Step 5: Lifecycle Management

**CRITICAL - Keep Tasks in Sync While Working:**

When actively implementing a task, the task file is the **source of truth** for progress. It must stay current so that future sessions (or post-compaction context) can pick up exactly where you left off.

**Use `task-sync.py`** for all task file updates during implementation. This script performs edits deterministically, avoiding markdown corruption or wrong-line matches:

```bash
TASK=".agents/issues/my-task.md"
SYNC="$HOME/.config/.claude/skills/docs-manager/task-sync.py"

# After completing a step:
python "$SYNC" "$TASK" check "Add login endpoint"

# When starting work:
python "$SYNC" "$TASK" status in-progress

# When something unexpected happens:
python "$SYNC" "$TASK" note "bcrypt unavailable in edge, switched to @noble/hashes"

# At session start or after compaction — see what's left:
python "$SYNC" "$TASK" summary

# Before ending a session — check for stale references:
python "$SYNC" "$TASK" validate-paths
```

**Commands reference:**
| Command | What it does |
|---|---|
| `check "text"` | Finds `- [ ]` line containing text, flips to `- [x]`. Errors on 0 or multiple matches. |
| `uncheck "text"` | Reverse of check |
| `status <value>` | Updates frontmatter `status` and `updated` date. Valid: open, in-progress, on-hold, done, archived |
| `note "message"` | Appends timestamped entry to `## Updates` section (creates it if missing) |
| `remaining` | Shows all unchecked items with section context and progress count |
| `validate-paths` | Checks if backtick file references (e.g. \`src/file.ts:42\`) exist |
| `summary` | Status + progress bar + remaining items — ideal for session start |

**When to call task-sync.py:**
- **After each implementation step** — `check` the completed box immediately, don't batch
- **When deviating from the plan** — `note` what actually happened vs. what was planned
- **When starting work on a task** — `status in-progress`
- **When blocked** — `status on-hold` + `note` describing the blocker
- **At session start or after compaction** — `summary` to see current state
- **Before ending a session** — `validate-paths` + `remaining` to capture what's left

**For Task Updates (using task-update.md pattern):**
1. **Read and verify** - Check all file paths exist, note current status
2. **Update autonomously** - Fix line numbers, update code examples, clarify steps
3. **Flag (don't change)** - Scope changes, conflicts, status changes to Complete
4. **Never change** - Checked checkboxes, Implementation Notes, original "What & Why"
5. **Document changes** - Add to Updates section with timestamp

**For Status Changes:**
- Moving a bug or task to `.done/` when complete (fix verified for bugs) → **MUST update `status: done`**
- Moving files to `.archived/` folders → **MUST update `status: archived`**
- Archiving outdated documentation
- Updating cross-references when files move
- **ALWAYS update the `updated` date when changing status**

### Step 6: Index Management
**CRITICAL: Always update the .agents index after any file operation**

After creating, editing, moving, renaming, or deleting any bug report, task, or documentation file:

1. **Run the index update script**:
   ```bash
   # The script lives in the global skills folder:
   python "$HOME/.config/.claude/skills/docs-manager/update-index.py"
   ```

2. **Verify the INDEX.md was updated**:
   - Check that new files appear in the index
   - Verify that moved files show in correct sections
   - Confirm deleted files are removed from index

**When to run the index update script**:
- ✅ After creating any new .md file in .agents/
- ✅ After moving files between folders (.open, .deferred, .done, .archived)
- ✅ After renaming any .md file in .agents/
- ✅ After deleting any .md file in .agents/
- ✅ After editing titles (# headings) in existing files

The script automatically:
- Scans all .md files in .agents/ directory
- Extracts titles from first # heading
- Organizes by folder structure (docs → issues → reports)
- Maintains proper subfolder groupings
- Updates "Last Updated" timestamp
- Handles numeric prefixes for ordering (01-file.md, 02-file.md)

### Step 7: Commit Guidelines
- Create descriptive commit message following project conventions
- Never mention "Claude" or "Anthropic" in commit messages
- Focus on the "why" rather than the "what"
- Use established commit message patterns from project

## Examples

### Bug Report Example
**User says**: "There's an issue with the modal stacking order"

**Skill response**: Creates `.agents/issues/.open/2026-03-10-modal-zindex-stacking-issue.md` with proper template, analyzes the z-index conflict, documents the CSS fix needed, and includes prevention strategies.

### Task Creation Example
**User says**: "I need to implement user authentication"

**Skill response**: Creates `.agents/issues/.open/2026-03-10-user-authentication.md` with High complexity template, breaks down into phases (setup, UI components, backend integration), includes verification steps for security testing.

### Documentation Example
**User says**: "Document the new search feature we just built"

**Skill response**: Creates `.agents/docs/features/2026-03-10-search-feature.md` describing the search feature as it currently exists - architecture, integration with MessageDB, performance characteristics, and usage examples. Uses present tense throughout ("The search feature provides...", "Messages are indexed using...") - NOT implementation history ("We added...", "Phase 1 implemented..."). Does NOT include status sections, verification checklists, or phase tracking.

### Report Creation Example
**User says**: "Create a security audit of our authentication system"

**Skill response**: Creates `.agents/reports/2026-03-10-auth-security-audit.md` with structured audit template, analyzes authentication flows, identifies potential vulnerabilities, provides actionable recommendations with priority levels, and includes specific file references and remediation steps.

### Task Update Example
**User says**: "Update the authentication task - some file paths have changed"

**Skill response**: Reads existing task, verifies current file locations, updates outdated paths and line numbers, adds discovered edge cases, documents changes in Updates section. Then runs the index update script to reflect any title changes in INDEX.md.

### Index Update Example
**User says**: "Move the completed auth task to the .done folder"

**Skill response**:
1. Moves `.agents/issues/2026-03-10-user-authentication.md` to `.agents/issues/.done/2026-03-10-user-authentication.md`
2. Runs the index update script: `python3 update-index.py`
   - Updates INDEX.md with new file location
3. Verifies the task now appears under "✅ Completed Issues" instead of "🐛📋 Issues" in INDEX.md
4. Reports successful completion

## Workflow Integration

This skill automates what you would do manually following `agents-workflow.md`: respects established patterns, maintains folder structure and naming conventions, preserves manual work, cross-references properly, and keeps the index synchronized.

## Utility Scripts

### YAML Frontmatter Migration (`add-yaml-frontmatter.cjs`)

Adds YAML frontmatter metadata to markdown files in `.agents/` folder.

**When to use:**
- Migrating new documentation categories
- Adding new frontmatter fields to existing files
- Backfilling metadata

**Usage:**
```bash
# Preview changes
node "$HOME/.config/.claude/skills/docs-manager/add-yaml-frontmatter.cjs" --dry-run

# Apply changes
node "$HOME/.config/.claude/skills/docs-manager/add-yaml-frontmatter.cjs" --apply
```

**What it extracts:**
- Type (from folder), Title (from H1), Status (from content/folder)
- Dates (from content/filesystem), AI-generated flag, Related issues

**Safety:** Always run `--dry-run` first. Skips files with existing frontmatter.

---

_Updated: 2026-08-03_