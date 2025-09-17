# Components Audit Script Documentation

This script (`update_audit.py`) manages the component audit system for tracking the progress of converting components to cross-platform primitives and React Native compatibility.

## Prerequisites

- Python 3.x installed
- Access to the `audit.json` file in the same directory

## Basic Commands

### Single Component Update

Update the status of a single component:

```bash
# Update primitives status
python3 update_audit.py --component "Button" --primitives "done"

# Update native status
python3 update_audit.py --component "Modal" --native "ready"

# Update multiple fields at once
python3 update_audit.py --component "SearchInput" --primitives "done" --native "ready" --notes "Completed conversion"
```

### Bulk Updates

Update multiple components with the same status:

```bash
# Mark multiple components as native done
python3 update_audit.py --bulk-update "Button,Icon,Text" --native "done"

# Update primitives status for multiple components
python3 update_audit.py --bulk-update "Header,Footer,Sidebar" --primitives "partial"
```

## Dependency Management

### Add Dependencies

```bash
# Add new dependencies to a component
python3 update_audit.py --component "Modal" --add-deps "Button,Container,Icon"

# Add single dependency
python3 update_audit.py --component "Form" --add-deps "Input"
```

### Remove Dependencies

```bash
# Remove specific dependencies
python3 update_audit.py --component "Modal" --remove-deps "Icon"
```

### Replace All Dependencies

```bash
# Set exact dependencies (replaces all existing)
python3 update_audit.py --component "Dialog" --set-deps "Button,Text,Container"
```

## Smart Features

### Auto-Detect Changes

Analyze a component and get suggestions for updates:

```bash
# Get suggestions based on current state
python3 update_audit.py --component "SearchInput" --auto-detect
```

### Smart Suggestions

Get detailed analysis and dependency readiness:

```bash
# Show smart analysis with dependency status
python3 update_audit.py --component "Dialog" --suggest
```

## Maintenance Commands

### Recalculate All

Recalculate dependency levels and complexity for all components:

```bash
python3 update_audit.py --recalculate-all
```

### Update Statistics Only

Update statistics without modifying components:

```bash
python3 update_audit.py --stats-only
```

### Validate and Fix

Check JSON structure and optionally fix issues:

```bash
# Validate only
python3 update_audit.py --validate

# Validate and auto-fix issues
python3 update_audit.py --validate --fix
```

## Status Values

### Primitives Status
- `todo` - Not started
- `partial` - In progress
- `done` - Completed

### Logic Extraction Status
- `todo` - Not started
- `in_progress` - Being worked on
- `done` - Completed
- `keep` - Keep as is (no extraction needed)

### Native Status
- `todo` - Not started
- `in_progress` - Being worked on
- `ready` - Ready for native implementation
- `done` - Native implementation complete
- `not_needed` - Not required for native

### Category
- `shared` - Shared component
- `platform_specific` - Platform-specific implementation
- `complex_refactor` - Requires complex refactoring

### Used Status
- `yes` - Currently used
- `no` - Not used
- `unknown` - Usage status unknown
- `suspended` - Temporarily suspended

## Complete Examples

### Full Component Update

```bash
# Complete update with all fields
python3 update_audit.py --component "UserProfile" \
  --primitives "done" \
  --logic_extraction "done" \
  --native "ready" \
  --category "shared" \
  --used "yes" \
  --add-deps "Avatar,Text,Container" \
  --hooks "useUser,useProfile" \
  --notes "Ready for native implementation" \
  --description "User profile display component"
```

### Workflow Example

```bash
# 1. Check component status and get suggestions
python3 update_audit.py --component "Modal" --suggest

# 2. Update component based on work done
python3 update_audit.py --component "Modal" --primitives "done" --add-deps "Portal,Overlay"

# 3. Auto-detect next steps
python3 update_audit.py --component "Modal" --auto-detect

# 4. Mark as ready for native when dependencies are ready
python3 update_audit.py --component "Modal" --native "ready"

# 5. Recalculate all dependency levels
python3 update_audit.py --recalculate-all
```

### Batch Processing

```bash
# Mark a set of basic components as done
python3 update_audit.py --bulk-update "Text,View,Image" --primitives "done" --native "done"

# Update all form components
python3 update_audit.py --bulk-update "Input,TextArea,Select,Checkbox" --category "shared"
```

## Notes

- The script automatically creates daily backups before saving changes
- Dependency levels are automatically calculated based on the dependency graph
- Complexity categories are determined by the number of dependencies:
  - `basic`: 0 dependencies
  - `simple`: 1-3 dependencies
  - `medium`: 4-6 dependencies
  - `complex`: 7+ dependencies
- All updates include an automatic timestamp

## Troubleshooting

If you encounter issues:

1. Check that `audit.json` exists in the same directory
2. Verify Python 3 is installed: `python3 --version`
3. Use `--validate` to check JSON structure
4. Use `--validate --fix` to auto-fix structural issues

---
*Last updated: 2025-09-17*