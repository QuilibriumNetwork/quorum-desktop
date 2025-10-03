# Development Tools

Comprehensive development suite for building and managing cross-platform components in the Quorum desktop application.

## Contents

### 🏠 Development Hub

**Path**: `DevMainPage.tsx`  
**Access**: `/dev` route during development  
**Purpose**: Central hub providing access to all development tools

- Navigation to all development interfaces
- Overview of available tools and their purposes
- Quick access to playground, audit, dependency analysis, and documentation viewer

### 📖 Documentation Viewer

**Path**: `docs/` folder  
**Access**: `/dev` route during development  
**Purpose**: Interactive frontend for browsing project documentation, tasks, and bug reports

- Browse all documentation files from `.readme/docs/`
- View task management files from `.readme/tasks/` (pending, ongoing, completed)
- Access bug reports from `.readme/bugs/` (active and solved)
- Features search functionality and categorization
- Full markdown rendering with syntax highlighting
- Organized by folder structure (e.g., mobile-dev/docs, features/primitives)

### 🎮 Primitives Playground

**Path**: `PrimitivesPlayground.tsx`  
**Access**: `/playground` route during development  
**Purpose**: Interactive testing environment for cross-platform UI primitives

- Test all primitive components (Button, Input, Modal, Container, Flex, etc.)
- Complete color system showcase with CSS variables
- Theme switching (light/dark) and accent color testing
- Real-time prop testing and visual validation
- Mobile-responsive component testing

### 🔍 Component Audit

**Path**: `components-audit/ComponentAuditViewer.tsx`  
**Access**: `/dev/audit` route during development  
**Purpose**: Comprehensive component analysis and mobile readiness tracking

- `ComponentAuditViewer.tsx` - Interactive web interface for component status
- `audit.json` - Complete metadata for all 64 components
- `update_audit.py` - Python script to regenerate audit data
- Mobile readiness tracking and progress statistics

### 🗺️ Dependency Map

**Path**: `components-audit/DependencyMapViewer.tsx`  
**Access**: `/dev/dependencies` route during development  
**Purpose**: Visual roadmap for mobile component development strategy

- `DependencyMapViewer.tsx` - Interactive dependency visualization
- `dependency-map.json` - 6-level component hierarchy analysis
- `mobile-roadmap.md` - Phase-by-phase mobile development plan
- Build order recommendations (Level 0 primitives → Level 5 complex components)

### 🧭 Navigation System

**Path**: `DevNavMenu.tsx`
**Purpose**: Consistent navigation across all development tools

- Unified navigation bar for all dev interfaces
- Active page highlighting and smooth transitions
- Sticky positioning for easy tool switching

### 🧪 Test Suite

**Path**: `tests/` folder
**Purpose**: Comprehensive unit test suite for MessageDB service refactoring

- 75 unit tests across 6 services (MessageService, SpaceService, InvitationService, SyncService, EncryptionService, ConfigService)
- 100% passing with ~10 second runtime
- Uses vi.fn() mocks to validate service behavior
- See `tests/README.md` for detailed documentation and test descriptions

## Usage

All development tools are automatically available during development:

```bash
yarn dev
```

### Development Routes

- **`/dev`** - Main development hub with tool overview and documentation viewer
- **`/playground`** - Interactive primitives testing environment
- **`/dev/audit`** - Component audit and mobile readiness tracker
- **`/dev/dependencies`** - Visual dependency map and mobile roadmap

## Notes

- **Cross-Platform Ready**: All tools support the mobile/web shared architecture
- **Production Excluded**: Dev tools are automatically excluded from production builds
- **Live Sync**: Web playground uses shared components directly (always current)

---

_Last updated: 2025-10-03_
