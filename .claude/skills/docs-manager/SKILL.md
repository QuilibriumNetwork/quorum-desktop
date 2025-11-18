---
name: "docs-manager"
description: "Automatically manages bugs, tasks, and documentation in the .agents/ folder following project conventions. Activates when creating bug reports, documenting features, tracking tasks, updating existing documentation, or organizing work in the established .agents workflow structure."
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "TodoWrite", "Bash"]
---

# Documentation Manager

Automatically manages bugs, tasks, and documentation in the `.agents/` folder following project conventions and established workflow patterns.

## Description

This skill automates the creation, updating, and organization of documentation files in the `.agents/` folder structure following the established workflow from `agents-workflow.md`. It handles bugs, tasks, and feature documentation with appropriate templates, naming conventions, and folder organization.

**Use this skill when the user mentions:**
- Creating bug reports, tracking issues, documenting problems, debugging
- Creating tasks, planning features, tracking work, implementation planning
- Creating documentation, documenting features, explaining architecture
- Updating or organizing existing bugs/tasks/docs
- Moving completed work between folders (.done/.solved/.archived)
- Following the established .agents workflow

**Automatically triggers on phrases like:**
- "create a doc...
- "create a bug report..."
- "create a task..."
- "document this feature..."
- "track this task..."
- "file this issue..."
- "add to .agents..."
- "move to .done..."
- "update the bug report..."
- "update the doc..."
- "update the task..."

## Core Capabilities

### 1. Bug Report Management
- Creates detailed bug reports in `.agents/bugs/`
- Follows established template with symptoms, root cause, solution
- Uses kebab-case naming: `feature-specific-bug-description.md`
- Includes required AI-generated warning
- Automatically moves to `.solved/` when bug is fixed

### 2. Task Creation & Management
- Creates comprehensive task files in `.agents/tasks/`
- Follows complexity-based templates (Trivial/Low/Medium/High/Critical)
- Includes proper status tracking, file references, verification steps
- Updates existing tasks with current codebase state
- Manages task lifecycle from Pending → In Progress → Complete

### 3. Documentation Creation
- Creates feature documentation in `.agents/docs/features/`
- Follows architectural documentation patterns
- Includes integration details, technical decisions, limitations
- Cross-references related documentation and components

### 4. Index Automation
- **Automatically runs update-index.py** after any file operation
- **Executes yarn scan-docs** for comprehensive project documentation sync
- Maintains synchronized INDEX.md reflecting current .agents state
- Handles file moves between folders (.done, .solved, .archived)
- Updates cross-references and directory organization
- Preserves numeric ordering and proper categorization

### 5. Workflow Integration
- Respects folder structure: bugs/, tasks/, docs/ with .done/.solved/.archived subfolders
- Maintains consistent naming conventions and templates
- Preserves completed work and implementation notes
- Updates cross-references and maintains documentation index

## Instructions

When the user requests documentation management, follow this workflow:

**🔄 IMPORTANT**: Always run the index update script after any file operation to keep INDEX.md synchronized with the current state of the .agents directory.

### Step 1: Determine Document Type
Analyze the request to identify:
- **Bug Report**: Error conditions, unexpected behavior, debugging needed
- **Task**: Implementation work, feature development, specific changes needed
- **Documentation**: Architecture, feature explanation, technical guidance

### Step 2: Apply Appropriate Template

**IMPORTANT**:
- Never include time estimates or schedules in tasks (e.g., "1 hour", "1 day", "30 minutes"). Tasks will primarily be completed by AI agents which work much faster than human estimates. Use complexity levels only: Trivial, Low, Medium, High, Critical.
- For complex tasks (Medium/High/Critical), Claude should first review the entire .agents folder context including INDEX.md, AGENTS.md, agents-workflow.md, existing tasks, and related documentation to understand established patterns and avoid duplicating solutions.
- Complex tasks (Medium/High/Critical complexity) should always be analyzed by the feature-analyzer agent before implementation to avoid over-engineering and ensure best practices.
- Tasks involving security considerations (authentication, encryption, user data, network communications, permissions) should be analyzed by the security-analyst agent before implementation.

**Agent Review Notation**:
- **Initially**: Create documents with only the basic AI warning: `> **⚠️ AI-Generated**: May contain errors. Verify before use.`
- **After specialized agent review**: Add the review line: `> **Reviewed by**: [agent-name] agent`
- **Common reviewing agents**:
  - `feature-analyzer` - for implementation quality, best practices, over-engineering analysis
  - `security-analyst` - for security implications, vulnerabilities, privacy concerns
  - `frontend-style-validator` - for React component styling and cross-platform compliance
  - Other specialized agents as appropriate
