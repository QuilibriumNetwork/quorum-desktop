---
type: task
title: "Port: paste private key on import + copy private key in settings (with Security-tab UI consolidation)"
status: ready
created: 2026-06-11
updated: 2026-06-11
candidate: "#31a (+ companion copy-export); #31b parked"
branch: TBD (session branch)
pr: TBD
---

# Port — paste private key on import + copy private key in settings

> Source candidate: [`candidates.md` #31a](candidates.md#31a-onboarding-paste-private-key-hex--engineering-ready) (import side) + the copy-export companion surfaced 2026-06-11. The **24-word recovery-phrase** half ([`#31b`](candidates.md#31b-onboarding-paste-recovery-phrase-24-words--needs-a-product-call)) is **parked** pending a lead-dev product call — out of scope here.

## Summary

Desktop's account key handling is **file-only in both directions**:
- **Import:** [`ImportKeyStep.tsx`](../../../src/components/onboarding/steps/ImportKeyStep.tsx) accepts only a `.key` file upload (drag-and-drop / picker).
- **Export:** [`Security.tsx`](../../../src/components/modals/UserSettingsModal/Security.tsx) "Key Export" only **downloads** the `.key` file. You can also "Show QR" (Mobile Import section), but there is no **copy the private key** action.

Mobile offers both: paste-hex on import ([`HexInputView.tsx`](../../../../quorum-mobile/components/onboarding/HexInputView.tsx)) and copy-to-clipboard of the key ([`ProfileModal.tsx` `handleCopyRecoveryPhrase`](../../../../quorum-mobile/components/ProfileModal.tsx)).

This task ports the two **symmetric** capabilities (paste-in / copy-out) and **consolidates the now-crowded Security-tab key-secret actions** so the three actions (download file, copy key, show QR) read as one coherent group instead of three stacked danger buttons.

**Both capabilities are UI-only.** Verified: no SDK change, no `quorum-shared` change. The underlying functions already exist on desktop.

## Why this is UI-only (verified, do not re-derive)

### Import (paste hex)
The SDK's `usePasskeyFlow.importKeyFile(file: File)` (already the sole import entry on desktop, proxied via [`useUnifiedOnboardingFlow.ts`](../../../src/hooks/business/user/useUnifiedOnboardingFlow.ts) → `flow.importKeyFile`) reads `file.arrayBuffer()` and **already parses a 114-char hex string** in the file body. Verified by reading `node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.js`, `importKeyFile`:
- 57 raw bytes → raw ed448 key, hex-encoded internally
- else UTF-8 trimmed; if **114 hex chars** → used directly as the private key
- if starts with `{` → JSON `{ private_key: number[] }`

So pasted hex works by `flow.importKeyFile(new File([cleanHex], 'imported.key'))`. **No new SDK surface.**

### Export (copy hex)
`getPrivateKeyHex()` **already exists** and is already wired into `Security.tsx` (it feeds the QR code via `handleConfirmShowQR`). Source: [`useUserSettings.ts:247`](../../../src/hooks/business/user/useUserSettings.ts#L247) → `return await exportKey(currentPasskeyInfo.address)`. A "copy" button reuses this exact call. **No new key-retrieval plumbing.**

> ⚠️ **Confirm the shape of `getPrivateKeyHex()` output before wiring copy.** `exportKey()` returns the **`.key` file content**, which per the SDK import branches may be a 114-char hex string **or** a JSON `{private_key:[...]}` blob (the QR uses it as-is and mobile re-parses on import). The **copy button must put a clean 114-char hex on the clipboard**, not a JSON blob, so a user pasting it into desktop's new paste field (or mobile) gets a value that validates. If `getPrivateKeyHex()` can return JSON, normalize to hex in the copy handler (same 3-branch logic the SDK uses). **Add a test/assertion for this.**

## Scope

### In scope
1. **Import: paste private key (hex)** in `ImportKeyStep.tsx`.
   - Masked input **by default**, with a **show/hide toggle** (user call 2026-06-11: "mask by default with the possibility to show the contents").
   - Validation mirroring mobile: strip leading `0x` (case-insensitive), strip all whitespace, lowercase, require **exactly 114 hex chars**; friendly too-short / too-long messages with a live `(n/114)` count.
   - On submit: `flow.importKeyFile(new File([cleanHex], 'imported.key'))`. Reuse existing `flow.importError` display.
   - Input hygiene (security parity with file upload — see Security section): `autoComplete="off"`, `spellCheck={false}`, `data-1p-ignore`, clear state on unmount and on successful import, never `console.log` the value.
   - Keep the existing file-upload dropzone. Decide layout (see UI consolidation) — likely a two-mode toggle "Upload file" / "Paste key" rather than two stacked inputs.

2. **Export: copy private key (hex)** in `Security.tsx`.
   - Confirm-gated identically to the existing "Show QR" flow (reuse the destructive-confirm + warning Callout pattern already in this file).
   - On confirm: `const hex = normalizeToHex(await getPrivateKeyHex()); await navigator.clipboard.writeText(hex);` then a success Callout mirroring mobile: "Private key copied. Store it securely and clear your clipboard."
   - **Clipboard auto-clear** after ~30–60s (hardening mobile doesn't have; Electron makes it easy — `navigator.clipboard.writeText('')` on a timer, only if the clipboard still holds our value if checkable, else unconditional). Document the chosen behavior.
   - Label explicitly **"Copy private key (hex)"** — desktop has no mnemonic store, so this is hex-only, never 24 words (unlike mobile, which copies the mnemonic when present). One-line clarity so it's not mistaken for a phrase export.

3. **Security-tab UI consolidation** (the reason this is a task, not a one-liner).
   - Today the key-secret actions are spread across **"Key Export"** (download file) and **"Mobile Import"** (Show QR), with copy-key about to be added. Three danger-styled actions on the same secret.
   - **Goal:** present them as **one cohesive "Account Key" group** — one explanatory block about what the private key is and the shared danger ("anyone with this can impersonate you / steal Apex earnings"), then the three actions (Download `.key` · Copy hex · Show QR) as peer affordances, not three separate bordered cards each repeating a warning.
   - Keep **Data Backup** (`.qmbak`) as its **own separate** section — it is a different secret (encrypted DM backup, not the identity key). Do not merge it into the key group.
   - Keep **Authorized Devices** untouched.
   - The single destructive-reveal confirm should ideally gate **both** copy and QR (both expose the raw key), so the user confirms once per reveal intent rather than per button. Design this so it reads cleanly.

### Out of scope (do NOT do here)
- **#31b — paste / derive from 24-word recovery phrase.** Parked on a lead-dev product call (BIP-39→ed448 derivation lives only in mobile's `keyService`, needs `quorum-shared` promotion + a recoverability-asymmetry decision). Leave a clear seam in the `ImportKeyStep` mode-switch so a "Recovery phrase" mode can be added later without rework, but **do not build it**.
- Any SDK or `quorum-shared` change. If you find yourself editing either, stop — the scope is wrong.
- QR **import** on desktop (scanning a QR into desktop). Not requested.
- Mnemonic display/copy in settings (desktop has no mnemonic).

## Files

| File | Change |
|---|---|
| [`src/components/onboarding/steps/ImportKeyStep.tsx`](../../../src/components/onboarding/steps/ImportKeyStep.tsx) | Add paste-hex mode: masked input + show/hide toggle, validation, synthetic-`File` submit. Mode switch (Upload / Paste) with a future seam for "Recovery phrase". |
| [`src/components/modals/UserSettingsModal/Security.tsx`](../../../src/components/modals/UserSettingsModal/Security.tsx) | Add "Copy private key (hex)" (confirm-gated, clipboard-clear). Consolidate Key Export + Mobile Import into one "Account Key" group. |
| (maybe) [`src/hooks/business/user/useUserSettings.ts`](../../../src/hooks/business/user/useUserSettings.ts) | Only if `getPrivateKeyHex()` needs a `normalizeToHex` wrapper to guarantee 114-char hex output. Prefer normalizing in the component if it keeps the hook clean. |
| i18n | New `t\`\`` strings — run the project's lingui extract after. |

**No changes** to `useUnifiedOnboardingFlow.ts` (reuse `importKeyFile`), the SDK, or shared.

## Security posture (carry into the PR description)

Key **handling** is byte-for-byte identical to the existing file upload — same `importKeyFile`, same key-at-rest encryption, same registration path. The only new exposure points are:
1. **Clipboard** (both paste-in and copy-out) — readable by other processes / clipboard managers / Windows Cloud Clipboard. Already shipping on mobile; materially de-risked by Electron's non-web renderer. Mitigate copy-out with the auto-clear + "clear your clipboard" warning.
2. **Transient masked input value** in React state/DOM on import — mitigated by masking, input-hygiene attrs, and state cleanup.

Not a regression vs. file upload; closed to near-parity with standard input hardening. See the full assessment in the session that produced this task.

## Build order

1. `getPrivateKeyHex()` shape check + `normalizeToHex` if needed (+ test).
2. Security.tsx: copy-key button behind the existing confirm pattern (smallest, proves the hex path).
3. Security.tsx: consolidate the Key Export + Mobile Import sections into one "Account Key" group.
4. ImportKeyStep.tsx: paste-hex mode (masked + toggle + validation + synthetic File), with the future "Recovery phrase" seam.
5. i18n extract; manual verification (round-trip: copy hex from settings → fresh onboarding → paste it → account imports).
6. `npx tsc --noEmit --jsx react-jsx --skipLibCheck`, `yarn lint`.

## Verification (round-trip is the real test)

- Copy hex from Security → paste into the new import field → account imports to the same address. This proves both halves and the hex-normalization.
- Paste with `0x` prefix, with spaces/newlines, uppercase → all normalize and import.
- Paste a 113/115-char string → friendly length error, no submit.
- Masked by default; toggle reveals; value cleared on unmount and after successful import.
- Copy → success Callout shown; clipboard auto-clears after the chosen interval.
- Existing `.key` download + Show QR still work unchanged after consolidation.
- Mobile not touched (additive desktop-only port).

## Open decisions to confirm before/while building

1. **Import layout:** two-mode toggle ("Upload file" / "Paste key") vs. dropzone-with-"or paste" link below. (Leaning toggle — cleaner seam for the future Recovery-phrase mode.)
2. **Single vs. per-action reveal confirm** in Security: one confirm gating both Copy and Show QR, vs. separate confirms. (Leaning single shared reveal.)
3. **Clipboard auto-clear interval** for copy (30s? 60s? match QR's 60s auto-hide for consistency).

---
*Last updated: 2026-06-11*
