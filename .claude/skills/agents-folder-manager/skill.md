---
name: agents-folder-manager
description: "Automatically manages .agents folder infrastructure including adding, removing, renaming folders and subfolders. Handles complete integration across docs-manager skill, indexing systems, dev web UI, routing, and status detection with validation and error recovery."
---

# .agents Folder Infrastructure Manager

Automatically manages the complete `.agents` folder infrastructure with full integration across all systems: docs-manager skill, indexing, dev web UI, routing, and status detection.

## Auto-Activation Triggers

This skill automatically activates when you mention:

**Folder Management:**
- "add/create new folder to .agents"
- "remove/delete .agents folder"
- "rename .agents folder"
- "manage .agents structure"
- "restructure documentation folders"

**Specific Operations:**
- "create analyses folder"
- "add reports directory"
- "remove bugs folder"
- "rename tasks to work-items"
- "add .pending subfolder"
- "create .reviewed status folder"

**System Integration:**
- "update .agents infrastructure"
- "integrate new documentation folder"
- "fix .agents folder structure"

## Skill Coordination

This skill focuses on **folder structure and system integration**. For document creation within folders, the `docs-manager` skill handles content and templates.

**Coordination with docs-manager:**
- After creating new folders, may suggest updating docs-manager templates
- Validates that folder changes don't break docs-manager workflows
- Ensures new folder types are added to docs-manager if needed

## Core Capabilities

### 1. **Structure Analysis & Validation**
- Scans current `.agents` folder structure
- Identifies existing folders, subfolders, and status systems
- Validates current integration state across all systems
- Detects potential conflicts or dependencies
- Reports current state and readiness for changes

### 2. **Automated Folder Operations**
- **ADD**: Creates new top-level folders with complete integration
- **REMOVE**: Safely removes folders with backup and cleanup
- **RENAME**: Renames folders while preserving all content
- **SUBFOLDER**: Adds/removes status subfolders with migration support
- **VALIDATE**: Checks and repairs existing integrations

### 3. **Complete System Integration**
Automatically updates all required systems:
- docs-manager skill configuration and templates
- Index generation scripts (both copies)
- Dev web UI navigation and components
- Routing configuration and lazy imports
- Status detection and TypeScript types
- File scanning and JSON generation
- Workflow documentation updates

### 4. **Safety & Validation**
- Pre-operation validation and conflict detection
- Automatic backup creation before destructive operations
- Step-by-step progress reporting with rollback capability
- Icon existence verification before UI updates
- TypeScript compilation validation
- End-to-end integration testing

### 5. **Interactive Workflow**
- Asks clarifying questions for ambiguous requests
- Shows preview of changes before execution
- Requests confirmation for destructive operations
- Provides real-time progress updates
- Suggests optimal folder structures and naming

## Execution Workflow

### Phase 1: Analysis & Planning
1. **Scan Current Structure**
   - Analyze `.agents` folder hierarchy
   - Identify existing integrations
   - Check system health and consistency

2. **Understand Request**
   - Parse user intent (add/remove/rename/subfolder)
   - Identify target folder and desired changes
   - Detect any special requirements

3. **Validate Feasibility**
   - Check for conflicts or dependencies
   - Verify required files exist
   - Validate naming conventions
   - Assess impact scope

4. **Create Execution Plan**
   - Generate step-by-step plan
   - Identify all files that need updates
   - Plan backup and rollback strategy
   - Estimate completion time and complexity

### Phase 2: User Confirmation
1. **Present Analysis**
   - Show current state vs desired state
   - List all files that will be modified
   - Explain potential risks and mitigations

2. **Request Confirmation**
   - Get user approval for the plan
   - Confirm destructive operations
   - Allow plan modifications if needed

3. **Pre-Operation Setup**
   - Create backups of critical files
   - Prepare rollback procedures
   - Initialize progress tracking

### Phase 3: Execution
1. **File System Operations**
   - Create/remove/rename physical folders
   - Handle file migrations for subfolders
   - Preserve all existing content

2. **Integration Updates** (in dependency order)
   - Update docs-manager skill templates and triggers
   - **Suggest docs-manager template updates** if new content types are needed
   - Modify index generation scripts
   - Update dev navigation and routing
   - Create/modify dev web components
   - Update TypeScript types and status detection
   - Update workflow documentation

3. **Regeneration & Testing**
   - Run file scanning to update JSON
   - Regenerate INDEX.md
   - Test TypeScript compilation
   - Validate dev interface functionality

### Phase 4: Validation & Reporting
1. **Integration Testing**
   - Test skill trigger words
   - Verify navigation works
   - Check file scanning includes new structure
   - Validate status detection accuracy
   - Test INDEX.md generation

2. **Error Detection & Recovery**
   - Identify any broken integrations
   - Fix common issues automatically
   - Rollback if critical errors occur
   - Provide specific error resolution guidance

3. **Completion Report**
   - Summarize all changes made
   - Report any issues encountered
   - Provide next steps if needed
   - Update timestamps across all files

## Smart Features

### **Context-Aware Suggestions**
- Suggests appropriate folder names based on content
- Recommends optimal subfolder structures
- Proposes icon selections from existing available icons
- Advises on naming conventions and consistency

### **Dependency Management**
- Understands file dependencies across systems
- Updates files in correct order to avoid breaks
- Handles circular dependencies gracefully
- Manages TypeScript type propagation

