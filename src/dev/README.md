# Development Tools

Development utilities and testing environments for the Quorum cross-platform application.

## Contents

### 🎮 Playground
**Path**: `PrimitivesPlayground.tsx`  
**Access**: `/playground` route during development  
**Purpose**: Interactive testing environment for cross-platform UI primitives

- Test all primitive components (Button, Input, Modal, etc.)
- Theme switching (light/dark) and accent color testing
- Real-time prop testing and visual validation

### 🔍 Component Audit
**Path**: `components-audit/`  
**Access**: `/dev/audit` route during development  
**Purpose**: Automated component analysis and documentation

- `ComponentAuditViewer.tsx` - Web interface for viewing component audit
- `audit.json` - Generated component metadata
- `update_audit.py` - Script to regenerate audit data

### 🧩 Elements
**Path**: `Elements.tsx`  
**Access**: `/elements` route during development  
**Purpose**: Design system showcase and component gallery

## Usage

All development tools are automatically available during development:

```bash
yarn dev
```

Then navigate to:
- `/playground` - Test primitives interactively
- `/dev/audit` - View component documentation 
- `/elements` - Browse design system

## Notes

- Mobile playground was removed - use `/mobile` workspace for mobile testing
- All dev tools are excluded from production builds automatically
- Web playground uses shared components directly (always in sync)

---

*Updated: 2025-08-07*