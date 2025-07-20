# Quorum Desktop (and Web)

Requires nodejs, and quilibrium-js-sdk-channels cloned alongside it. Running locally in a browser against prod Quorum API requires CORS to be disabled, consult your extensions or settings to perform this.

To set up:

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

## Translation Workflow

> All the existing translations (apart from English) have been created using an LLM.  
> Communities are welcome to proofread and correct them.  
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
