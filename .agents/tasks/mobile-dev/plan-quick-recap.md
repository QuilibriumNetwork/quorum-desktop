# Cross-Platform Development : Revised Plan

## Phase 1: Complete Web Migration

- [x] Build core UI primitives built for both web and mobile (Button, Input, Modal, Select, etc.)
- [x] Test primitives via dedicated playground
- [x] Audit components via json/fontend-dashboard to keep track of the work in Phase 1 (classify components as shared vs platform-specific)
- [x] Convert existing web components to use new primitives
- [x] Test web app new architecture
- [x] Start using the repo as the main repo for building new features using the new architecture
- [DOING] Extract business logic from complex components into shared hooks
- [DOING] Clean up components to focus only on UI rendering

=== This is where a more experienced coder could jump in to speed things up! ===

## Phase 2: Mobile Architecture Planning

- [x] Set up React Native development environment
- [DOING] Create native components (shared with web or standalone depending on each case)
- [DOING] Test shared hooks work in mobile environment
- [ ] Find and test alternative solutions for third party plugins non supported on react native (react-virtuoso, emoji-picker-react, react-dropzone)
- [ ] Design mobile UX/UI
- [ ] Create mobile app project structure

## Phase 3: Mobile App Finalization

- [ ] Move from Expo Go to Expo Dev
- [ ] Integrate Passkey SDK and special/complex features (push notifications, etc.)
- [ ] Optimize performance and extensive testing of all components (android/ios)
- [ ] Fix all issues
- [ ] Test, final round on production builds (android/ios)
- [ ] Prepare for app store deployment
