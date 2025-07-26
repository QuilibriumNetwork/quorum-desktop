# Quorum Desktop (and Web)

The world's first fully private and decentralized group messenger.
Powered by Quilibrium and the libp2p stack, Quorum can be used over TCP, QUIC, Websockets, or even LoRa — so it can run across the traditional internet, local networks, or off-grid setups.

- [Official website](https://www.quorummessenger.com/) - [FAQ](https://www.quorummessenger.com/faq)
- [Web app (beta)](https://app.quorummessenger.com/)
- Mobile App: coming soon...

## Documentation

For detailed documentation on specific features and components, please refer to the `.claude/docs` directory. You can find the complete index of available documentation in `.claude/INDEX.md`.
A complete documentation website will be created at a later time.

## Set up and local testing

Requires Node.js, and quilibrium-js-sdk-channels cloned alongside it. Running locally in a browser against prod Quorum API requires CORS to be disabled, consult your extensions or settings to perform this.

```
cd ../quilibrium-js-sdk-channels/
yarn build
yarn link
cd ../quorum-desktop/
yarn link @quilibrium/quilibrium-js-sdk-channels
yarn install
```

To run:

```
yarn dev
```

To run in Electron, run:

```
yarn dev
```

and in another terminal:

```
yarn electron:dev
```

_If you are on Windows, we suggest testing on WSL for better performance_.

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