### **Error Prevention & Recovery**
- Validates icon names before using them
- Checks TypeScript compatibility before changes
- Tests route configurations before deployment
- Provides automatic rollback on critical failures

### **Performance Optimization**
- Batches file operations efficiently
- Minimizes script regeneration cycles
- Validates changes incrementally
- Reports progress for long operations

## Examples

### Example 1: Add New Folder
**User**: "Add a new 'analyses' folder to .agents for research analysis reports"

**Skill Response**:
```
🔍 Analyzing current .agents structure...
✅ Found: docs/, tasks/, bugs/, reports/
✅ Validated: All integrations healthy

📋 Plan: Add 'analyses' folder with .archive subfolder
├── Update docs-manager skill (templates & triggers)
├── Add to index scripts and regenerate INDEX.md
├── Create dev navigation item and component
├── Add routing and status detection
└── Update all documentation

⚠️  Will modify 12 files. Create backups? [Y/n]

🔧 Executing changes...
✅ Created .agents/analyses/ and .agents/analyses/.archive/
✅ Updated docs-manager skill with analysis templates
✅ Added 'clipboard-check' icon to navigation
✅ Created dev component with analysis-specific UI
✅ Updated routing and status detection
✅ Regenerated INDEX.md and file scanning

🎉 Success! Analyses folder fully integrated.
📍 Access via: /dev/analyses
🎯 Trigger words: "create analysis", "analyze", "research"
```

### Example 2: Rename Folder
**User**: "Rename 'bugs' folder to 'issues' to match our workflow"

**Skill Response**:
```
🔍 Analyzing 'bugs' folder...
✅ Found 47 files across subfolders (.done, .archived)
✅ Detected integrations: docs-manager, dev UI, routing

⚠️  RENAME OPERATION - Will preserve all content
├── Rename .agents/legacy-notes/ → .agents/decisions/
├── Update all 47 existing file references
├── Modify docs-manager templates (bugs→issues)
├── Update dev navigation and component
├── Change routing from /dev/bugs to /dev/issues
└── Regenerate all indexes and documentation

💾 Backup created: .agents-backup-2025-11-19/
🔄 Estimated time: 2-3 minutes

Proceed with rename? [Y/n]

🔧 Renaming folder and updating integrations...
✅ Renamed folder preserving all 47 files
✅ Updated docs-manager: bug reports → issue reports
✅ Updated dev UI: /dev/issues (with bug icon)
✅ Updated routing and TypeScript types
✅ Regenerated INDEX.md with Issues section

🎉 Successfully renamed bugs → issues!
📍 New access: /dev/issues
🎯 New triggers: "create issue", "issue report"
```

### Example 3: Add Subfolder
**User**: "Add .pending subfolder to reports for reports under review"

**Skill Response**:
```
🔍 Analyzing reports folder structure...
✅ Current: reports/ and reports/.archive/
✅ Request: Add reports/.pending/ subfolder

📋 Changes needed:
├── Create .agents/reports/.pending/
├── Update status detection: pending → 'under-review'
├── Add 'Pending Review' section to Reports UI
├── Update docs-manager workflow examples
└── Regenerate INDEX.md

🔧 Implementing .pending subfolder...
✅ Created .agents/reports/.pending/
✅ Updated useMarkdownFiles.ts status detection
✅ Added collapsible "Pending Review" section
✅ Updated skill file placement examples
✅ Regenerated indexes

🎉 Added .pending subfolder to reports!
📝 Usage: Move reports to .agents/reports/.pending/
🎯 Status: Shows as "Under Review" in dev UI
```

## Error Handling Examples

### Missing Icon Recovery
```
⚠️  Icon 'document-report' not found in codebase
🔍 Searching for similar icons...
✅ Found alternatives: clipboard, file-text, document
🤖 Recommendation: Using 'clipboard' (matches tasks pattern)
```

### TypeScript Error Recovery
```
❌ TypeScript compilation failed after adding 'analyses' type
🔍 Analyzing error: Property 'analyses' missing from union type
🔧 Auto-fixing: Adding 'analyses' to all required type definitions
✅ TypeScript compilation successful
```

### Integration Validation Failure
```
❌ Dev component not loading at /dev/analyses
🔍 Checking routing configuration...
🐛 Found: Import path mismatch in Router.web.tsx
🔧 Fixing: Updated import path to match actual file location
✅ Component now loading correctly
```

## Configuration Options

The skill can be configured via additional parameters:

```markdown
**Naming Preferences:**
- Folder naming: kebab-case, camelCase, or snake_case
- Status subfolder prefix: . (dot) or _ (underscore)
- Date format: YYYY-MM-DD or MM-DD-YYYY

**Icon Selection:**
- Auto-select from available icons
- Prompt for icon choice
- Use existing icon mappings

**Backup Strategy:**
- Always backup (default)
- Prompt before backup
- Skip backup (dangerous)

**Validation Level:**
- Minimal (basic checks)
- Standard (recommended)
- Comprehensive (full testing)
```

## Integration Health Monitor

The skill can also be invoked to check and repair existing integrations:

**Trigger**: "check .agents integration health"

**Capabilities:**
- Validates all folders have complete integration
- Identifies missing or broken components
- Detects inconsistencies between systems
- Repairs common integration issues
- Reports system health status

---

*Created: 2025-11-19*
*Scope: Complete .agents infrastructure management*
*Systems: docs-manager, indexing, dev UI, routing, status detection*