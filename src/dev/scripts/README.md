# Development Scripts

[← Back to INDEX](.readme/INDEX.md)

This directory contains Node.js scripts for managing the mobile playground's primitive component synchronization.

## Scripts Overview

### 🔄 playground-sync.js
**Purpose**: Synchronizes primitive components between the main app and mobile playground.

**Key Features**:
- Bidirectional sync with smart Lingui-aware comparison
- Interactive mode for selective syncing
- Automatic backup creation with cleanup
- Dry-run mode for preview

**Example Commands**:
```bash
# Sync newer files automatically (recommended)
yarn playground:sync --sync-newer --all

# Copy all components from main app to playground
yarn playground:sync --to-playground --all

# Copy specific components from playground to main app
yarn playground:sync --from-playground Button Modal

# Interactive mode - choose direction for each component
yarn playground:sync --interactive

# Preview changes without modifying files
yarn playground:sync --sync-newer --all --dry-run

# Force sync Lingui-equivalent files
yarn playground:sync --sync-newer --all --force-lingui
```

### 🔍 playground-check-sync.js
**Purpose**: Checks synchronization status between main app and mobile playground primitives.

**Key Features**:
- Lingui-aware file comparison
- Detailed out-of-sync file reporting
- Component-by-component status overview
- Exit code 1 if components are out of sync (CI-friendly)

**Example Commands**:
```bash
# Check sync status of all components
yarn playground:check

# Use in CI/scripts (exits with code 1 if out of sync)
if ! yarn playground:check; then
  echo "Components are out of sync!"
  exit 1
fi
```

### 🧹 playground-cleanup-backups.js
**Purpose**: Cleans up backup files created during component synchronization.

**Key Features**:
- Selective cleanup by age
- Size reporting and space recovery calculation
- Dry-run mode for preview
- Component-grouped file listing

**Example Commands**:
```bash
# Delete all backup files
yarn playground:cleanup --all

# Delete backups older than 7 days (default)
yarn playground:cleanup --older

# Delete backups older than 3 days
yarn playground:cleanup --older 3

# Preview cleanup without deleting
yarn playground:cleanup --all --dry-run
```

## Architecture Notes

- **Web Playground**: Imports directly from main app components (no sync needed)
- **Mobile Playground**: Requires sync due to React Native's separate component implementations
- **Lingui Awareness**: Scripts recognize when files differ only in internationalization approach
- **Routing Files**: Architectural differences (index.ts, Component.tsx) are automatically skipped

## Common Workflows

1. **After modifying main app primitives**:
   ```bash
   yarn playground:sync --to-playground --all
   ```

2. **After testing changes in mobile playground**:
   ```bash
   yarn playground:sync --from-playground ComponentName
   ```

3. **Regular maintenance**:
   ```bash
   yarn playground:check
   yarn playground:cleanup --older 7
   ```

---

*Updated: 2025-01-04*