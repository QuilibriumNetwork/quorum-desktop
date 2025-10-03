# Docusaurus Developer Documentation Blueprint

**Created**: 2025-10-03
**Objective**: Create developer-centric documentation that enables developers to understand, extend, and build on top of Quorum's decentralized messenger platform

https://github.com/QuilibriumNetwork/quorum-desktop/issues/87

---

## Repository Structure Recommendation

**Recommendation: Keep Docusaurus in the same repository** (`/docs` folder)

**Why this is industry standard:**
- Next.js, React, Vue, and most modern frameworks keep docs with code
- "Docs as Code" philosophy - docs updated in same PR as features
- Version sync guaranteed - docs version matches code version
- CI can validate code examples against actual implementation
- Single source of truth - prevents docs from drifting out of sync
- **Perfect for AI agents** - can read code + docs simultaneously for validation

**Benefits for Quorum:**
- AI can auto-update docs when code changes
- Contributors update docs alongside features in same PR
- Existing 33 docs in `.readme/docs` already internal
- Cross-platform architecture requires tight code-docs coupling
- Small team - no need for separate docs repo/team

**Proposed structure:**
```
quorum-desktop/
├── src/           # App code
├── web/           # Web specific
├── mobile/        # Mobile specific
├── docs/          # Docusaurus documentation site
│   ├── docs/     # Markdown files
│   ├── src/      # Docusaurus React components
│   └── docusaurus.config.js
└── .readme/      # Internal development docs (migrate to docs/)
```

---

## Table of Contents

