# .claude Directory Index

This index provides quick access to all documentation, bug reports, and task tracking files in the .claude directory. Use Ctrl+F to search for specific topics or keywords.

**Last Updated**: 2025-07-30

## 📚 Documentation (.claude/docs/)

Comprehensive guides and documentation for various features and components.

### Component Development

- **[component-development-guide.md](docs/component-development-guide.md)**  
  _Guidelines for developing components with mobile-first approach_

- **[cross-platform-components-guide.md](docs/cross-platform-components-guide.md)**  
  _Cross-platform component architecture and implementation guide_

- **[primitive-styling-guide.md](docs/primitive-styling-guide.md)**  
  _🚨 CRITICAL: Form field consistency rules and semantic color usage for all primitives_

### Feature Documentation

- **[desktop-notifications.md](docs/features/desktop-notifications.md)**  
  _Desktop notification system implementation and configuration_

- **[emoji-picker-react-customization.md](docs/features/emoji-picker-react-customization.md)**  
  _Custom emoji picker implementation with responsive design_

- **[invite-system-analysis.md](docs/features/invite-system-analysis.md)**  
  _🔍 COMPREHENSIVE: Complete analysis of invite system architecture, dual key systems, and security implications_

- **[kick-user-system.md](docs/features/kick-user-system.md)**  
  _User kick/ban system implementation and limitations_

- **[message-actions-mobile.md](docs/features/message-actions-mobile.md)**  
  _Mobile-friendly message action menus and drawers_

- **[modals.md](docs/features/modals.md)**  
  _Complete modal system architecture and patterns_

- **[reacttooltip-mobile.md](docs/features/reacttooltip-mobile.md)**  
  _React Tooltip implementation for mobile devices_

- **[responsive-layout.md](docs/features/responsive-layout.md)**  
  _Responsive layout system with mobile sidebar navigation_

- **[search-feature.md](docs/features/search-feature.md)**  
  _Global search implementation with keyboard shortcuts_

### System Architecture

- **[data-management-architecture-guide.md](docs/data-management-architecture-guide.md)**  
  _Comprehensive guide to data storage, management, and flow patterns in Quorum_

## 🐛 Bug Reports (.claude/bugs/)

Tracking of bugs, both solved and active.

### ✅ Solved Bugs

- **[SOLVED_modal-navmenu-zindex-stacking.md](bugs/SOLVED_modal-navmenu-zindex-stacking.md)**  
  _NavMenu elements appearing above modal overlays_  
  Solution: New modal component with direct rendering and z-[9999]

- **[SOLVED_newdirectmessage-modal-url-to-state-conversion.md](bugs/SOLVED_newdirectmessage-modal-url-to-state-conversion.md)**  
  _Modal reopening/flickering when closing from existing conversations_  
  Solution: Converted from URL-based to state-based modal management

- **[SOLVED_react-hooks-violation-conditional-return.md](bugs/SOLVED_react-hooks-violation-conditional-return.md)**  
  _React hooks called conditionally due to early return statement_  
  Solution: Moved all hooks before conditional returns

- **[SOLVED_right-sidebar-overlay.md](bugs/SOLVED_right-sidebar-overlay.md)**  
  _Right sidebar overlay positioning issues_  
  Solution: Fixed overlay implementation

### 🚧 Active/Ongoing Bugs

- **[brave-browser-react-hook-errors-ONGOING.md](bugs/brave-browser-react-hook-errors-ONGOING.md)**  
  _React hook errors specific to Brave browser_  
  Status: Ongoing investigation with factory function workaround

- **[search-focus-management.md](bugs/search-focus-management.md)**  
  _Search input focus management issues_  
  Status: Under investigation

## 🛠️ Commands (.claude/commands/)

Custom commands and automation scripts.

- **[audit-update.md](commands/audit-update.md)**  
  _Audit and update commands for codebase maintenance_

## 📋 Tasks (.claude/tasks/)

Task tracking for completed, ongoing, and planned work.

### ✅ Completed Tasks (.claude/tasks/done/)

- **[DONE_modal-migration-plan.md](tasks/done/DONE_modal-migration-plan.md)** - Modal system migration planning
- **[color-switcher.md](tasks/done/color-switcher.md)** - Accent color switcher implementation
- **[components-audit-dashboard.md](tasks/done/components-audit-dashboard.md)** - Components audit dashboard
- **[emojipicker-responsive.md](tasks/done/emojipicker-responsive.md)** - Responsive emoji picker
- **[global-search-plan.md](tasks/done/global-search-plan.md)** - Global search planning
- **[global-search.md](tasks/done/global-search.md)** - Global search implementation
- **[message-options-mobile/](tasks/done/message-options-mobile/)** - Mobile message actions
- **[messages-report.md](tasks/done/messages-report.md)** - Messages feature report
- **[new-modals-effect.md](tasks/done/new-modals-effect.md)** - Modal effects implementation
- **[reacttoolltip-mobile.md](tasks/done/reacttoolltip-mobile.md)** - Mobile tooltip support
- **[responsive-layout.md](tasks/done/responsive-layout.md)** - Responsive layout implementation
- **[responsive-layout_requirements.md](tasks/done/responsive-layout_requirements.md)** - Layout requirements
- **[search-primitive-migration.md](tasks/done/search-primitive-migration.md)** - Search primitive migration
- **[usersettingsmodal-primitive-migration.md](tasks/done/usersettingsmodal-primitive-migration.md)** - User settings modal migration

### 🚧 Ongoing Tasks (.claude/tasks/ongoing/)

_(Currently empty)_

### 📝 TODO Tasks (.claude/tasks/todo/)

#### CSS Refactoring

