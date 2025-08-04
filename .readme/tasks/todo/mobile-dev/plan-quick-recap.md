# Cross-Platform Development : Revised Plan

[← Back to INDEX](../../../INDEX.md)

## Phase 1: Complete Web Migration

- [x] **Primitives completed** - All core UI primitives built for both web and mobile (Button, Input, Modal, Select, etc.)
- [x] **Mobile testing validated** - Primitives tested and working on mobile via dedicated playground
- [x] **Full components audit** - Audit via json/fontend-dashboard of all components to keep track of the work in Phase 1 (classify components as shared vs platform-specific)
- [x] **Web migration in progress** - Converting existing web components to use new primitives
- [x] Extract business logic from complex components into shared hooks
- [x] Clean up components to focus only on UI rendering
- [ ] Test web app new architecture
- [ ] If successful, deploy on production and start using the repo as the main repo for building new features using the new architecture

=== This is where a more experienced coder could jump in to speed things up! ===

## Phase 2: Mobile Architecture Planning

- [ ] Find and test alternative solutions for third party plugins non supported on react native (react-virtuoso, emoji-picker-react, react-dropzone)
- [ ] Design mobile UX/UI (Document mobile differences)
- [ ] Set up React Native development environment
- [ ] Create mobile app project structure
- [ ] Test shared hooks work in mobile environment
- [ ] Create native components (shared with web or standalone depending on each case)
- [ ] Implement mobile navigation system

## Phase 3: Mobile App Finalization

- [ ] Mobile-specific features (push notifications, etc.)
- [ ] Performance optimization and testing
- [ ] App store preparation and deployment
