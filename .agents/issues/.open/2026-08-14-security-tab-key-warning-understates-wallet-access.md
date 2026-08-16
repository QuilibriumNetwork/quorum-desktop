---
type: bug
title: "Security tab key warning understates what the key controls (it is the wallet, for desktop-origin accounts)"
status: open
priority: medium
created: 2026-08-14
updated: 2026-08-14
area: key handling / user-facing copy
platforms: quorum-desktop, behaviour verified against quorum-mobile
---

# The Account Key warning names the smallest loss, not the largest

## The text

[`Security.tsx:545`](../../../src/components/modals/UserSettingsModal/Security.tsx#L545), above
**Download file / Copy key / Show QR**:

> Your private key is the only proof of ownership of your account. Anyone who has
> it can impersonate you and steal your Space's Apex earnings. Never share it.

For an account created on desktop, that key also controls every multi-chain wallet
balance the mobile app derives: Bitcoin, Ethereum, Solana, Kaspa, Bittensor and
Tezos. The warning does not say so, and the panel's own QR button ("for importing
into the Quorum mobile app") is precisely the path someone would use.

Mobile already tells the user this in the other direction, at
`components/WalletModal.tsx:1142`: *"These addresses are derived from your Quorum
seed phrase."*

## Two account families, and only one is covered by the current wording

The mobile wallet picks its derivation source at
`hooks/useWallet.ts:199-230` — stored mnemonic first, hex private key as fallback.

| Account origin | Wallet derives from | Does the exported ed448 key reach the wallet? |
|---|---|---|
| **Created on desktop** (no mnemonic exists anywhere) | HKDF over the ed448 private key, `services/wallet/multiChainWallet.ts:286-308`, salt `quorum-multichain-wallet`, info `master-seed` | **Yes — completely** |
| **Created on mobile** (24-word phrase) | BIP39 seed, `multiChainWallet.ts:177-195` | No |

Desktop has no mnemonic concept at all: the key comes from the passkey `largeBlob`
(see [`src/utils/privateKey.ts:5-11`](../../../src/utils/privateKey.ts#L5-L11)), and the
24-word import mode is deliberately unbuilt
([`ImportKeyStep.tsx:17-20`](../../../src/components/onboarding/steps/ImportKeyStep.tsx#L17-L20)).
Mobile's `importFromHex` stores only the private key and no mnemonic
(`context/OnboardingContext.tsx:504-510`), so a desktop key imported by QR lands
squarely in the first row.

The Quilibrium address holding Apex earnings follows the same split:
`deriveQuilibriumAddressFromSeed` for mnemonic accounts, HKDF `quilibrium-view` /
`quilibrium-spend` over the private key otherwise (`services/onboarding/keyService.ts:230-260`).

## How this was verified (MEASURED, 2026-08-14)

Not read, run. Both quorum-mobile modules were bundled unmodified with esbuild and
executed under Node against throwaway keys generated in the harness and discarded.

1. `deriveMultiChainKeysFromPrivateKey(<114-char ed448 hex>)` returned **spendable**
   private keys for ETH, BTC (legacy / segwit / native segwit), SOL, Kaspa,
   Bittensor and Tezos. Same key in, byte-identical output across runs.
   Control arm: a second, unrelated key produced entirely different addresses, so
   the harness was not echoing its input.
2. `generateMnemonic()` → `keyPairFromMnemonic()` to get a mnemonic account's ed448
   key, then compared the owner's wallet (`deriveMultiChainKeys(mnemonic)`) against
   what a holder of only that ed448 key can compute
   (`deriveMultiChainKeysFromPrivateKey`). **Every chain differed.** The account key
   is a child of the BIP39 seed (`keyService.ts:300-327`), and HMAC-SHA512 does not
   invert.

To reproduce: bundle `services/wallet/multiChainWallet.ts` (no aliases needed) and
`services/onboarding/keyService.ts` (needs `@` aliased to the mobile repo root, plus
no-op stubs for `./secureStorage`, `../crypto`, `react-native`, `react-native-mmkv`,
`@quilibrium/quorum-shared`, `expo-*` and `services/api/config`, and a `__DEV__`
definition), then call the exported functions directly. No device or emulator needed.

## This is not an exploit

Nothing here lets anyone in who does not already hold the key, and the derivation
code is public in quorum-mobile. It is a copy accuracy defect: the warning
understates blast radius, so a user weighing "how careful must I be with this file"
is deciding on incomplete information. Filed publicly for that reason.

## Proposed fix

Replace the sentence with something that names the full scope. Draft:

> Your private key controls your entire account: your identity, your Apex earnings,
> and every wallet balance (Bitcoin, Ethereum, Solana and others) derived from it.
> Anyone who has it can impersonate you and take your funds. Never share it.

House style forbids em dashes in user-facing strings, so the colon-and-parenthesis
shape above is deliberate. The string is wrapped in `t\`\`` and appears in every
locale catalogue under `src/i18n/`, so changing it invalidates the existing
translations for that message and they will need re-extraction.

## Two decisions needed before writing it

1. **Should desktop mention wallets at all** while the wallet UI is mobile-only?
   Naming a feature the user cannot see on this platform may confuse more than it
   warns. The counter-argument is that the risk is real today precisely because the
   key is portable to mobile, and the QR button invites exactly that.
2. **Should the text branch on account origin?** A mobile-created account whose key
   was imported into desktop genuinely is *not* exposed this way, so the blunt
   wording would overstate the risk for those users. Desktop cannot currently tell
   the two apart, but it could: an account created on desktop never has a phrase.
   Branching is more code and two strings to translate; a single worst-case warning
   is simpler and errs safe.

## Status

Filed 2026-08-14 after tracing the derivation chain end to end and measuring both
account families. No code changed. Blocked on the two product decisions above.
