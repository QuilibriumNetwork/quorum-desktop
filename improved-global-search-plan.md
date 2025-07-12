# 🎯 Objective: Implement Global Message Search

This document outlines the technical plan for implementing a global message search feature in the Quorum desktop app.

---

## 1. High-Level Requirements

- **Scoped Search**: When in a Direct Message view, search only DMs. When in a Space, search only messages within that space.
- **Real-time UX**: The search should be fast and responsive, updating as the user types.
- **UI Placement**: A search bar will be located in the top-right area of the application.
- **Contextual Results**: Search results should show enough context to be useful and link back to the original message in the chat history.

---

## 2. Proposed Technical Architecture

To meet the requirements efficiently, we will implement a client-side search using an in-memory index.

### 2.1. Search Library: `flexsearch`

We will use `flexsearch` as our search library. It is chosen for its:
- **High performance**: It's one of the fastest full-text search libraries available in JavaScript.
- **Memory efficiency**: It has a low memory footprint, which is critical for a client-side application that might handle thousands of messages.
- **Flexibility**: It supports custom tagging and filtering, which is perfect for our scoped search requirement.

### 2.2. Indexing Strategy

- **Index Creation**: A single, unified search index will be created when the application loads. 
- **Index Population**: The index will be populated by fetching all messages from IndexedDB via `messageDB.getAllSpaceMessages()` and `messageDB.getMessages()` for all conversations.
- **Data to Index**: We will index the `text` content of `post` type messages. Each document in the index will be tagged with its `spaceId` and `channelId` to allow for efficient filtering.
- **Incremental Updates**: The index will be updated in real-time. When a new message is saved to `MessageDB`, it will also be added to the `flexsearch` index. When a message is deleted, it will be removed from the index.

### 2.3. Search Scoping

Instead of creating multiple indexes (which would be memory-intensive), we will use a single index and leverage `flexsearch`'s filtering capabilities. When a user performs a search, we will apply a filter to the query based on the current context:
- **In a Space**: Filter results where `spaceId` matches the current space.
- **In DMs**: Filter results where the `spaceId` corresponds to a direct message conversation.

---

## 3. UI/Component Implementation

We will create the following new React components:

### 3.1. `SearchProvider.tsx`

A new context provider that will be responsible for:
- Initializing the `flexsearch` index.
- Populating the index with messages from `MessageDB`.
- Providing functions to `add`, `remove`, and `search` the index.
- Subscribing to `MessageDB` updates to keep the index in sync.

### 3.2. `SearchBar.tsx`

A UI component containing the search input field. It will:
- Be integrated into the main application title bar.
- Capture user input and trigger the search function from the `SearchProvider`.
- Manage the visibility of the search results modal.

### 3.3. `SearchResultsModal.tsx`

A modal component that will:
- Display a list of search results.
- Highlight the matching search terms in the message content.
- Show message context (sender, channel, date).
- Provide a button/link to navigate to the message's original location in the `MessageList`.

---

## 4. Step-by-Step Implementation Plan

1.  **Dependency Installation**:
    - Run `yarn add flexsearch`.

2.  **Create `SearchProvider.tsx`**:
    - Create a new file `src/components/context/SearchProvider.tsx`.
    - Implement the logic to initialize `flexsearch`.
    - Add a function to fetch all messages from `MessageDB` and build the initial index on app load.
    - Expose `search` and other necessary functions through the context.

3.  **Integrate `SearchProvider`**:
    - Wrap the main `App.tsx` component with the new `SearchProvider`.

4.  **Implement Incremental Indexing**:
    - Modify `MessageDB.saveMessage` and `MessageDB.deleteMessage` to call functions from the `SearchProvider` to update the index.

5.  **Create `SearchBar.tsx`**:
    - Create the new component file.
    - Add the search input and associated UI elements.
    - Use the `useSearch` context hook to get access to the search functionality.

6.  **Integrate `SearchBar.tsx`**:
    - Add the `SearchBar` component to the application's main title bar area (likely in `Titlebar.jsx` or a similar layout component).

7.  **Create `SearchResultsModal.tsx`**:
    - Create the component to display results.
    - Each result item should be clickable.

8.  **Connect Search and Display Results**:
    - In `SearchBar.tsx`, on input change, call the `search` function from the context.
    - Pass the results to the `SearchResultsModal` and display it.

9.  **Implement Navigation**:
    - When a user clicks on a search result, the application should navigate to the correct channel/DM and scroll to the specific message. This can be achieved by using the `virtuoso` ref in `MessageList.tsx` and its `scrollToIndex` method, using the message hash in the URL as a fallback.

---

## 5. Future Considerations

- **Index Persistence**: For faster startup times, the `flexsearch` index can be exported and saved to IndexedDB. On subsequent loads, the index can be loaded from storage instead of being rebuilt.
- **Advanced Search**: The search can be extended to include filtering by user, date ranges, or attachments.
- **Fuzzy Search**: `flexsearch` supports fuzzy matching, which can be enabled to provide more lenient search results.