1. [Repository Structure Recommendation](#repository-structure-recommendation)
2. [Philosophy & Approach](#philosophy--approach)
3. [Target Developer Personas](#target-developer-personas)
4. [Optimal Documentation Structure](#optimal-documentation-structure)
5. [Developer Journey Mapping](#developer-journey-mapping)
6. [Bot Development & Extensibility](#bot-development--extensibility)
7. [Cryptocurrency & Wallet Features](#cryptocurrency--wallet-features)
8. [Content Mapping from Existing Docs](#content-mapping-from-existing-docs)
9. [Implementation Strategy](#implementation-strategy)

---

## Philosophy & Approach

**Core Principle**: Answer three developer questions:
1. How does this work?
2. How do I build with this?
3. How do I contribute?

**Structure** (Diátaxis Framework):
- **Tutorials**: Learning-oriented
- **How-To Guides**: Task-oriented
- **Reference**: API docs and data models
- **Explanation**: Architecture and design decisions

**Key Principles**:
- Organized by developer needs, not file structure
- Progressive disclosure: quick wins first
- Every concept includes runnable code examples

---

## Target Developer Personas

**Open Source Contributor**: Fix bugs, add features
- Needs: Quick setup, architecture overview, component docs, testing guides

**Integration Developer**: Build bots and external tools
- Needs: API reference, WebSocket docs, message protocol, auth guides

**Platform Extender**: Build crypto wallets, plugins, new features
- Needs: Extension architecture, service APIs, storage patterns, crypto integration

**Mobile/Cross-Platform Developer**: Contribute to mobile app
- Needs: Cross-platform architecture, primitives docs, mobile setup, React Native patterns

---

## Optimal Documentation Structure

```
📖 Quorum Developer Docs
│
├── 🚀 Quick Start
│   ├── 5-Minute Quickstart
│   ├── Development Environment Setup
│   ├── Your First Contribution
│   └── Running Tests & Debugging
│
├── 💡 Core Concepts
│   ├── What is Quorum?
│   ├── Architecture Overview
│   ├── Decentralized Messaging Fundamentals
│   ├── Privacy & Encryption Model
│   ├── Cross-Platform Strategy
│   └── Technology Stack
│
├── 🏗️ System Architecture
│   ├── High-Level Architecture
│   ├── Data Flow & State Management
│   ├── Service-Oriented Architecture
│   │   ├── Service Layer Overview
│   │   ├── MessageService Deep Dive
│   │   ├── SpaceService Deep Dive
│   │   ├── EncryptionService Deep Dive
│   │   ├── SyncService Deep Dive
│   │   └── Other Services
│   ├── Storage Architecture
│   │   ├── IndexedDB Schema
│   │   ├── MessageDB Orchestrator
│   │   └── Data Persistence Patterns
│   ├── Real-Time Communication
│   │   ├── WebSocket Architecture
│   │   ├── Message Protocol
│   │   └── Event System
│   └── Security Architecture
│       ├── End-to-End Encryption
│       ├── Key Management
│       └── Message Signing & Verification
│
├── 🎨 UI Architecture (Cross-Platform)
│   ├── Cross-Platform UI Philosophy
│   ├── Primitive Component System
│   │   ├── What Are Primitives?
│   │   ├── Available Primitives (Quick Ref)
│   │   ├── Building New Primitives
│   │   ├── Web Implementation (Tailwind)
│   │   └── Native Implementation (StyleSheet)
│   ├── Business Components
│   │   ├── Component Architecture
│   │   ├── Modal System
│   │   ├── Navigation System
│   │   └── Message Components
│   ├── Theming & Styling
│   │   ├── Theme System
│   │   ├── Responsive Design
│   │   └── Cross-Platform Styling Guide
│   └── Platform-Specific UI
│       ├── Web/Electron UI
│       ├── Mobile (React Native) UI
│       └── Platform Detection & Adaptation
│
├── 🔧 Development Guides
│   ├── Contributing to Quorum
│   │   ├── Contribution Guidelines
│   │   ├── Code Style & Standards
│   │   ├── Git Workflow
│   │   ├── Pull Request Process
│   │   └── Code Review Guidelines
│   ├── Building Features
│   │   ├── Adding a New Feature (Step-by-Step)
│   │   ├── Creating Cross-Platform Components
│   │   ├── Working with Hooks
│   │   ├── Service Layer Development
│   │   └── State Management Patterns
│   ├── Testing & Quality
│   │   ├── Testing Philosophy
│   │   ├── Unit Testing Guide
│   │   ├── Component Testing
│   │   ├── Integration Testing
│   │   └── Development Playgrounds
│   ├── Mobile Development
│   │   ├── Mobile Setup Guide
│   │   ├── Expo Dev Client
│   │   ├── Platform Differences
│   │   ├── Touch Interactions
│   │   └── Mobile-Specific Features
│   └── Debugging & Troubleshooting
│       ├── Common Development Issues
│       ├── React Hooks Best Practices
│       ├── WSL/Windows Development
│       ├── Mobile Debugging
│       └── Performance Debugging
│
├── 🤖 Building with Quorum
│   ├── Bot Development
│   │   ├── Bot Architecture Overview
│   │   ├── Authentication for Bots
│   │   ├── Sending Messages Programmatically
│   │   ├── Listening to Events
│   │   ├── Bot Examples
│   │   │   ├── Simple Echo Bot
│   │   │   ├── Notification Bot
│   │   │   ├── Moderation Bot
│   │   │   └── Integration Bot (External APIs)
│   │   └── Bot Deployment Guide
│   ├── External Integrations
│   │   ├── REST API Integration
│   │   ├── WebSocket Integration
│   │   ├── Webhook Setup
│   │   └── Third-Party Service Integration
│   ├── Custom Clients
│   │   ├── Building a Custom Client
│   │   ├── Client Authentication
│   │   ├── Message Protocol Implementation
│   │   └── Example: CLI Client
│   └── Extensions & Plugins
│       ├── Extension Architecture
│       ├── Creating Custom Services
│       ├── Hook Development
│       └── Plugin Examples
│
├── 💰 Cryptocurrency Features
│   ├── Crypto Architecture Overview
│   ├── Wallet Features
│   │   ├── Account/Wallet Creation
│   │   ├── Key Management & Security
│   │   ├── Multi-Signature Wallets
│   │   ├── Wallet Backup & Recovery
│   │   └── HD Wallet Support
│   ├── Transactions
│   │   ├── Sending Cryptocurrency
│   │   ├── Receiving Payments
│   │   ├── Transaction History
│   │   ├── Gas/Fee Management
│   │   └── Transaction Signing
│   ├── In-App Payments
│   │   ├── Peer-to-Peer Payments
│   │   ├── Payment Requests
│   │   ├── Payment Notifications
│   │   └── Payment UI Components
│   ├── Smart Contract Integration
│   │   ├── Contract Interaction
│   │   ├── Token Support (ERC20, etc.)
│   │   └── Custom Contract Integration
│   └── Blockchain Integration
│       ├── Quilibrium Network Integration
│       ├── Node Communication
│       ├── Network Selection
│       └── Chain Data Synchronization
│
├── 📚 API Reference
│   ├── Services API
│   │   ├── MessageService API
│   │   ├── SpaceService API
│   │   ├── EncryptionService API
│   │   ├── SyncService API
│   │   ├── InvitationService API
│   │   ├── SearchService API
│   │   ├── ConfigService API
│   │   └── NotificationService API
│   ├── Hooks Reference
│   │   ├── Business Hooks
│   │   │   ├── Space Hooks
│   │   │   ├── Channel Hooks
│   │   │   ├── Message Hooks
│   │   │   ├── User Hooks
│   │   │   └── Search Hooks
│   │   ├── Query Hooks (TanStack Query)
│   │   ├── Mutation Hooks
│   │   └── UI Hooks
│   ├── Components Reference
│   │   ├── Primitive Components
│   │   └── Business Components
│   ├── Utilities Reference
│   │   ├── Platform Utilities
│   │   ├── Crypto Utilities
│   │   ├── Image Processing
│   │   └── Helper Functions
│   ├── Data Models
│   │   ├── Message Types
│   │   ├── Space & Channel Models
│   │   ├── User Models
│   │   └── Conversation Models
│   └── REST API
│       ├── Authentication Endpoints
│       ├── Space Endpoints
│       ├── Message Endpoints
│       ├── User Endpoints
│       └── Webhook Endpoints
│
├── 🌐 Protocol & Specifications
│   ├── Message Protocol Specification
│   ├── WebSocket Protocol
│   ├── Encryption Protocol
│   ├── Signature Scheme
│   └── Data Format Specifications
│
├── 🎓 Tutorials
│   ├── Tutorial: Build Your First Feature
│   ├── Tutorial: Create a Custom Primitive
│   ├── Tutorial: Build a Message Bot
│   ├── Tutorial: Implement a Crypto Wallet Feature
│   ├── Tutorial: Add Cross-Platform Support to a Component
│   └── Tutorial: Optimize Performance
│
└── 📋 Resources
    ├── Glossary
    ├── FAQ
    ├── Changelog
    ├── Roadmap
    ├── Community & Support
    └── External Resources
```

---

## Developer Journey Examples

**First-Time Contributor**: Setup → Understand architecture → Pick first issue → Submit PR

**Bot Developer**: Understand platform → Follow bot tutorial → Build & deploy

**Crypto Feature Developer**: Learn architecture → Study crypto docs → Implement feature

**Mobile Developer**: Learn cross-platform architecture → Study primitives → Build mobile feature

---

## Bot Development & Extensibility

**Note**: Bot API design is still being finalized. This section provides a framework for future implementation.

### Planned Bot Documentation

**Bot Architecture**:
- Bot concepts and capabilities
- Authentication model
- Event system
- API reference

**Bot Development Guides**:
- Getting started tutorial
- Common bot patterns
- Deployment options

**Example Use Cases** (placeholder):
- Automated notifications
- Moderation tools
- External service integrations
- Custom commands

---

## Cryptocurrency & Wallet Features

**Note**: Cryptocurrency integration design is still being finalized. This section provides a framework for future implementation.

### Planned Crypto Documentation

**Architecture & Integration**:
- Quilibrium network integration
- Wallet system architecture
- Key management and security
- Transaction flow

**Wallet Features** (planned):
- Account/wallet creation
- Key backup and recovery
- Multi-signature support 

**Transaction Features** (planned):
- Sending and receiving
- Transaction history
- Fee management
- Transaction signing

**In-App Payment Features** (planned):
- Peer-to-peer payments in chat
- Payment requests
- Payment UI components

**Smart Contract Integration** (if applicable):
- Contract interaction patterns
- Token support

**Security Guidelines**:
- Key management best practices
- Transaction security
- User education

---

## Content Mapping from Existing Docs

### Mapping Strategy

**Principle**: Existing docs are source material, not the organizational structure

**Process**:
1. Identify developer use case
2. Find optimal location in new structure
3. Extract relevant content from existing docs
4. Rewrite/restructure for developer audience
5. Add code examples and practical guides

### High-Priority Mappings

#### Quick Start Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `quick-start/5-minute-quickstart.md` | README.md (Setup section) | **Create**: Condensed, copy-paste friendly setup |
| `quick-start/development-environment.md` | README.md + CLAUDE.md | **Combine**: Detailed environment setup |
| `quick-start/your-first-contribution.md` | None (new) | **Create**: Step-by-step first issue guide |
| `quick-start/running-tests.md` | tasks/test-suite-plan.md | **Extract**: Testing setup basics |

#### Core Concepts Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `core-concepts/what-is-quorum.md` | README.md | **Extract**: Introduction section |
| `core-concepts/architecture-overview.md` | docs/cross-platform-repository-implementation.md | **Adapt**: High-level architecture |
| `core-concepts/cross-platform-strategy.md` | docs/cross-platform-components-guide.md | **Extract**: Core concepts section |
| `core-concepts/technology-stack.md` | package.json + README.md | **Create**: Tech stack overview |

#### System Architecture Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `system-architecture/service-oriented-architecture.md` | docs/data-management-architecture-guide.md | **Extract**: Service layer section |
| `system-architecture/storage-architecture/*.md` | docs/data-management-architecture-guide.md | **Split**: Into focused docs |
| `system-architecture/real-time-communication/*.md` | docs/data-management-architecture-guide.md | **Extract**: WebSocket section |
| `system-architecture/security-architecture/*.md` | docs/features/messages/message-signing-system.md | **Expand**: Security overview |

#### UI Architecture Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `ui-architecture/primitive-component-system/*.md` | docs/features/primitives/*.md (all 5 docs) | **Restructure**: Keep content, improve organization |
| `ui-architecture/business-components/modal-system.md` | docs/features/modals.md | **Keep**: Already good |
| `ui-architecture/theming-styling/*.md` | docs/features/cross-platform-theming.md + CLAUDE.md | **Combine**: Styling guide |
| `ui-architecture/platform-specific-ui/*.md` | docs/cross-platform-components-guide.md | **Extract**: Platform-specific sections |

#### Development Guides Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `development-guides/contributing/*.md` | None (new) | **Create**: Contribution workflow |
| `development-guides/building-features/*.md` | docs/component-management-guide.md + docs/cross-platform-components-guide.md | **Restructure**: Make task-oriented |
| `development-guides/testing-quality/*.md` | tasks/mobile-dev/docs/primitives-testing.md | **Expand**: Full testing guide |
| `development-guides/mobile-development/*.md` | docs/expo-dev-testing-guide.md + tasks/mobile-dev/*.md | **Consolidate**: Mobile guides |
| `development-guides/debugging/*.md` | bugs/*.md (patterns) | **Create**: Based on common issues |

#### Building with Quorum Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `building-with-quorum/bot-development/*.md` | None (new) | **Create**: Bot development guides |
| `building-with-quorum/external-integrations/*.md` | None (new) | **Create**: Integration guides |
| `building-with-quorum/custom-clients/*.md` | docs/data-management-architecture-guide.md (API section) | **Extract & Expand**: API usage |

#### Cryptocurrency Features Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `cryptocurrency-features/*.md` | None (new) | **Create**: Crypto features documentation |
| References: src/utils/crypto.* | Code analysis | **Document**: Crypto utilities in use |
| References: docs/features/cross-platform-key-backup.md | Existing doc | **Expand**: Key management patterns |

#### API Reference Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `api-reference/services/*.md` | src/services/*.ts (8 services) | **Generate**: From code + JSDoc |
| `api-reference/hooks/*.md` | src/hooks/**/*.ts (205 files) | **Generate**: Hook documentation |
| `api-reference/data-models/*.md` | src/api/baseTypes.ts | **Document**: Type definitions |
| `api-reference/rest-api/*.md` | src/api/quorumApi.ts | **Document**: REST endpoints |

#### Tutorials Section

| New Location | Source Material | Action |
|--------------|----------------|--------|
| `tutorials/build-your-first-feature.md` | None (new) | **Create**: End-to-end feature tutorial |
| `tutorials/create-custom-primitive.md` | docs/features/primitives/*.md | **Extract**: Create tutorial from docs |
| `tutorials/build-message-bot.md` | None (new) | **Create**: Bot tutorial |
| `tutorials/implement-crypto-wallet.md` | None (new) | **Create**: Crypto feature tutorial |

### Complete Mapping of ALL Existing Docs (34 files)

**Every existing doc mapped to new documentation structure:**

#### Core Architecture Docs (6 files)

| Existing Doc | New Location | Action |
|--------------|--------------|--------|
| `component-management-guide.md` | `development-guides/component-development/component-management-guide.md` | Migrate as-is |
| `cross-platform-components-guide.md` | `development-guides/component-development/cross-platform-components.md` | Migrate as-is |
| `cross-platform-repository-implementation.md` | `architecture/cross-platform-strategy.md` | Migrate as-is |
| `data-management-architecture-guide.md` | `architecture/data-management.md` | Migrate & split into sub-docs |
| `expo-dev-testing-guide.md` | `mobile/expo-dev-setup.md` | Migrate as-is |
| `development/unused-dependencies-analysis.md` | *(Internal only - not in public docs)* | Keep in repo, not in docs site |

#### Primitives Documentation (6 files)

| Existing Doc | New Location | Action |
|--------------|--------------|--------|
| `features/primitives/01-introduction-and-concepts.md` | `ui-architecture/primitives/introduction-concepts.md` | Migrate as-is |
| `features/primitives/02-primitives-quick-reference.md` | `ui-architecture/primitives/quick-reference.md` | Migrate as-is |
| `features/primitives/03-when-to-use-primitives.md` | `ui-architecture/primitives/when-to-use.md` | Migrate as-is |
| `features/primitives/04-web-to-native-migration.md` | `ui-architecture/primitives/web-to-native-migration.md` | Migrate as-is |
| `features/primitives/05-primitive-styling-guide.md` | `ui-architecture/primitives/styling-guide.md` | Migrate as-is |
| `features/primitives/INDEX.md` | `ui-architecture/primitives/overview.md` | Rename & update links |

#### Space/Permissions Features (3 files)

| Existing Doc | New Location | Action |
|--------------|--------------|--------|
| `space-permissions/read-only-channels-system.md` | `core-systems/spaces-channels/read-only-channels.md` | Migrate as-is |
| `space-permissions/space-permissions-architecture.md` | `core-systems/spaces-channels/permissions-architecture.md` | Migrate as-is |
| `space-permissions/space-roles-system.md` | `core-systems/spaces-channels/roles-system.md` | Migrate as-is |

#### Message Features (7 files)

| Existing Doc | New Location | Action |
|--------------|--------------|--------|
| `features/messages/client-side-image-compression.md` | `core-systems/messaging/image-compression.md` | Migrate as-is |
| `features/messages/emoji-picker-react-customization.md` | `features/media/emoji-picker.md` | Migrate as-is |
| `features/messages/markdown-renderer.md` | `core-systems/messaging/markdown-renderer.md` | Migrate as-is |
| `features/messages/message-actions-mobile.md` | `mobile/mobile-specific-features.md` (section) | Merge into mobile docs |
| `features/messages/message-signing-system.md` | `core-systems/messaging/message-signing.md` | Migrate as-is |
| `features/messages/pinned-messages.md` | `core-systems/messaging/pinned-messages.md` | Migrate as-is |
| `features/messages/youtube-facade-optimization.md` | `features/media/youtube-facade.md` | Migrate as-is |

#### UI/UX Features (5 files)

| Existing Doc | New Location | Action |
|--------------|--------------|--------|
| `features/modals.md` | `ui-architecture/business-components/modals.md` | Migrate as-is |
| `features/modal-save-overlay.md` | `ui-architecture/business-components/modal-save-overlay.md` | Migrate as-is |
| `features/cross-platform-theming.md` | `ui-architecture/styling/theming-system.md` | Migrate as-is |
| `features/responsive-layout.md` | `ui-architecture/styling/responsive-layout.md` | Migrate as-is |
| `features/reacttooltip-mobile.md` | `mobile/platform-differences.md` (section) | Merge into mobile docs |

#### App Features (7 files)

| Existing Doc | New Location | Action |
|--------------|--------------|--------|
| `features/cross-platform-key-backup.md` | `features/authentication/key-backup.md` | Migrate as-is |
| `features/delete-confirmation-system.md` | `ui-architecture/business-components/delete-confirmation.md` | Migrate as-is |
| `features/desktop-notifications.md` | `features/notifications/desktop-notifications.md` | Migrate as-is |
| `features/invite-system-analysis.md` | `features/invitations/invite-system.md` | Migrate as-is |
| `features/kick-user-system.md` | `features/user-management/kick-user-system.md` | Migrate as-is |
| `features/search-feature.md` | `features/search/search-feature.md` | Migrate as-is |
| `features/touch-long-press-system.md` | `mobile/touch-interactions.md` | Migrate as-is |

**Summary**:
- **33 docs migrate** to public documentation site
- **1 doc remains internal** (unused-dependencies-analysis)
- **100% coverage** - every existing doc has a clear new home

---

### ⚠️ Documentation Review Required

**All existing docs were created via LLM and must be reviewed before migration.**

**Review Process:**
1. **LLM validation** against current codebase (all 33 docs)
2. **Manual review** for critical docs (architecture, security, cross-platform, primitives)
3. Test code examples and verify accuracy

**Priority for manual review:**
- High: Core architecture, security, cross-platform, primitives
- Medium: Message features, mobile, API reference
- Low: UI/UX features, styling guides

### Internal Development Artifacts (NOT in Public Docs)

**Tasks and Bugs remain in GitHub Issues/Projects**, not in the documentation site. However, we extract valuable patterns and solutions:

**From Tasks** → Extract reusable patterns into guides:
- Mobile development patterns → Mobile Development guides
- Styling patterns → Styling Guidelines
- Performance patterns → Performance Optimization tutorials
- Implementation patterns → Generalized "How-To" tutorials

**From Bugs** → Extract solutions into troubleshooting:
- Common React hooks violations → Best Practices guide
- Cross-platform gotchas → Platform Differences guide
- Environment setup issues → Setup troubleshooting
- Performance issues → Debugging guides

**What stays in GitHub Issues:**
- Specific bug reports
- Feature requests
- Task tracking
- Project management
- Roadmap items

---

## Implementation Strategy

Implementation should follow a phased approach, prioritizing content that enables immediate developer contribution.

### Phase 1: Foundation (Critical Priority)
- Docusaurus setup and configuration
- Homepage design (developer-focused)
- Quick Start section (4 docs)
- Core Concepts section (6 docs)
- Navigation structure and search

### Phase 2: Architecture Deep Dive (High Priority)
- System Architecture documentation
- UI Architecture and Primitive Component System
- Migrate and restructure existing architecture docs

### Phase 3: Development Guides (High Priority)
- Contributing guidelines and workflows
- Building Features guides
- Testing & Quality documentation
- Mobile Development guides
- Debugging & Troubleshooting

### Phase 4: Bot Development (Medium-High Priority)
- Bot Architecture Overview
- Bot Development guides
- Bot Examples (8 practical examples)
- Bot API Reference
- External Integrations guides

### Phase 5: Cryptocurrency Features (Medium Priority)
- Crypto Architecture Overview
- Wallet Features documentation
- Transactions and In-App Payments
- Smart Contract Integration
- Blockchain Integration

### Phase 6: API Reference (Medium Priority)
- Services API (8 services)
- Hooks Reference (business, query, mutation, UI)
- Components and Utilities Reference
- Data Models and REST API documentation

### Phase 7: Tutorials & Resources (Low-Medium Priority)
- Hands-on tutorials (6 tutorials)
- Protocol & Specifications
- Resources (glossary, FAQ, changelog)

### Phase 8: Polish & Launch (Critical Priority)
- Internal review and quality assurance
- Fix broken links and validate code examples
- Add architecture diagrams (Mermaid.js)
- SEO optimization
- Production deployment
- Community announcement

---

## Documentation Best Practices

- **Code examples**: Every concept needs runnable code
- **Progressive disclosure**: Quick start → Guide → Deep dive → Reference
- **Plain language**: Simple explanations over jargon
- **Visual aids**: Diagrams for architecture (Mermaid.js)
- **Cross-references**: Link related content
- **Difficulty indicators**: 🟢 Beginner 🟡 Intermediate 🔴 Advanced

---

## Docusaurus Configuration

**Essential Plugins:**
- `@docusaurus/preset-classic` - Core features
- `@docusaurus/theme-mermaid` - Diagrams
- `docusaurus-plugin-typedoc` - API docs from TypeScript
- Algolia DocSearch - Search functionality

**Custom Components:**
- Platform badges (Web/Mobile/Both)
- Difficulty indicators (🟢🟡🔴)
- Code playgrounds

---

## Next Steps

1. Review and approve blueprint
2. Pilot test with 5-10 docs from each section
3. Get feedback from external developers
4. Execute phased implementation
5. Soft launch (internal + selected community)
6. Public launch
7. Iterate based on usage

---

_Document created: 2025-10-03_
_Last updated: 2025-10-03_
