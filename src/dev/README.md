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
**Purpose**: Interactive frontend for browsing project documentation, issues, and reports

- Browse all documentation files from `.agents/docs/`
- Browse issues — bugs and tasks together — from `.agents/issues/`, filtered by
  type, state and priority. State comes from the folder an issue sits in
  (`.open/`, `.deferred/`, `.done/`, `.archived/`, or the root for in-progress),
  not from its `status:` field, which routinely goes stale when a file is refiled
- Browse reports and audits from `.agents/reports/` (security audits, research, analysis)
- Features search functionality and categorization

The file list is a build artifact: run `yarn scan-docs` after adding or moving
markdown under `.agents/`, or the viewer keeps showing the previous tree. The
scan also reports any file whose YAML frontmatter fails to parse — those render
without metadata until the YAML is fixed.
- Full markdown rendering with syntax highlighting
- Organized by folder structure (e.g., mobile-dev/docs, features/primitives)

### 🎮 Primitives Playground

**Path**: `PrimitivesPlayground.tsx`  
**Access**: `/dev/playground` route during development  
**Purpose**: Interactive testing environment for cross-platform UI primitives

- Test all primitive components (Button, Input, Modal, Flex, etc.)
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

### 🗄️ DB Inspector

**Path**: `db-inspector/`
**Access**: `/dev/db-inspector` route during development
**Purpose**: Browse IndexedDB contents with automatic redaction of sensitive data

- `DbInspector.tsx` - Visual UI for browsing all database stores
- `dbDumpUtil.ts` - Core dump logic with security redaction
- Shows record counts for every store found in the database
- Click any store to browse its records (with sensitive data redacted)
- Copy buttons to export safe JSON for debugging
- Console commands: `__dbDump()`, `__dbCounts()`, `__dbStore(name)`, `__dbInfo()`

**Schema drift is designed out** (it used to break the tool on every schema bump):
- The version and the store list are read from the live database at runtime via
  `openQuorumDb()` — nothing about the schema is hardcoded here
- Never open `quorum_db` with an explicit version from a dev tool: IndexedDB
  throws `VersionError` when the requested version is lower than the stored one,
  which is exactly what a stale constant produces
- A store present in the DB but not classified in `dbDumpUtil.ts` is fully
  redacted and flagged in the UI, so new stores fail closed rather than leaking
- `src/dev/tests/db/dbInspectorCoverage.test.ts` fails CI if a store is added to
  `messages.ts` without being classified, or if the tool lists one that no longer exists
- The header warns when the live DB version differs from `QUORUM_DB_VERSION`
  (`src/db/dbVersion.ts`), which is the branch-switching gotcha in
  `.agents/docs/quorum-db-schema.md`

**Security Features**:
- Private keys show as `[REDACTED:64chars]`
- Public keys show truncated (first 8 + last 4 chars)
- Encryption states show as `[ENCRYPTED_STATE:Xbytes]`
- Private user notes and serialized search indices are redacted
- Safe to use with real accounts

### 🧭 Page Shell — start here when adding a tool

**Path**: `shell/`
**Purpose**: The layout contract every dev page follows, so they stop drifting apart

```tsx
<DevPage width="standard">        {/* narrow | standard | wide | full */}
  <DevPageHeader icon="bug" title="My Tool" subtitle="What it measures" />
  …
</DevPage>
```

- `DevPage` — app background, always-sticky nav, one of four named width tiers.
  Pick a tier; do not invent a `max-w-*`.
- `DevPageHeader` — icon, title, subtitle, optional right-aligned `actions`.
- `DevStat` — a labelled number, block-level by construction, with a semantic
  `tone` (`good | bad | warn | neutral`).
- `DevPageLoading` — the Suspense fallback while a page's lazy chunk arrives.
- `DevNavMenu` — reads the active route from `useLocation()`. Do not pass
  `currentPath`; the one page that forgot to was the one that never highlighted.

**Two rules for anything added here.** Use `<Link>`, never `<a href>` — an
`<a href>` is a full document navigation that re-bootstraps the whole app and
blanks the screen for over a second. And use plain HTML with Tailwind text
utilities, never the `Text` primitive, which is native-only.

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

Every dev tool lives under `/dev`.

- **`/dev`** - Main development hub
- **`/dev/docs`** - Browse project documentation
- **`/dev/issues`** - Bugs and tasks, filterable by type, state and priority
- **`/dev/reports`** - Security audits, research and analysis reports
- **`/dev/playground`** - Interactive primitives testing environment
- **`/dev/audit`** - Component audit (obsolete — see the notice on the page)
- **`/dev/db-inspector`** - IndexedDB browser with redacted sensitive data
- **`/dev/dm-doctor`** - DM-loss sequence scan and receive-path counters
- **`/dev/identity-coverage`** - How many people render as a truncated address
- **`/dev/fake-qns`** - Synthesize .q names without owning one
- **`/dev/error-states`** - What a user sees when a view fails to load

## Notes

- **Production Excluded**: `web/vite.config.ts` marks `/src/dev/` external in
  production builds. Anything under `src/dev/` referenced from a production file
  must therefore go through `lazyDevImport` — a static import would emit an
  unresolvable bare import into the production bundle.
- **Live Sync**: the playground uses the shared primitives directly, so it is
  always current.

---

_Last updated: 2026-08-12_
