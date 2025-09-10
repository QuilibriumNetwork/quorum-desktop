# 🎯 Objective: Implement Global Message Search

[← Back to INDEX](/.readme/INDEX.md)

Your task is to design and implement a **global search feature** for messages inside our Quorum app.

You will:

- Think deeply about how this should work
- Propose your own approach and architecture
- Keep track of your thoughts, planning, and progress in a file called `./agents/tasks/global-search.md` — this is your project HQ

That file should:

- Contain your live plan, reasoning, and implementation steps
- Be continuously updated as you progress
- Be structured and self-contained (so someone else can understand what you’re building and how)

---

## 🧠 Useful Context

Messages are stored **locally** in **IndexedDB**, in the `MessageDB` class (`src/db/messages.ts`).

Core message flow:

- Components like `Channel` and `DirectMessage` handle user input
- Functions `submitMessage` / `submitChannelMessage` (from `useMessageDB`) write to the DB
- Messages are stored in the `messages` object store, indexed by `[spaceId, channelId, createdDate]`
- Retrieved using `messageDB.getMessages()` or via React hooks like `useMessages` (uses `useSuspenseInfiniteQuery`)

Key stores:

- `messages`: message payloads
- `conversations`: DM thread info
- `spaces`: space metadata
- `users`: user profiles

You can consult `./messages-report.md` for a deeper dive.

---

## 🔍 Expected Behavior

When searching:

- If the user is in a **DM view**, search only their direct messages
- If the user is in a **Space**, search only that space’s messages
- Only search what the user has permission to access
- UX should resemble Discord: scoped, real-time search, contextual
- Search bar should be in the top right side of the app

---

## 🔓 Now Take Over

You now have creative control.

1. Analyze the codebase and constraints
2. Propose a search strategy (start simple, make it extensible)
3. Document everything in `./agents/tasks/global-search.md`
4. Start implementing once you’ve scoped your plan

Do not ask for further instructions — think, plan, build, document.

🚀 Let’s go.