- **Only add review notation** after the agent has completed its analysis AND any recommended changes have been implemented

#### For Bug Reports (`.agents/bugs/`):
```markdown
# [Clear Bug Description]

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: [agent-name] agent *(add only after agent review and implementation)*

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

---

_Created: YYYY-MM-DD_
```

#### For Tasks (`.agents/tasks/`):
Use complexity-appropriate template:

**Low Complexity:**
```markdown
# [Action-Oriented Title]

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: [agent-name] agent *(add only after agent review and implementation)*

**Status**: Pending
**Complexity**: Low
**Created**: YYYY-MM-DD
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

**High Complexity:**
```markdown
# [Complex Feature Title]

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: [agent-name] agent *(add only after agent review and implementation)*

**Status**: Pending
**Complexity**: High
**Created**: YYYY-MM-DD
**Files**: [list of all affected files with line numbers]

## What & Why
[Detailed description with technical value]

## Context
- **Existing pattern**: [reference similar implementation]
- **Constraints**: [technical limitations]
- **Dependencies**: [prerequisites]

## Prerequisites
- [ ] Review .agents documentation: INDEX.md, AGENTS.md, and agents-workflow.md for context
- [ ] Check existing tasks in .agents/tasks/ for similar patterns and solutions
- [ ] Review related documentation in .agents/docs/ for architectural context
- [ ] Feature analyzed by feature-analyzer agent for complexity and best practices
- [ ] Security analysis by security-analyst agent (if task involves auth, crypto, user data, or network operations)
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
```markdown
# [Feature Name]

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: [agent-name] agent *(add only after agent review and implementation)*

## Overview
[What the feature does and why it exists]

## Architecture
[Technical implementation details]
- **Key components**: List main files/classes
- **Data flow**: How information moves through system
- **Integration points**: How it connects to other features

## Usage Examples
[Code examples showing how to use the feature]

## Technical Decisions
- **[Decision 1]**: Rationale and trade-offs
- **[Decision 2]**: Alternative approaches considered

## Known Limitations
- [Limitation 1]: Impact and potential solutions
- [Limitation 2]: Workarounds if any

## Related Documentation
- [Cross-references to other relevant docs]
- [Links to API references]
- [Related tasks or bugs]

---

_Created: YYYY-MM-DD_
```

### Step 3: File Placement and Naming
- Use kebab-case: `feature-specific-descriptive-name.md`
- Place in appropriate folder:
  - Active bugs: `.agents/bugs/`
  - Solved bugs: `.agents/bugs/.solved/`
  - Active tasks: `.agents/tasks/`
  - Completed tasks: `.agents/tasks/.done/`
  - Feature docs: `.agents/docs/features/`
  - Archived items: respective `.archived/` folders

### Step 4: Cross-Reference Management
- Add references to related documentation
- Update existing docs that reference this item
- Maintain bidirectional links where appropriate
- Reference specific file:line locations when relevant

### Step 5: Lifecycle Management

