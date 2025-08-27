# Message Handling Report

This document outlines how messages are handled in the Quilibrium desktop application, and proposes a plan for implementing a search feature.

## Message Flow

1.  **User Input**: The `Channel` and `DirectMessage` components capture user input from a `textarea` element.
2.  **Message Submission**: When the user sends a message, the `submitChannelMessage` or `submitMessage` function is called from `useMessageDB` context.
3.  **Database Storage**: The `MessageDB` class uses IndexedDB to store messages locally. The `saveMessage` method saves the message and updates the conversation metadata.
4.  **API Interaction**: The `quorumApi.ts` file defines the types for API requests and responses. The actual API calls are handled by the `@quilibrium/quilibrium-js-sdk-channels` library.
5.  **Message Fetching**: The `useMessages` hook fetches messages from the local database using `messageDB.getMessages`. It uses `useSuspenseInfiniteQuery` from `@tanstack/react-query` to handle pagination.
6.  **Rendering**: The `MessageList` component uses `react-virtuoso` to efficiently render a long list of messages. The `Message` component renders individual messages, including handling different message types (post, embed, sticker, etc.), replies, reactions, and user profiles.

## Key Data Structures

- **`Message`**: The core message object, defined in `src/api/quorumApi.ts`. It contains the message content, sender information, timestamps, and other metadata.
- **`Conversation`**: Represents a direct message or group chat, defined in `src/api/quorumApi.ts`.
- **`Space`**: Represents a server or community, defined in `src/api/quorumApi.ts`.
- **`Channel`**: Represents a channel within a space, defined in `src/api/quorumApi.ts`.

## Database Schema

The IndexedDB schema is defined in `src/db/messages.ts`. The key object stores are:

- **`messages`**: Stores all messages, indexed by `[spaceId, channelId, createdDate]`.
- **`conversations`**: Stores conversation metadata.
- **`spaces`**: Stores space metadata.
- **`users`**: Stores user profiles.
