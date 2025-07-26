# .claude Directory Index

This index provides quick access to all documentation, bug reports, and task tracking files in the .claude directory. Use Ctrl+F to search for specific topics or keywords.

**Last Updated**: 2025-07-26

## 📚 Documentation (.claude/docs/)

Comprehensive guides and documentation for various features and components.

### Component Development

- **[component-dev-guidelines.md](docs/component-dev-guidelines.md)**  
  _Guidelines for developing components with mobile-first approach_  
  Keywords: `components`, `mobile-first`, `responsive`, `best-practices`

- **[primitive-styling-guidelines.md](docs/primitive-styling-guidelines.md)**  
  _🚨 CRITICAL: Form field consistency rules and semantic color usage for all primitives_  
  Keywords: `primitives`, `styling`, `consistency`, `form-fields`, `semantic-colors`, `input`, `textarea`, `select`, `radiogroup`

### Feature Documentation

- **[emoji-picker-react-customization.md](docs/emoji-picker-react-customization.md)**  
  _Custom emoji picker implementation with responsive design_  
  Keywords: `emoji`, `picker`, `mobile`, `customization`

- **[message-actions-mobile.md](docs/message-actions-mobile.md)**  
  _Mobile-friendly message action menus and drawers_  
  Keywords: `messages`, `actions`, `mobile`, `drawer`, `long-press`

- **[modals.md](docs/modals.md)**  
  _Complete modal system architecture and patterns_  
  Keywords: `modals`, `dialog`, `overlay`, `z-index`

- **[new-modal-component.md](docs/new-modal-component.md)**  
  _Details about the modal component redesign to fix z-index issues_  
  Keywords: `modals`, `z-index`, `stacking-context`, `portal`, `navmenu`

- **[reacttooltip-mobile.md](docs/reacttooltip-mobile.md)**  
  _React Tooltip implementation for mobile devices_  
  Keywords: `tooltip`, `mobile`, `touch`, `hover`

- **[responsive-layout.md](docs/responsive-layout.md)**  
  _Responsive layout system with mobile sidebar navigation_  
  Keywords: `responsive`, `layout`, `sidebar`, `mobile`, `desktop`

- **[search-feature.md](docs/search-feature.md)**  
  _Global search implementation with keyboard shortcuts_  
  Keywords: `search`, `global-search`, `cmd+k`, `ctrl+k`, `minisearch`

### System Architecture

- **[data-management-architecture.md](docs/data-management-architecture.md)**  
  _Comprehensive guide to data storage, management, and flow patterns in Quorum_  
  Keywords: `data`, `architecture`, `indexeddb`, `websocket`, `encryption`, `messages`, `spaces`, `users`

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

### 🚧 Active Bugs

- **[search-focus-management.md](bugs/search-focus-management.md)**  
  _Search input focus management issues_  
  Status: Under investigation

## 📋 Tasks (.claude/tasks/)

Task tracking for completed, ongoing, and planned work.

### ✅ Completed Tasks (.claude/tasks/done/)

- **[color-switcher.md](tasks/done/color-switcher.md)** - Accent color switcher implementation
- **[emojipicker-responsive.md](tasks/done/emojipicker-responsive.md)** - Responsive emoji picker
- **[global-search-plan.md](tasks/done/global-search-plan.md)** - Global search planning
- **[global-search.md](tasks/done/global-search.md)** - Global search implementation
- **[message-options-mobile/](tasks/done/message-options-mobile/)** - Mobile message actions
- **[messages-report.md](tasks/done/messages-report.md)** - Messages feature report
- **[new-modals-effect.md](tasks/done/new-modals-effect.md)** - Modal effects implementation
- **[reacttoolltip-mobile.md](tasks/done/reacttoolltip-mobile.md)** - Mobile tooltip support
- **[responsive-layout.md](tasks/done/responsive-layout.md)** - Responsive layout implementation
- **[responsive-layout_requirements.md](tasks/done/responsive-layout_requirements.md)** - Layout requirements

### 🚧 Ongoing Tasks (.claude/tasks/ongoing/)

_(Currently empty)_

### 📝 TODO Tasks (.claude/tasks/todo/)

#### CSS Refactoring

- **[css-refactor/analysis.md](tasks/todo/css-refactor/analysis.md)** - CSS codebase analysis
- **[css-refactor/css-inventory.md](tasks/todo/css-refactor/css-inventory.md)** - Complete CSS inventory
- **[css-refactor/css-refactor-plan.md](tasks/todo/css-refactor/css-refactor-plan.md)** - Refactoring plan

#### Mobile Development

- **[mobile-dev/components-shared-arch-masterplan.md](tasks/todo/mobile-dev/components-shared-arch-masterplan.md)** - Shared component architecture
- **[mobile-dev/mobile-desktop-audit.md](tasks/todo/mobile-dev/mobile-desktop-audit.md)** - Mobile/desktop audit
- **[mobile-dev/mobile-dev-plan.md](tasks/todo/mobile-dev/mobile-dev-plan.md)** - Mobile development plan
- **[mobile-dev/mobile-touch-transition-plan.md](tasks/todo/mobile-dev/mobile-touch-transition-plan.md)** - Touch transition plan

#### Other TODOs

- **[search-performance-optimization.md](tasks/todo/search-performance-optimization.md)** - Search performance improvements
- **[test-suite-plan.md](tasks/todo/test-suite-plan.md)** - Test suite planning

## 🔍 Quick Search Guide

Use these keywords to find related content:

- **Mobile**: `mobile`, `responsive`, `touch`, `drawer`, `sidebar`
- **Modals**: `modal`, `dialog`, `overlay`, `z-index`, `stacking`
- **Search**: `search`, `global-search`, `cmd+k`, `minisearch`
- **Components**: `component`, `emoji`, `tooltip`, `message`, `primitives`
- **Styling**: `styling`, `consistency`, `semantic-colors`, `form-fields`, `input`, `textarea`, `select`, `radiogroup`
- **Bugs**: `SOLVED`, `hooks`, `z-index`, `focus`
- **Architecture**: `architecture`, `data`, `storage`, `flow`, `indexeddb`, `websocket`, `encryption`
- **CSS**: `css`, `refactor`, `styles`, `tailwind`

## 📁 Directory Structure

```
.claude/
├── INDEX.md (this file)
├── docs/
│   ├── component-dev-guidelines.md
│   ├── primitive-styling-guidelines.md
│   ├── emoji-picker-react-customization.md
│   ├── message-actions-mobile.md
│   ├── modals.md
│   ├── new-modal-component.md
│   ├── reacttooltip-mobile.md
│   ├── responsive-layout.md
│   ├── search-feature.md
│   └── data-management-architecture.md
├── bugs/
│   ├── SOLVED_modal-navmenu-zindex-stacking.md
│   ├── SOLVED_newdirectmessage-modal-url-to-state-conversion.md
│   ├── SOLVED_react-hooks-violation-conditional-return.md
│   ├── SOLVED_right-sidebar-overlay.md
│   └── search-focus-management.md
├── tasks/
│   ├── done/
│   ├── ongoing/
│   └── todo/
```

---

_Last updated: 2025-07-26_
