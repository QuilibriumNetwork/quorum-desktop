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

and an in another terminal:

```
yarn electron:dev
```
