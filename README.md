# Quorum Cross-Platform

The world's first fully private and decentralized group messenger.
Powered by Quilibrium and the libp2p stack, Quorum can be used over TCP, QUIC, Websockets, or even LoRa — so it can run across the traditional internet, local networks, or off-grid setups.

**Available Platforms:**
- **Web Browser** - [Live app (beta)](https://app.quorummessenger.com/)
- **Desktop** - Electron wrapper for native desktop experience
- **Mobile** - React Native app (in development)

- [Official website](https://www.quorummessenger.com/) - [FAQ](https://www.quorummessenger.com/faq)

## Documentation

For detailed documentation on specific features and components, please refer to the [`.readme/docs`](.readme/docs) directory. You can find the complete index of available documentation in [`.readme/INDEX.md`](.readme/INDEX.md).

**Key Documentation:**
- [Component Management Guide](.readme/docs/component-management-guide.md) - Creating cross-platform components
- [Cross-Platform Architecture](.readme/docs/cross-platform-repository-implementation.md) - How the shared codebase works


A complete documentation website will be created at a later time.

## Development Resources

The [`.readme/`](.readme) folder contains development resources including:

- Architecture documentation and component guides
- Bug reports and solutions  
- Task management ([pending & ongoing](.readme/tasks), [completed](.readme/tasks/.done))
- Mobile development guidelines and cross-platform considerations

### Development Tools

The [`src/dev/`](src/dev) folder contains development utilities:

- **Dev tools** (`/dev`) - Hub for the current available development tools
- **Documentation Viewer** (`/dev`) - Interactive frontend for browsing docs, tasks, and bug reports from the `.readme/` folder
- **Primitives Playground** (`/playground`) - Web-based testing environment for UI primitives and components
- **Mobile Playground** - Comprehensive testing environment accessible by running the mobile app (see Mobile Development section)

#### Accessing Development Tools

After running `yarn dev`, you can access the development tools at: `http://localhost:[port]/dev`

## Setup and Development

### Prerequisites

Requires Node.js and `quilibrium-js-sdk-channels` cloned alongside this repository. Running locally in a browser against prod Quorum API requires CORS to be disabled, consult your extensions or settings to perform this.

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

_If you are on Windows, we suggest testing on WSL for better performance_.

### Mobile Development

The mobile app uses React Native with Expo Dev Client and shares components with the web app through a cross-platform architecture.

**Quick Start:**
```bash
yarn mobile  # Start development server
```

For detailed setup and testing instructions, see:
- [Mobile README](mobile/README.md) - Complete mobile development guide
- [Expo Dev Testing Guide](.readme/docs/expo-dev-testing-guide.md) - Environment setup and troubleshooting

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

*Updated: 2025-09-10 16:10*
