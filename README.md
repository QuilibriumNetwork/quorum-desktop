# Quorum Desktop

The world's first fully private and decentralized group messenger.
Powered by Quilibrium and the libp2p stack, Quorum can be used over TCP, QUIC, Websockets, or even LoRa — so it can run across the traditional internet, local networks, or off-grid setups.

**Available Platforms:**

- **Web Browser** - [Live app (beta)](https://app.quorummessenger.com/)
- **Desktop** - Electron wrapper for native desktop experience
- **Mobile** - [quorum-mobile](https://github.com/QuilibriumNetwork/quorum-mobile) (React Native + Expo)

- [Official website](https://www.quorummessenger.com/) - [FAQ](https://www.quorummessenger.com/faq)

## Repository Ecosystem

Quorum is built as a **multi-repository ecosystem** where shared functionality is centralized:

| Repository | Purpose |
|------------|---------|
| **[quorum-desktop](https://github.com/QuilibriumNetwork/quorum-desktop)** | Web + Electron desktop app (this repo) |
| **[quorum-mobile](https://github.com/QuilibriumNetwork/quorum-mobile)** | React Native + Expo mobile app |
| **[quorum-shared](https://github.com/QuilibriumNetwork/quorum-shared)** | Shared types, hooks, sync protocol (`@quilibrium/quorum-shared`) |

All clients sync data via the same protocol defined in `quorum-shared`, ensuring messages, bookmarks, and user settings stay in sync across all devices.

## Documentation

For detailed documentation on specific features and components, please refer to the [`.agents/docs`](.agents/docs) directory. You can find the complete index of available documentation in [`.agents/INDEX.md`](.agents/INDEX.md).

**Key Documentation:**

- [Quorum Ecosystem Architecture](.agents/docs/quorum-shared-architecture.md) - Multi-repo system and shared package
- [Component Management Guide](.agents/docs/component-management-guide.md) - Creating cross-platform components
- [Cross-Platform Architecture](.agents/docs/cross-platform-repository-implementation.md) - How the shared codebase works

## Development Resources

The [`.agents/`](.agents) folder contains development resources including:

- Architecture documentation and component guides
- Bug reports and solutions
- Task management ([pending & ongoing](.agents/tasks), [completed](.agents/tasks/.done))
- Mobile development guidelines and cross-platform considerations

### Development Tools

The [`src/dev/`](src/dev) folder contains development utilities:

- **Dev tools** (`/dev`) - Hub for the current available development tools
- **Documentation Viewer** (`/dev`) - Interactive frontend for browsing docs, tasks, and bug reports from the `.agents/` folder
- **Primitives Playground** (`/playground`) - Web-based testing environment for UI primitives and components
- **Mobile Playground** - Comprehensive testing environment accessible by running the mobile app (see Mobile Development section)

#### Accessing Development Tools

After running `yarn dev`, you can access the development tools at: `http://localhost:[port]/dev`

#### Testing with Mock Data

Add `?users=N` to any URL to generate mock users/contacts for testing:

```
# Space members list (1000 mock users)
http://localhost:5173/spaces/{space-id}/{channel-id}?users=1000

# Direct messages list (50 mock contacts)
http://localhost:5173/messages?users=50
```

**localStorage (persistent across sessions):**
```javascript
// Enable mock users (Space members)
localStorage.setItem('debug_mock_users', 'true')
localStorage.setItem('debug_mock_count', '1000')

// Enable mock conversations (DM contacts)
localStorage.setItem('debug_mock_conversations', 'true')
localStorage.setItem('debug_mock_conversation_count', '50')

// Disable
localStorage.removeItem('debug_mock_users')
localStorage.removeItem('debug_mock_conversations')
```

## Setup and Development

### Prerequisites

Requires Node.js and `quilibrium-js-sdk-channels` cloned alongside this repository. Running locally in a browser against prod Quorum API requires CORS to be disabled, consult your extensions or settings to perform this (if you disable CORS in your browser, remember to re-enable it as soon as you have finished testing).

### Initial Setup

```bash
cd ../quilibrium-js-sdk-channels/
yarn build
yarn link
cd ../quorum-desktop/
yarn link @quilibrium/quilibrium-js-sdk-channels
yarn install
```

### Web Development

To run the web app in development:

```bash
yarn dev
```

To run in Electron desktop app:

```bash
yarn dev

# In another terminal
yarn electron:dev
```

To build for production and preview:

```bash
yarn build:preview
```

### Mobile Development

The mobile app lives in a separate repository: **[quorum-mobile](https://github.com/QuilibriumNetwork/quorum-mobile)**

Both apps share code via the `@quilibrium/quorum-shared` package. See [Quorum Ecosystem Architecture](.agents/docs/quorum-shared-architecture.md) for details on the multi-repo setup.

## Translation Workflow

> All the existing translations (apart from English) have been created using an LLM.  
> Communities are welcome to proofread and correct them. We are setting up a dedicated platform to do just that.
> **Proofreading completed for**: English, Italian.

### To Correct an Existing Language

1. Correct the file: `src/i18n/<locale>/messages.po`
2. Run the command:
   ```bash
   yarn lingui:compile
   ```
   This updates the `messages.js` file in `src/i18n/<locale>/messages.js`.
3. Commit the changes and push to the remote repository.

### To Add a New Language

1. Add the language to `locales.ts` in: `src/i18n/locales.ts`
2. Run the command:
   ```bash
   yarn lingui:extract
   ```
   This creates the `.po` file in `src/i18n/<new-locale>/messages.po`.
3. Translate the messages in the `messages.po` file.
   - To translate via LLM, you can use: [po-files-translator](https://github.com/lamat1111/po-files-translator) (even if you choose to use an LLM, it's important to proofread the final text)
4. Run the command:
   ```bash
   yarn lingui:compile
   ```
   This creates the `messages.js` file in `src/i18n/<new-locale>/messages.js`.
5. Commit the changes and push to the remote repository.

---

_Updated: 2026-01-06_