**For Task Updates (using task-update.md pattern):**
1. **Read and verify** - Check all file paths exist, note current status
2. **Update autonomously** - Fix line numbers, update code examples, clarify steps
3. **Flag (don't change)** - Scope changes, conflicts, status changes to Complete
4. **Never change** - Checked checkboxes, Implementation Notes, original "What & Why"
5. **Document changes** - Add to Updates section with timestamp

**For Status Changes:**
- Moving bugs to `.solved/` when fixed
- Moving tasks to `.done/` when complete
- Archiving outdated documentation
- Updating cross-references when files move

### Step 6: Agent Review Integration
When creating or updating documents that would benefit from specialized review:

1. **Create initial document** with basic AI warning
2. **Identify review needs**:
   - Complex tasks (Medium/High/Critical) → `feature-analyzer` agent
   - Security-related content → `security-analyst` agent
   - Frontend components → `frontend-style-validator` agent
3. **Launch appropriate specialized agent** using Task tool
4. **Implement agent recommendations** in the document
5. **Add review notation** to document header: `> **Reviewed by**: [agent-name] agent`
6. **Update index** to reflect any changes

### Step 7: Index Management
**CRITICAL: Always update the .agents index after any file operation**

After creating, editing, moving, renaming, or deleting any bug report, task, or documentation file:

1. **Run the index update script**:
   ```bash
   python3 /mnt/d/GitHub/Quilibrium/quorum-desktop/.claude/skills/docs-manager/update-index.py
   ```

2. **Verify the INDEX.md was updated**:
   - Check that new files appear in the index
   - Verify that moved files show in correct sections
   - Confirm deleted files are removed from index

**When to run the index update script**:
- ✅ After creating any new .md file in .agents/
- ✅ After moving files between folders (.done, .solved, .archived)
- ✅ After renaming any .md file in .agents/
- ✅ After deleting any .md file in .agents/
- ✅ After editing titles (# headings) in existing files

The script automatically:
- **Runs yarn scan-docs** to sync project-wide documentation scanning
- Scans all .md files in .agents/ directory
- Extracts titles from first # heading
- Organizes by folder structure (docs → bugs → tasks)
- Maintains proper subfolder groupings
- Updates "Last Updated" timestamp
- Handles numeric prefixes for ordering (01-file.md, 02-file.md)

### Step 8: Commit Guidelines
- Create descriptive commit message following project conventions
- Never mention "Claude" or "Anthropic" in commit messages
- Focus on the "why" rather than the "what"
- Use established commit message patterns from project

## Examples

### Bug Report Example
**User says**: "There's an issue with the modal stacking order"

**Skill response**: Creates `.agents/bugs/modal-zindex-stacking-issue.md` with proper template, analyzes the z-index conflict, documents the CSS fix needed, and includes prevention strategies.

### Task Creation Example
**User says**: "I need to implement user authentication"

**Skill response**: Creates `.agents/tasks/user-authentication.md` with High complexity template, breaks down into phases (setup, UI components, backend integration), includes verification steps for security testing.

### Documentation Example
**User says**: "Document the new search feature we just built"

**Skill response**: Creates `.agents/docs/features/search-feature.md` explaining the search architecture, integration with MessageDB, performance optimizations, and usage examples.

### Task Update Example
**User says**: "Update the authentication task - some file paths have changed"

**Skill response**: Reads existing task, verifies current file locations, updates outdated paths and line numbers, adds discovered edge cases, documents changes in Updates section. Then runs the index update script to reflect any title changes in INDEX.md.

### Index Update Example
**User says**: "Move the completed auth task to the .done folder"

**Skill response**:
1. Moves `.agents/tasks/user-authentication.md` to `.agents/tasks/.done/user-authentication.md`
2. Runs the comprehensive update script: `python3 update-index.py`
   - Executes `yarn scan-docs` for project-wide documentation sync
   - Updates INDEX.md with new file location
3. Verifies the task now appears under "📋 Completed Tasks" instead of "📋 Tasks" in INDEX.md
4. Reports successful completion with full documentation synchronization

### Agent Review Workflow Examples

#### Example 1: Security-Critical Task
**User says**: "Create a task for implementing end-to-end encryption"

**Initial creation**:
```markdown
# Implement End-to-End Encryption

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: Critical
```

**After security-analyst review and implementation**:
```markdown
# Implement End-to-End Encryption

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: security-analyst agent

**Status**: Pending
**Complexity**: Critical
```

#### Example 2: Complex Feature Analysis
**User says**: "Document the new modal system we built"

**After feature-analyzer review**:
```markdown
# Modal System Architecture

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

## Overview
[Documentation refined based on agent analysis...]
```

#### Example 3: Frontend Component Validation
**User says**: "Create task for new cross-platform Button component"

**After frontend-style-validator review**:
```markdown
# Cross-Platform Button Component

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: frontend-style-validator agent

**Status**: Pending
**Complexity**: Medium
```

## Workflow Integration

This skill integrates seamlessly with your existing workflow:

1. **Respects established patterns** from `agents-workflow.md`
2. **Uses existing templates** enhanced with automation
3. **Maintains folder structure** and naming conventions
4. **Preserves manual work** - never overwrites completed sections
5. **Cross-references properly** - links to related docs and code
6. **Follows commit guidelines** - proper messages, no AI mentions
7. **Updates systematically** - tracks changes and maintains history
8. **🆕 Comprehensive documentation sync** - runs both yarn scan-docs and update-index.py for complete project-wide synchronization
9. **🆕 Quality assurance through agent reviews** - integrates specialized agents for enhanced quality and best practices

The skill essentially automates what you would do manually following your `agents-workflow.md`, but with intelligent context awareness, consistent application of your established patterns, **comprehensive documentation synchronization** (both project-wide and .agents-specific), and **integrated quality reviews by specialized agents** to ensure the entire documentation ecosystem is well-maintained and synchronized.

---

_Updated: 2025-11-16_