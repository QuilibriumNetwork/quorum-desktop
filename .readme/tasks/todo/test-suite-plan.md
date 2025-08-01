# Test Suite Implementation Plan for Quorum Desktop

[← Back to INDEX](../../INDEX.md)

This document outlines the plan to create a comprehensive testing suite for the Quorum Desktop application. The goal is to improve code quality, reduce regressions, and enable safe refactoring, starting with fixing existing TypeScript errors.

**This plan uses checkboxes (`- [ ]`). As the agent, I will update this file and mark tasks as complete (`- [x]`) as I execute them.**

The primary tools for this initiative will be:

- **[Vitest](https://vitest.dev/):** A modern, fast, and Vite-native test runner.
- **[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/):** For testing React components from a user-centric perspective.
- **[jsdom](https://github.com/jsdom/jsdom):** To simulate a browser environment for tests running in Node.js.
- **[User Event](https://testing-library.com/docs/user-event/intro):** To simulate real user interactions with the components.

---

## Phase 1: Setup and Configuration

This phase focuses on integrating the testing libraries and framework into the project, ensuring a solid foundation for all future tests.

- [ ] **Task 1: Install Core Dependencies**
  - [ ] Install `vitest`
  - [ ] Install `jsdom`
  - [ ] Install `@testing-library/react`
  - [ ] Install `@testing-library/jest-dom`
  - [ ] Install `@testing-library/user-event`

- [ ] **Task 2: Configure Testing Environment**
  - [ ] Create a `vitest.config.ts` file.
  - [ ] Configure Vitest to integrate with the existing `vite.config.js`.
  - [ ] Set up the test environment to use `jsdom`.
  - [ ] Configure Vitest to correctly handle path aliases (e.g., `@/`), SCSS imports, and other project-specific file types.

- [ ] **Task 3: Update Project Configuration**
  - [ ] Add a `"test": "vitest"` script to `package.json`.
  - [ ] Add a `"test:ui": "vitest --ui"` script for an interactive test runner.
  - [ ] Update `tsconfig.json` to include Vitest and Testing Library types for full TypeScript support in test files.

- [ ] **Task 4: Create Initial "Smoke Test"**
  - [ ] Identify a simple, stateless component (e.g., `src/components/CloseButton.tsx`).
  - [ ] Create the first test file: `src/components/CloseButton.test.tsx`.
  - [ ] Write a basic "smoke test" that renders the component and asserts it doesn't crash.
  - [ ] Run `npm test` and confirm that the test passes and the entire setup is functioning correctly.

---

## Phase 2: Foundational Unit & Snapshot Tests

This phase aims to build a baseline of test coverage, focusing on individual components and utilities. This will provide an immediate safety net against UI regressions.

- [ ] **Task 1: Test Core Presentational Components**
  - [ ] `src/components/Button.jsx`
  - [ ] `src/components/Input.tsx`
  - [ ] `src/components/Loading.tsx`
  - [ ] `src/components/UnknownAvatar.tsx`
  - [ ] `src/components/Tooltip.jsx`
  - [ ] **Strategy:** Use **snapshot tests** for these to quickly capture their rendered output and prevent unintended visual changes.

- [ ] **Task 2: Test Utility Functions**
  - [ ] Review `src/utils.ts` for pure, testable functions and add unit tests.
  - [ ] Review helper functions in `src/hooks/utils/` and add unit tests.

- [ ] **Task 3: Test Custom Hooks**
  - [ ] `src/hooks/useResponsiveLayout.ts`: Test the logic that returns layout information based on window size.
  - [ ] `src/hooks/useSearchContext.ts`: Test that the context provider works as expected.

---

## Phase 3: Integration and Feature Testing

This phase focuses on testing how multiple components and services work together to deliver a complete feature, simulating real user workflows.

- [ ] **Task 1: Test the Global Search Feature**
  - [ ] **Mocking:** Create a mock version of the `searchService` to provide controlled data without hitting a real search index.
  - [ ] **Component:** `src/components/search/GlobalSearchBar.tsx`.
  - [ ] **Scenario:**
    - [ ] Render the search bar.
    - [ ] Simulate a user typing a query.
    - [ ] Assert that the mocked `searchService` is called.
    - [ ] Assert that the UI updates to show the search results from the mock.

- [ ] **Task 2: Test the Modal System**
  - [ ] **Component:** `src/components/Modal.tsx`.
  - [ ] **Scenario:**
    - [ ] Create a test that renders a component that can trigger a modal.
    - [ ] Simulate the action that opens the modal.
    - [ ] Assert that the modal and its content become visible.
    - [ ] Simulate a click on the close button or overlay.
    - [ ] Assert that the modal is removed from the DOM.

- [ ] **Task 3: Test Core Channel/Space Interaction**
  - [ ] **Mocking:** Mock the `QuorumApiContext` to provide a predictable state for channels, spaces, and user information.
  - [ ] **Component:** `src/components/channel/ChannelList.tsx`.
  - [ ] **Scenario:**
    - [ ] Render the `ChannelList` with a mocked API context.
    - [ ] Assert that the list of channels is displayed correctly.
    - [ ] Simulate a user clicking on a specific channel.
    - [ ] Assert that the application's state changes accordingly (e.g., a navigation or state update function is called with the correct channel ID).

---

## Phase 4: Fix TypeScript Errors with Test Safety Net

With the test suite in place, this phase involves systematically working through the `lint-report.md` and fixing the errors with confidence.

- [ ] **Task 1: Analyze and Prioritize**
  - [ ] Read the `lint-report.md` file.
  - [ ] Group errors by file and create a priority list. Files with newly created test coverage will be top priority.

- [ ] **Task 2: Iterative Fixing and Verification**
  - [ ] For each file in the priority list:
    - [ ] **Fix:** Apply the necessary code changes to resolve the TypeScript errors.
    - [ ] **Verify (Automated):** Run the relevant tests (`vitest <path/to/file>`) and ensure all tests still pass.
    - [ ] **Verify (Manual):** Briefly run the application and manually check the part of the UI related to the change to ensure it behaves and looks as expected.
    - [ ] **Commit:** Commit the fix for that file or group of related files.
