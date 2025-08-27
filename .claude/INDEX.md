# .claude Directory Index

This index provides quick access to all documentation, bug reports, and task tracking files in the .claude directory. Use Ctrl+F to search for specific topics or keywords.

**Last Updated**: 2025-08-27

## 📚 Documentation (.claude/docs/)

Comprehensive guides and documentation for various features and components.

### Component Development
- **[component-dev-guidelines.md](docs/component-dev-guidelines.md)**  
  *Guidelines for developing components with mobile-first approach*  
  Keywords: `components`, `mobile-first`, `responsive`, `best-practices`

### Feature Documentation
- **[emoji-picker-react-customization.md](docs/emoji-picker-react-customization.md)**  
  *Custom emoji picker implementation with responsive design*  
  Keywords: `emoji`, `picker`, `mobile`, `customization`

- **[message-actions-mobile.md](docs/message-actions-mobile.md)**  
  *Mobile-friendly message action menus and drawers*  
  Keywords: `messages`, `actions`, `mobile`, `drawer`, `long-press`

- **[modals.md](docs/modals.md)**  
  *Complete modal system architecture and patterns*  
  Keywords: `modals`, `dialog`, `overlay`, `z-index`

- **[new-modal-component.md](docs/new-modal-component.md)**  
  *Details about the modal component redesign to fix z-index issues*  
  Keywords: `modals`, `z-index`, `stacking-context`, `portal`, `navmenu`

- **[reacttooltip-mobile.md](docs/reacttooltip-mobile.md)**  
  *React Tooltip implementation for mobile devices*  
  Keywords: `tooltip`, `mobile`, `touch`, `hover`

- **[responsive-layout.md](docs/responsive-layout.md)**  
  *Responsive layout system with mobile sidebar navigation*  
  Keywords: `responsive`, `layout`, `sidebar`, `mobile`, `desktop`

- **[search-feature.md](docs/search-feature.md)**  
  *Global search implementation with keyboard shortcuts*  
  Keywords: `search`, `global-search`, `cmd+k`, `ctrl+k`, `minisearch`

- **[keyboard-avoidance-mobile.md](docs/keyboard-avoidance-mobile.md)**  
  *Enhanced mobile keyboard avoidance system with 2025 web standards*  
  Keywords: `keyboard`, `mobile`, `virtual-keyboard`, `visual-viewport`, `dvh`, `samsung`

### System Architecture
- **[data-management-architecture.md](docs/data-management-architecture.md)**  
  *Comprehensive guide to data storage, management, and flow patterns in Quorum*  
  Keywords: `data`, `architecture`, `indexeddb`, `websocket`, `encryption`, `messages`, `spaces`, `users`

## 🐛 Bug Reports (.claude/bugs/)

Tracking of bugs, both solved and active.

### ✅ Solved Bugs
- **[SOLVED_modal-navmenu-zindex-stacking.md](bugs/SOLVED_modal-navmenu-zindex-stacking.md)**  
  *NavMenu elements appearing above modal overlays*  
  Solution: New modal component with direct rendering and z-[9999]

- **[SOLVED_newdirectmessage-modal-url-to-state-conversion.md](bugs/SOLVED_newdirectmessage-modal-url-to-state-conversion.md)**  
  *Modal reopening/flickering when closing from existing conversations*  
  Solution: Converted from URL-based to state-based modal management

- **[SOLVED_react-hooks-violation-conditional-return.md](bugs/SOLVED_react-hooks-violation-conditional-return.md)**  
  *React hooks called conditionally due to early return statement*  
  Solution: Moved all hooks before conditional returns

- **[SOLVED_right-sidebar-overlay.md](bugs/SOLVED_right-sidebar-overlay.md)**  
  *Right sidebar overlay positioning issues*  
  Solution: Fixed overlay implementation

### 🚧 Active Bugs
- **[search-focus-management.md](bugs/search-focus-management.md)**  
  *Search input focus management issues*  
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
*(Currently empty)*

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
- **Mobile**: `mobile`, `responsive`, `touch`, `drawer`, `sidebar`, `keyboard`, `virtual-keyboard`
- **Modals**: `modal`, `dialog`, `overlay`, `z-index`, `stacking`
- **Search**: `search`, `global-search`, `cmd+k`, `minisearch`
- **Components**: `component`, `emoji`, `tooltip`, `message`
- **Bugs**: `SOLVED`, `hooks`, `z-index`, `focus`
- **Architecture**: `architecture`, `data`, `storage`, `flow`, `indexeddb`, `websocket`, `encryption`
- **CSS**: `css`, `refactor`, `styles`, `tailwind`, `dvh`, `visual-viewport`
- **Browser APIs**: `visual-viewport`, `virtual-keyboard`, `samsung`, `device-detection`

## 📁 Directory Structure

```
.claude/
├── INDEX.md (this file)
├── docs/
│   ├── component-dev-guidelines.md
│   ├── emoji-picker-react-customization.md
│   ├── message-actions-mobile.md
│   ├── modals.md
│   ├── new-modal-component.md
│   ├── reacttooltip-mobile.md
│   ├── responsive-layout.md
│   ├── search-feature.md
│   ├── keyboard-avoidance-mobile.md
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
*Last updated: 2025-08-27*