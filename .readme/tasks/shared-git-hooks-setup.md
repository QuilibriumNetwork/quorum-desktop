# Shared Git Hooks Setup



## Overview

Set up shared git hooks directory so all developers get the same npm/yarn conflict protection, not just individual local environments.

## Current Situation

- ✅ **Local protection**: Pre-commit hook exists in `.git/hooks/pre-commit` (local only)
- ✅ **Basic protection**: `package-lock.json` added to `.gitignore`
- ❌ **Team-wide protection**: Other developers don't have the pre-commit hook

## Tasks

### 1. Create Shared Hooks Directory
- [ ] Create `.githooks/` directory in repository root
- [ ] Move current pre-commit hook from `.git/hooks/pre-commit` to `.githooks/pre-commit`
- [ ] Make the shared hook executable (`chmod +x .githooks/pre-commit`)

### 2. Configure Repository
- [ ] Set repository to use shared hooks: `git config core.hooksPath .githooks`
- [ ] Test that shared hook works locally

### 3. Update Documentation
- [ ] Add setup instructions to `CLAUDE.md` in the "CRITICAL: Package Management" section
- [ ] Include command for new developers: `git config core.hooksPath .githooks`
- [ ] Document what the hook does and why it's important

### 4. Team Onboarding
- [ ] Notify existing developers to run: `git config core.hooksPath .githooks`
- [ ] Add to new developer onboarding checklist

## Implementation Details

### Current Hook Logic
The pre-commit hook prevents accidental npm usage by:
- Blocking commits that ADD `package-lock.json` (allows deletions)
- Warning if `package-lock.json` exists in working directory
- Providing helpful error messages about using yarn instead of npm

### Benefits
- **Prevents build breaks**: Stops npm/yarn conflicts before they happen
- **Team consistency**: All developers get same protection
- **Educational**: Shows helpful error messages explaining the issue
- **Non-intrusive**: Only triggers when there's actually a problem

## Priority

**Medium** - This prevents future developer frustration and build issues, but current .gitignore provides basic protection.

---

*Created: 2025-08-10*