- **[css-refactor/analysis.md](tasks/todo/css-refactor/analysis.md)** - CSS codebase analysis
- **[css-refactor/css-inventory.md](tasks/todo/css-refactor/css-inventory.md)** - Complete CSS inventory
- **[css-refactor/css-refactor-plan.md](tasks/todo/css-refactor/css-refactor-plan.md)** - Refactoring plan

#### Mobile Development

- **[mobile-dev/business-logic-extraction-plan.md](tasks/todo/mobile-dev/business-logic-extraction-plan.md)** - Business logic extraction planning
- **[mobile-dev/components-audit.md](tasks/todo/mobile-dev/components-audit.md)** - Components audit for mobile
- **[mobile-dev/components-shared-arch-masterplan.md](tasks/todo/mobile-dev/components-shared-arch-masterplan.md)** - Shared component architecture
- **[mobile-dev/css-to-mobile-colors-sync.md](tasks/todo/mobile-dev/css-to-mobile-colors-sync.md)** - CSS to mobile color synchronization
- **[mobile-dev/mobile-dev-plan.md](tasks/todo/mobile-dev/mobile-dev-plan.md)** - Mobile development plan
- **[mobile-dev/mobile-touch-transition-plan.md](tasks/todo/mobile-dev/mobile-touch-transition-plan.md)** - Touch transition plan
- **[mobile-dev/plan-quick-recap.md](tasks/todo/mobile-dev/plan-quick-recap.md)** - Quick plan recap
- **[mobile-dev/primitive-migration-audit.md](tasks/todo/mobile-dev/primitive-migration-audit.md)** - Primitive component migration audit

##### Mobile Dev Documentation

- **[mobile-dev/docs/component-architecture-workflow-explained.md](tasks/todo/mobile-dev/docs/component-architecture-workflow-explained.md)** - Component architecture workflow
- **[mobile-dev/docs/mobile-desktop-audit.md](tasks/todo/mobile-dev/docs/mobile-desktop-audit.md)** - Mobile/desktop feature audit
- **[mobile-dev/docs/primitives-testing.md](tasks/todo/mobile-dev/docs/primitives-testing.md)** - Primitives testing guide
- **[mobile-dev/docs/third-party-component-migration-report.md](tasks/todo/mobile-dev/docs/third-party-component-migration-report.md)** - Third-party component migration
- **[mobile-dev/docs/web-and-native-repo-structure.md](tasks/todo/mobile-dev/docs/web-and-native-repo-structure.md)** - Repository structure guide

#### Other TODOs

- **[kick-user-ux-improvements.md](tasks/todo/kick-user-ux-improvements.md)** - Kick user UX improvements planning
- **[search-performance-optimization.md](tasks/todo/search-performance-optimization.md)** - Search performance improvements
- **[test-suite-plan.md](tasks/todo/test-suite-plan.md)** - Test suite planning
- **[user-status.md](tasks/todo/user-status.md)** - User status feature planning

## 📁 Directory Structure

```
.claude/
├── INDEX.md (this file)
├── settings.local.json
├── commands/
│   └── audit-update.md
├── docs/
│   ├── component-development-guide.md
│   ├── cross-platform-components-guide.md
│   ├── data-management-architecture-guide.md
│   ├── primitive-styling-guide.md
│   └── features/
│       ├── desktop-notifications.md
│       ├── emoji-picker-react-customization.md
│       ├── invite-system-analysis.md
│       ├── kick-user-system.md
│       ├── message-actions-mobile.md
│       ├── modals.md
│       ├── reacttooltip-mobile.md
│       ├── responsive-layout.md
│       └── search-feature.md
├── bugs/
│   ├── SOLVED_modal-navmenu-zindex-stacking.md
│   ├── SOLVED_newdirectmessage-modal-url-to-state-conversion.md
│   ├── SOLVED_react-hooks-violation-conditional-return.md
│   ├── SOLVED_right-sidebar-overlay.md
│   ├── brave-browser-react-hook-errors-ONGOING.md
│   └── search-focus-management.md
└── tasks/
    ├── done/
    │   ├── DONE_modal-migration-plan.md
    │   ├── color-switcher.md
    │   ├── components-audit-dashboard.md
    │   ├── emojipicker-responsive.md
    │   ├── global-search-plan.md
    │   ├── global-search.md
    │   ├── message-options-mobile/
    │   ├── messages-report.md
    │   ├── new-modals-effect.md
    │   ├── reacttoolltip-mobile.md
    │   ├── responsive-layout.md
    │   ├── responsive-layout_requirements.md
    │   ├── search-primitive-migration.md
    │   └── usersettingsmodal-primitive-migration.md
    ├── ongoing/
    └── todo/
        ├── css-refactor/
        │   ├── analysis.md
        │   ├── css-inventory.md
        │   └── css-refactor-plan.md
        ├── mobile-dev/
        │   ├── business-logic-extraction-plan.md
        │   ├── components-audit.md
        │   ├── components-shared-arch-masterplan.md
        │   ├── css-to-mobile-colors-sync.md
        │   ├── mobile-dev-plan.md
        │   ├── mobile-touch-transition-plan.md
        │   ├── plan-quick-recap.md
        │   ├── primitive-migration-audit.md
        │   └── docs/
        │       ├── component-architecture-workflow-explained.md
        │       ├── mobile-desktop-audit.md
        │       ├── primitives-testing.md
        │       ├── third-party-component-migration-report.md
        │       └── web-and-native-repo-structure.md
        ├── kick-user-ux-improvements.md
        ├── search-performance-optimization.md
        ├── test-suite-plan.md
        └── user-status.md
```

---

_Last updated: 2025-07-30_