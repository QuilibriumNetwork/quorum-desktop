# Invite with Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use `python "$HOME/.config/.claude/skills/docs-manager/task-sync.py" .agents/tasks/2026-04-20-invite-with-role-implementation.md check "step text"` to keep this file in sync with progress.

**Goal:** Allow space owners to pre-assign a role to a user before they join, by attaching a role when sending a personal invite. The role applies automatically on join.

**Architecture:** New optional `pendingRoleInvites` field on the shared `Space` type. Owner's client writes the entry when sending the invite and detects the join event to apply the role. Invite crypto and URL formats are unchanged. Works in both private and public invite modes.

**Tech Stack:** TypeScript, React, Lingui (i18n), TanStack Query, `@quilibrium/quorum-shared` (shared types + adapters between desktop + mobile).

**Related spec:** [.agents/tasks/2026-04-20-invite-with-role-design.md](./2026-04-20-invite-with-role-design.md)

---

## Phase 0 — File Structure

### Files created
- `src/hooks/business/spaces/usePendingRoleInvites.ts` — new hook exposing `addPendingRoleInvite`, `cancelPendingRoleInvite`, and the list
- `src/components/modals/SpaceSettingsModal/PendingRoleInvitesSection.tsx` — new component rendered inside `Roles.tsx`

### Files modified (in quorum-desktop)
- `package.json` — bump `@quilibrium/quorum-shared` to the version that ships the new type
- `src/hooks/business/spaces/useInviteManagement.ts` — add `selectedRoleId` state, extend `invite()` to write pending entry
- `src/components/modals/SpaceSettingsModal/Invites.tsx` — add role dropdown in the send-invite panel
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` — wire selectedRoleId state between hook and Invites component
- `src/components/modals/SpaceSettingsModal/Roles.tsx` — render `PendingRoleInvitesSection`
- `src/services/MessageService.ts` — `join` handler: owner-only role application + manifest re-post (around line 2876)
- `src/services/SpaceService.ts` — kick path: also clear pending entries (around line 785)
- `src/services/InvitationService.ts` — `generateNewInviteLink`: clear pending entries before manifest serialization (line 433 area)

### Files modified (in quorum-shared, separate PR)
- `src/types/space.ts` — add `PendingRoleInvite` type and optional field on `Space`
- `package.json` — minor version bump

---

## Phase 1 — Shared Package Type Change

> **GATED:** This phase produces a separate PR in the `quorum-shared` repo. **User reviews and merges manually.** Subsequent phases are blocked until the PR is merged and the new version is published.

### Task 1: Add `PendingRoleInvite` type to quorum-shared

**Files:**
- Modify: `D:\GitHub\Quilibrium\quorum-shared\src\types\space.ts` (lines 60-87)
- Modify: `D:\GitHub\Quilibrium\quorum-shared\package.json` (version field)

- [ ] **Step 1: Create a branch in quorum-shared**

```bash
cd /d/GitHub/Quilibrium/quorum-shared
git checkout -b feat/pending-role-invites
```

- [ ] **Step 2: Add the `PendingRoleInvite` type and extend `Space`**

Edit `src/types/space.ts`. Replace the `Role` + `Space` block (lines 16-87) with:

```typescript
export type Role = {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
  members: string[];
  permissions: Permission[];
  isPublic?: boolean;
};

export type PendingRoleInvite = {
  address: string;
  roleIds: string[];
  createdAt: number;
};

// ...Emoji, Sticker, Group, Channel types unchanged...

export type Space = {
  spaceId: string;
  spaceName: string;
  description?: string;
  vanityUrl: string;
  inviteUrl: string;
  iconUrl: string;
  bannerUrl: string;
  defaultChannelId: string;
  hubAddress: string;
  createdDate: number;
  modifiedDate: number;
  isRepudiable: boolean;
  isPublic: boolean;
  saveEditHistory?: boolean;
  groups: Group[];
  roles: Role[];
  emojis: Emoji[];
  stickers: Sticker[];
  spaceTag?: SpaceTag;
  allowThreads?: boolean;
  pendingRoleInvites?: PendingRoleInvite[];
};
```

- [ ] **Step 3: Ensure `PendingRoleInvite` is exported from the barrel**

Check `D:\GitHub\Quilibrium\quorum-shared\src\types\index.ts` re-exports everything from `space.ts`. If it uses explicit named re-exports, add `PendingRoleInvite`. If it uses `export * from './space'`, no change needed.

```bash
grep -E "pendingRoleInvites|PendingRoleInvite|export \* from './space'" /d/GitHub/Quilibrium/quorum-shared/src/types/index.ts
```

Expected: either `export * from './space';` (covers it) or explicit list that needs `PendingRoleInvite` added.

- [ ] **Step 4: Bump the minor version**

Edit `package.json`. Increment the minor version (e.g., `2.1.0` → `2.2.0`).

- [ ] **Step 5: Verify types compile**

```bash
cd /d/GitHub/Quilibrium/quorum-shared
yarn build
```

Expected: clean build with no TypeScript errors. `dist/` is regenerated.

- [ ] **Step 6: Commit**

```bash
git add src/types/space.ts src/types/index.ts package.json dist/
git commit -m "feat(types): add PendingRoleInvite type and optional field on Space"
```

- [ ] **Step 7: Push and open PR**

```bash
git push -u origin feat/pending-role-invites
gh pr create --title "feat(types): PendingRoleInvite on Space" --body "$(cat <<'EOF'
## Summary
- Adds `PendingRoleInvite = { address, roleIds, createdAt }` type
- Adds optional `pendingRoleInvites?: PendingRoleInvite[]` field to `Space`
- Minor semver bump

Purely additive type change — no runtime behavior. Enables the "invite with role" feature in quorum-desktop (see quorum-desktop#81).

## Test plan
- [ ] Build passes
- [ ] Existing consumers (desktop, mobile) still compile after upgrade
EOF
)"
```

- [ ] **Step 8: HALT — wait for user to merge**

> **Stop here.** The remaining phases depend on the shared-package PR being reviewed and merged by the user, and the new version being installable in quorum-desktop. Do not proceed until the user confirms the merge.

---

## Phase 2 — Desktop: consume new shared types

### Task 2: Upgrade `@quilibrium/quorum-shared` in quorum-desktop

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-desktop\package.json`
- Modify: `d:\GitHub\Quilibrium\quorum-desktop\yarn.lock` (generated)

- [ ] **Step 1: Bump the dependency version**

Edit `package.json`, find the `@quilibrium/quorum-shared` line, update to the merged version (e.g., `^2.2.0`).

- [ ] **Step 2: Install**

```bash
yarn install
```

Expected: `yarn.lock` updated, new version installed.

- [ ] **Step 3: Verify the new type is importable**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck -e "import type { PendingRoleInvite } from '@quilibrium/quorum-shared'; const x: PendingRoleInvite = { address: 'a', roleIds: [], createdAt: 0 };"
```

(If that one-liner form is awkward, instead do a smoke import in any existing file and run `yarn typecheck`.)

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore(deps): bump @quilibrium/quorum-shared for PendingRoleInvite"
```

---

## Phase 3 — Desktop: rekey + kick cleanup (safest changes first)

These two changes are independent of UI work, have limited blast radius, and harden the feature's edge cases before the main flow lands.

### Task 3: Clear pending entries on space rekey

**File:** `d:\GitHub\Quilibrium\quorum-desktop\src\services\InvitationService.ts` (line 433 area)

- [ ] **Step 1: Add the mutation before manifest serialization**

Find the line:

```typescript
space!.inviteUrl = `${getInviteUrlBase(true)}#spaceId=${space!.spaceId}&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
```

(currently line 433). Immediately after it, add:

```typescript
space!.pendingRoleInvites = [];
```

The resulting block should be:

```typescript
space!.inviteUrl = `${getInviteUrlBase(true)}#spaceId=${space!.spaceId}&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
space!.pendingRoleInvites = [];
const ciphertext = ch.js_encrypt_inbox_message(
  JSON.stringify({
    inbox_public_key: [...new Uint8Array(configPair.public_key)],
    ephemeral_private_key: ephemeral_key.private_key,
    plaintext: [
      ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
    ],
  } as secureChannel.SealedInboxMessageEncryptRequest)
);
```

Critical: placement must be before `JSON.stringify(space)` in the `plaintext`. Placing it after the `saveSpace(space!)` at line 485 would miss the manifest.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/services/InvitationService.ts
git commit -m "feat(invites): clear pendingRoleInvites on generateNewInviteLink rekey"
```

### Task 4: Clear pending entries on kick

**File:** `d:\GitHub\Quilibrium\quorum-desktop\src\services\SpaceService.ts` (line 785 area)

- [ ] **Step 1: Extend the existing role-cleanup block**

Find the block:

```typescript
// Remove kicked user from all roles
if (space) {
  space.roles = space.roles.map(role => ({
    ...role,
    members: role.members.filter(m => m !== userAddress)
  }));
}
```

Replace with:

```typescript
// Remove kicked user from all roles and pending role invites
if (space) {
  space.roles = space.roles.map(role => ({
    ...role,
    members: role.members.filter(m => m !== userAddress)
  }));
  space.pendingRoleInvites = (space.pendingRoleInvites ?? []).filter(
    p => p.address !== userAddress
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/services/SpaceService.ts
git commit -m "feat(roles): drop pendingRoleInvites entry when kicking user"
```

---

## Phase 4 — Desktop: `usePendingRoleInvites` hook

### Task 5: Create the hook that manages pending-role-invite writes

**Files:**
- Create: `d:\GitHub\Quilibrium\quorum-desktop\src\hooks\business\spaces\usePendingRoleInvites.ts`

This hook owns the two write operations: adding an entry (used by both the invite-send path and the management panel) and cancelling one. Both trigger a manifest re-post via `actionQueueService`.

- [ ] **Step 1: Create the file**

```typescript
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Space, PendingRoleInvite } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { buildSpaceKey } from '../../queries/space/buildSpaceKey';

export interface UsePendingRoleInvitesOptions {
  spaceId: string;
  space: Space | undefined;
}

export interface UsePendingRoleInvitesReturn {
  pendingRoleInvites: PendingRoleInvite[];
  addPendingRoleInvite: (address: string, roleId: string) => Promise<void>;
  cancelPendingRoleInvite: (address: string) => Promise<void>;
}

export const usePendingRoleInvites = (
  options: UsePendingRoleInvitesOptions
): UsePendingRoleInvitesReturn => {
  const { spaceId, space } = options;
  const { messageDB, actionQueueService } = useMessageDB();
  const queryClient = useQueryClient();

  const persist = useCallback(
    async (updatedSpace: Space) => {
      await messageDB.saveSpace(updatedSpace);
      queryClient.setQueryData(buildSpaceKey({ spaceId }), updatedSpace);
      await actionQueueService.enqueue(
        'update-space',
        { spaceId, space: updatedSpace },
        `space:${spaceId}`
      );
    },
    [messageDB, actionQueueService, queryClient, spaceId]
  );

  const addPendingRoleInvite = useCallback(
    async (address: string, roleId: string) => {
      if (!space) return;
      const existing = space.pendingRoleInvites ?? [];
      const withoutAddr = existing.filter((p) => p.address !== address);
      const next: PendingRoleInvite[] = [
        ...withoutAddr,
        { address, roleIds: [roleId], createdAt: Date.now() },
      ];
      await persist({ ...space, pendingRoleInvites: next });
    },
    [space, persist]
  );

  const cancelPendingRoleInvite = useCallback(
    async (address: string) => {
      if (!space) return;
      const existing = space.pendingRoleInvites ?? [];
      const next = existing.filter((p) => p.address !== address);
      await persist({ ...space, pendingRoleInvites: next });
    },
    [space, persist]
  );

  return {
    pendingRoleInvites: space?.pendingRoleInvites ?? [],
    addPendingRoleInvite,
    cancelPendingRoleInvite,
  };
};
```

- [ ] **Step 2: Verify `actionQueueService` is exposed from `useMessageDB`**

```bash
grep -n "actionQueueService" src/components/context/MessageDB.tsx src/components/context/useMessageDB.ts | head -10
```

Expected: `actionQueueService` is part of the MessageDB context value. If not exposed, expose it (mirror how `messageDB` is exposed). Similar pattern to line 114 in `useSpaceManagement.ts`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/business/spaces/usePendingRoleInvites.ts
git commit -m "feat(roles): add usePendingRoleInvites hook"
```

---

## Phase 5 — Desktop: owner-side write on invite send

### Task 6: Add role-picker state and selection logic to `useInviteManagement`

**File:** `d:\GitHub\Quilibrium\quorum-desktop\src\hooks\business\spaces\useInviteManagement.ts`

- [ ] **Step 1: Type `space` as `Space`, add selectedRoleId state, integrate pending-invite write**

Replace the entire content with:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  usePasskeysContext,
  channel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { useConversations, useRegistration } from '../../queries';
import type { Conversation, Channel, Space } from '@quilibrium/quorum-shared';
import { getAddressSuffix } from '../../../utils';
import { t } from '@lingui/core/macro';
import { usePendingRoleInvites } from './usePendingRoleInvites';

export interface UseInviteManagementOptions {
  spaceId: string;
  space?: Space;
  defaultChannel?: Channel;
}

export interface UseInviteManagementReturn {
  selectedUser: Conversation | undefined;
  setSelectedUser: (user: Conversation | undefined) => void;
  manualAddress: string;
  setManualAddress: (address: string) => void;
  resolvedUser: channel.UserRegistration | undefined;
  getUserOptions: () => any[];

  selectedRoleId: string | undefined;
  setSelectedRoleId: (id: string | undefined) => void;

  sendingInvite: boolean;
  success: boolean;
  membershipWarning: string | undefined;
  invite: (address: string) => Promise<void>;

  publicInvite: boolean;
  setPublicInvite: (isPublic: boolean) => void;
  generating: boolean;
  generateNewInviteLink: () => Promise<void>;
}

export const useInviteManagement = (
  options: UseInviteManagementOptions
): UseInviteManagementReturn => {
  const { spaceId, space, defaultChannel } = options;

  const [selectedUser, setSelectedUser] = useState<Conversation | undefined>();
  const [manualAddress, setManualAddress] = useState<string>('');
  const [resolvedUser, setResolvedUser] = useState<
    channel.UserRegistration | undefined
  >();
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>();
  const [sendingInvite, setSendingInvite] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [membershipWarning, setMembershipWarning] = useState<string | undefined>();
  const [generating, setGenerating] = useState<boolean>(false);
  const [publicInvite, setPublicInvite] = useState<boolean>(
    space?.isPublic || false
  );

  const { currentPasskeyInfo } = usePasskeysContext();
  const {
    messageDB,
    ensureKeyForSpace,
    sendInviteToUser,
    generateNewInviteLink: generateInviteLink,
  } = useMessageDB();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { data: conversations } = useConversations({ type: 'direct' });
  const { apiClient } = useQuorumApiClient();
  const navigate = useNavigate();

  const { addPendingRoleInvite } = usePendingRoleInvites({ spaceId, space });

  const getUserOptions = useCallback(() => {
    if (!conversations?.pages) return [];
    return conversations.pages
      .flatMap((c: any) => c.conversations as Conversation[])
      .toReversed()
      .map((conversation) => ({
        value: conversation.address,
        label: conversation.displayName,
        avatar: conversation.icon,
        displayName: conversation.displayName,
        userAddress: conversation.address,
        subtitle: getAddressSuffix(conversation.address),
      }));
  }, [conversations]);

  useEffect(() => {
    (async () => {
      if (manualAddress?.length === 46) {
        try {
          const reg = await apiClient.getUser(manualAddress);
          if (reg.data) {
            setResolvedUser(reg.data);
          }
        } catch {
          setResolvedUser(undefined);
        }
      } else {
        setResolvedUser(undefined);
      }
    })();
  }, [manualAddress, apiClient]);

  const invite = useCallback(
    async (address: string) => {
      setSendingInvite(true);
      setSuccess(false);
      setMembershipWarning(undefined);

      try {
        const existingMember = await messageDB.getSpaceMember(spaceId, address);
        if (
          existingMember &&
          existingMember.inbox_address &&
          existingMember.inbox_address !== '' &&
          !existingMember.isKicked
        ) {
          setMembershipWarning(t`This user is already a member of this space.`);
          return;
        }

        const spaceAddress = await ensureKeyForSpace(
          currentPasskeyInfo!.address,
          space!
        );
        if (spaceAddress !== spaceId && defaultChannel) {
          navigate('/spaces/' + spaceAddress + '/' + defaultChannel.channelId);
        }

        await sendInviteToUser(address, spaceAddress, currentPasskeyInfo!);

        // Owner-side pre-assignment: only if a role was picked, and caller is the owner.
        // Ownership is indicated by the presence of the owner private key locally.
        if (selectedRoleId) {
          const ownerKey = await messageDB.getSpaceKey(spaceAddress, 'owner');
          if (ownerKey) {
            try {
              await addPendingRoleInvite(address, selectedRoleId);
            } catch (err) {
              // Pending entry failed but invite succeeded. Log but don't fail the send.
              console.error('Failed to write pendingRoleInvite', err);
            }
          }
        }

        setSuccess(true);
      } catch (error) {
        console.error('Invite error:', error);
        setMembershipWarning(t`Failed to send invite. Please try again.`);
      } finally {
        setSendingInvite(false);
      }
    },
    [
      messageDB,
      spaceId,
      ensureKeyForSpace,
      currentPasskeyInfo,
      space,
      defaultChannel,
      navigate,
      sendInviteToUser,
      selectedRoleId,
      addPendingRoleInvite,
    ]
  );

  const generateNewInviteLink = useCallback(async () => {
    if (!space || !registration?.registration) return;

    setGenerating(true);
    try {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 200));
      await generateInviteLink(
        space.spaceId,
        keyset.userKeyset,
        keyset.deviceKeyset,
        registration.registration!
      );
    } finally {
      setGenerating(false);
    }
  }, [space, registration, keyset, generateInviteLink]);

  return {
    selectedUser,
    setSelectedUser,
    manualAddress,
    setManualAddress,
    resolvedUser,
    getUserOptions,

    selectedRoleId,
    setSelectedRoleId,

    sendingInvite,
    success,
    membershipWarning,
    invite,

    publicInvite,
    setPublicInvite,
    generating,
    generateNewInviteLink,
  };
};
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: clean (or expose errors in callers that used `space?: any` patterns — fix those by casting or typing as `Space`).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/spaces/useInviteManagement.ts
git commit -m "feat(invites): add role selection + owner-only pending-invite write"
```

### Task 7: Add role picker UI to the Invites panel

**Files:**
- Modify: `src/components/modals/SpaceSettingsModal/Invites.tsx`
- Modify: `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`

The role picker appears only when the current user is the space owner and only when the space has at least one role defined. It's optional — leaving it empty sends a normal invite with no pre-assignment.

- [ ] **Step 1: Extend the Invites props and render a role Select**

Edit `src/components/modals/SpaceSettingsModal/Invites.tsx`. Update the `InvitesProps` interface and the component:

```typescript
// Add these imports if not already present:
import { Select } from '../../primitives';
import type { Role } from '@quilibrium/quorum-shared';

interface InvitesProps {
  space: any;
  selectedUser: any;
  setSelectedUser: (user: any) => void;
  manualAddress: string;
  setManualAddress: (address: string) => void;
  resolvedUser: any;
  getUserOptions: () => any[];
  sendingInvite: boolean;
  invite: (address: string) => void;
  success: boolean;
  membershipWarning: string | undefined;
  generating: boolean;
  generationSuccess: boolean;
  errorMessage: string;
  setShowGenerateModal: (show: boolean) => void;
  // NEW:
  isSpaceOwner: boolean;
  roles: Role[];
  selectedRoleId: string | undefined;
  setSelectedRoleId: (id: string | undefined) => void;
}
```

Inside the component, after the `<SearchableConversationSelect>` and the "Enter Address Manually" toggle section, but BEFORE the Send Invite button (so around where `<Spacer size="md" />` lives at line 295), insert a role picker. It should render only when `isSpaceOwner && roles.length > 0`:

```tsx
{isSpaceOwner && roles.length > 0 && (
  <>
    <Spacer size="md" />
    <div className="input-style-label">
      <Trans>Assign Role (optional)</Trans>
    </div>
    <Select
      value={selectedRoleId ?? ''}
      variant="bordered"
      width="100%"
      options={[
        { value: '', label: t`No role` },
        ...roles.map((r) => ({
          value: r.roleId,
          label: r.displayName,
        })),
      ]}
      onChange={(v: string | string[]) => {
        const value = Array.isArray(v) ? v[0] : v;
        setSelectedRoleId(value || undefined);
      }}
      placeholder={t`No role`}
    />
    <div className="text-label pt-1 max-w-[500px]">
      <Trans>The role will apply automatically when the user joins.</Trans>
    </div>
  </>
)}
```

- [ ] **Step 2: Wire the new props in `SpaceSettingsModal.tsx`**

Find the `case 'invites':` block (around line 595-613). Also confirm how `useSpaceOwner` is called in this file:

```bash
grep -n "useSpaceOwner\|isSpaceOwner\|useInviteManagement" src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx | head -10
```

- If `useSpaceOwner` isn't imported, add it near the other imports:

```typescript
import { useSpaceOwner } from '../../../hooks/queries/spaceOwner';
```

- In the component body, near the other hooks (after `useRoleManagement` around line 174), add:

```typescript
const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
```

- Destructure the new values from `useInviteManagement`. Find the existing destructure and add `selectedRoleId, setSelectedRoleId` to it.

- Replace the `<Invites ... />` JSX (around line 597-613) with:

```tsx
<Invites
  space={space}
  selectedUser={selectedUser}
  setSelectedUser={setSelectedUser}
  manualAddress={manualAddress}
  setManualAddress={setManualAddress}
  resolvedUser={resolvedUser}
  getUserOptions={getUserOptions}
  sendingInvite={sendingInvite}
  invite={invite}
  success={success}
  membershipWarning={membershipWarning}
  generating={generating}
  generationSuccess={generationSuccess}
  errorMessage={errorMessage}
  setShowGenerateModal={setShowGenerateModal}
  isSpaceOwner={Boolean(isSpaceOwner)}
  roles={roles}
  selectedRoleId={selectedRoleId}
  setSelectedRoleId={setSelectedRoleId}
/>
```

Note: `roles` here comes from the existing `useRoleManagement` destructure. They should still reflect the current saved roles since `initialRoles` comes from `space?.roles`. If role edits are in an unsaved state inside `useRoleManagement`, you may prefer to read `space?.roles ?? []` directly for this picker to always show persisted roles only. Use `space?.roles ?? []` to avoid showing unsaved in-flight role edits.

- [ ] **Step 3: Typecheck and run dev build**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn build
```

Expected: clean.

- [ ] **Step 4: Manual smoke test**

Start the dev server:

```bash
yarn dev
```

Open the app, log in as a space owner, open Space Settings → Invites, confirm:
- The new "Assign Role (optional)" dropdown appears below the address entry
- It lists existing roles + a "No role" option
- Send an invite with a role selected; send another without. Neither should fail.

Open Space Settings → Invites as a non-owner (join a space owned by someone else), confirm the dropdown does NOT appear.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/Invites.tsx src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx
git commit -m "feat(invites): add role picker to send-invite UI"
```

---

## Phase 6 — Desktop: role application on join (owner-only)

### Task 8: Apply role on join event in MessageService

**File:** `d:\GitHub\Quilibrium\quorum-desktop\src\services\MessageService.ts` (around line 2876-2963)

This change runs inside the `join` handler and only executes on the owner's client. Ownership is determined by the presence of the owner private key in local storage (`messageDB.getSpaceKey(spaceId, 'owner')`), matching the app's existing ownership check pattern.

- [ ] **Step 1: Add the role-application block after the existing join logic**

Find the `if (envelope.message.type === 'join')` block (line 2848). Inside the success path after `this.addMessage(...)` on line 2960 but **before** the closing `}` of `if (result === 'true')` at line 2963, add the following:

```typescript
// Owner-only: apply pending role assignment if one matches this joiner.
try {
  const spaceIdForRole = conversationId.split('/')[0];
  const ownerKey = await this.messageDB.getSpaceKey(spaceIdForRole, 'owner');
  const spaceForRole = await this.messageDB.getSpace(spaceIdForRole);
  if (
    ownerKey &&
    spaceForRole?.pendingRoleInvites &&
    spaceForRole.pendingRoleInvites.length > 0
  ) {
    const pendingIdx = spaceForRole.pendingRoleInvites.findIndex(
      (p) => p.address === participant.address
    );
    if (pendingIdx !== -1) {
      const pending = spaceForRole.pendingRoleInvites[pendingIdx];
      const updatedRoles = spaceForRole.roles.map((role) => {
        if (!pending.roleIds.includes(role.roleId)) return role;
        if (role.members.includes(participant.address)) return role;
        return {
          ...role,
          members: [...role.members, participant.address],
        };
      });
      const updatedPending = spaceForRole.pendingRoleInvites.filter(
        (_, i) => i !== pendingIdx
      );
      const updatedSpace = {
        ...spaceForRole,
        roles: updatedRoles,
        pendingRoleInvites: updatedPending,
      };
      await this.messageDB.saveSpace(updatedSpace);
      queryClient.setQueryData(
        buildSpaceKey({ spaceId: spaceIdForRole }),
        updatedSpace
      );
      // Re-post manifest so other clients converge promptly.
      if (this.actionQueueService) {
        await this.actionQueueService.enqueue(
          'update-space',
          { spaceId: spaceIdForRole, space: updatedSpace },
          `space:${spaceIdForRole}`
        );
      }
    }
  }
} catch (err) {
  logger.error('Failed to apply pending role invite on join', err);
}
```

- [ ] **Step 2: Ensure `buildSpaceKey` is imported**

```bash
grep -n "buildSpaceKey" src/services/MessageService.ts | head -3
```

If it's not already imported, add to the imports at the top:

```typescript
import { buildSpaceKey } from '../hooks/queries/space/buildSpaceKey';
```

- [ ] **Step 3: Ensure `logger` is available**

```bash
grep -n "import.*logger" src/services/MessageService.ts | head -3
```

If missing, add:

```typescript
import { logger } from '@quilibrium/quorum-shared';
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "feat(roles): apply pendingRoleInvites on join event (owner-only)"
```

### Task 9: End-to-end manual verification of the send+join flow

- [ ] **Step 1: Build and run two app instances**

You need two browser profiles (or one browser + one Electron build) to simulate owner + joiner.

```bash
yarn dev
```

Open two profiles: Alice (owner) and Bob (joiner).

- [ ] **Step 2: Private-mode happy path**

On Alice:
1. Create a space (do NOT generate public link).
2. Create a role "Mod".
3. Open Space Settings → Invites.
4. Select Bob from "Existing Conversations" (have an existing DM with Bob first if needed).
5. Pick "Mod" from the role dropdown.
6. Click Send.

On Bob:
1. Open the DM with Alice.
2. Click the invite link.
3. Join.

Expected on Alice:
- Bob appears as a member with the "Mod" badge within seconds.
- Space Settings → Roles shows Bob in the "Mod" role's member list.

Expected on Bob (after the owner's manifest re-post propagates):
- "Mod" badge shows up next to his name.

- [ ] **Step 3: Public-mode happy path**

On Alice:
1. In the same or a new space, generate the public invite link.
2. Send a personal invite to Bob with the "Mod" role selected.
3. Observe that the send still succeeds and a pending entry is written.

On Bob:
1. Accept and join.

Expected: same outcome as private mode.

- [ ] **Step 4: Negative case — non-owner**

Have a third user Carol (member, non-owner) try to invite someone. Expected: no role picker visible.

- [ ] **Step 5: Send without role**

On Alice, send an invite without picking a role. Expected: Bob joins, no role applied, no pending entry written (verify via DevTools → IndexedDB → inspect the space record).

- [ ] **Step 6: Commit verification log**

No code changes — this task is verification. If any issue is found, return to Task 8 and fix. If all pass, mark this task complete.

---

## Phase 7 — Desktop: management panel

### Task 10: Build the `PendingRoleInvitesSection` component

**Files:**
- Create: `src/components/modals/SpaceSettingsModal/PendingRoleInvitesSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
import * as React from 'react';
import { Icon, Tooltip } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import type { PendingRoleInvite, Role } from '@quilibrium/quorum-shared';
import { getAddressSuffix } from '../../../utils';

interface PendingRoleInvitesSectionProps {
  pendingRoleInvites: PendingRoleInvite[];
  roles: Role[];
  onCancel: (address: string) => void;
}

const formatRelative = (ts: number): string => {
  const delta = Date.now() - ts;
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return t`just now`;
  if (mins < 60) return t`${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t`${hours}h ago`;
  const days = Math.floor(hours / 24);
  return t`${days}d ago`;
};

const PendingRoleInvitesSection: React.FC<PendingRoleInvitesSectionProps> = ({
  pendingRoleInvites,
  roles,
  onCancel,
}) => {
  if (!pendingRoleInvites.length) return null;

  const roleMap = new Map(roles.map((r) => [r.roleId, r]));

  return (
    <div className="mt-6">
      <div className="text-subtitle-2 mb-1">
        <Trans>Pending Role Invites</Trans>
      </div>
      <div className="text-label pt-1 mb-3 max-w-[500px]">
        <Trans>
          Users with pending role pre-assignments. The role applies when they join.
        </Trans>
      </div>
      <div className="border border-subtle rounded">
        {pendingRoleInvites.map((p) => (
          <div
            key={p.address}
            className="modal-list-item text-main px-3 py-3 flex items-center gap-3"
          >
            <div className="flex-1 flex flex-col">
              <div className="font-mono text-sm">
                {getAddressSuffix(p.address)}
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {p.roleIds.map((rid) => {
                  const role = roleMap.get(rid);
                  if (!role) return null;
                  return (
                    <span
                      key={rid}
                      className="font-mono modal-role text-xs"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.displayName}
                    </span>
                  );
                })}
              </div>
              <div className="text-xs text-muted mt-1">
                {formatRelative(p.createdAt)}
              </div>
            </div>
            <Tooltip
              id={`cancel-pending-role-${p.address}`}
              content={t`Cancel pending role assignment`}
              place="left"
              showOnTouch={false}
            >
              <Icon
                name="trash"
                className="cursor-pointer text-danger hover:text-danger-hover"
                onClick={() => onCancel(p.address)}
              />
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingRoleInvitesSection;
```

- [ ] **Step 2: Verify the `Icon` primitive has a `trash` icon and `Tooltip` supports `id/content/place`**

```bash
grep -n "name=\"trash\"\|Tooltip" src/components/modals/SpaceSettingsModal/Roles.tsx | head -5
```

Expected: same pattern is used in Roles.tsx around line 213-218.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/PendingRoleInvitesSection.tsx
git commit -m "feat(roles): add PendingRoleInvitesSection component"
```

### Task 11: Wire the section into Roles.tsx

**Files:**
- Modify: `src/components/modals/SpaceSettingsModal/Roles.tsx`
- Modify: `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`

- [ ] **Step 1: Extend `RolesProps` and render the section**

Edit `src/components/modals/SpaceSettingsModal/Roles.tsx`. Add to imports:

```typescript
import type { PendingRoleInvite } from '@quilibrium/quorum-shared';
import PendingRoleInvitesSection from './PendingRoleInvitesSection';
```

Update the `RolesProps` interface to add:

```typescript
pendingRoleInvites: PendingRoleInvite[];
onCancelPendingRoleInvite: (address: string) => void;
isSpaceOwner: boolean;
```

Update the `Role` type inside this file (currently at lines 7-13) to include `roleId` (already present in the shared type but the local copy omits it). Since this file uses its own `Role` type, import the shared one instead:

```typescript
import type { Permission, Role } from '@quilibrium/quorum-shared';
```

And remove the local `interface Role { ... }` definition (lines 7-13).

Destructure the new props inside the component signature. At the end of the return statement, just before the closing `</>`, add:

```tsx
{isSpaceOwner && (
  <PendingRoleInvitesSection
    pendingRoleInvites={pendingRoleInvites}
    roles={roles}
    onCancel={onCancelPendingRoleInvite}
  />
)}
```

- [ ] **Step 2: Wire the data in `SpaceSettingsModal.tsx`**

Near the other hook calls (after `useRoleManagement`, around line 174):

```typescript
const { pendingRoleInvites, cancelPendingRoleInvite } = usePendingRoleInvites({
  spaceId,
  space,
});
```

Add the import at the top:

```typescript
import { usePendingRoleInvites } from '../../../hooks/business/spaces/usePendingRoleInvites';
```

Update the `<Roles ... />` invocation (around line 534) to pass the new props:

```tsx
<Roles
  roles={roles}
  addRole={addRole}
  deleteRole={deleteRole}
  updateRoleTag={updateRoleTag}
  updateRoleDisplayName={updateRoleDisplayName}
  updateRolePermissions={updateRolePermissions}
  toggleRolePublic={toggleRolePublic}
  roleValidationError={roleValidationError}
  onSave={saveChanges}
  isSaving={isSaving}
  pendingRoleInvites={pendingRoleInvites}
  onCancelPendingRoleInvite={cancelPendingRoleInvite}
  isSpaceOwner={Boolean(isSpaceOwner)}
/>
```

Note: `isSpaceOwner` should already have been declared in Task 7 Step 2. If not, add it here.

- [ ] **Step 3: Typecheck and build**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn build
```

Expected: clean.

- [ ] **Step 4: Manual verification**

Start dev server:

```bash
yarn dev
```

As an owner:
1. Send an invite to Bob with a role.
2. Before Bob joins, open Space Settings → Roles.
3. Scroll down. Expected: "Pending Role Invites" section shows Bob's address + the role badge + "just now".
4. Click the trash icon. Expected: the entry disappears immediately (optimistic), and within seconds the manifest re-post completes.
5. Send again and this time let Bob join. Expected: entry disappears from the panel once Bob joins (via the join handler).

As a non-owner: the section should not render.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/Roles.tsx src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx
git commit -m "feat(roles): render pending role invites in Space Settings → Roles"
```

---

## Phase 8 — Verification + cleanup

### Task 12: Edge case verification

All of these should already work from earlier tasks, but explicitly walk through each.

- [ ] **Step 1: Re-invite same address with different role (overwrite)**

1. Owner sends invite to Bob with role "Mod".
2. Before Bob joins, owner sends another invite to Bob with role "Editor".
3. Inspect: the pending panel should show exactly one entry for Bob with role "Editor" (not two, not "Mod").
4. Bob joins. Expected: Bob has "Editor" role only.

- [ ] **Step 2: Kick with pending entry**

1. Owner sends invite to Bob with role.
2. Before Bob joins, owner (via Members UI) kicks Bob by address. (Note: the current kick UI may require Bob to be a member first — if so, skip this test, the underlying code is still correct.)
3. If the kick action is reachable, verify the pending entry is cleared.

- [ ] **Step 3: Public-link regeneration clears pending entries**

1. Owner sends invites with roles to Bob and Carol.
2. Before either joins, owner generates a new public invite link.
3. Expected: pending panel is now empty.

- [ ] **Step 4: Forwarded public invite**

1. Owner sends public invite with role to Bob.
2. Bob forwards the URL to Carol.
3. Carol joins first.
4. Expected: Carol joins without any role (her address is not in `pendingRoleInvites`). Bob's entry is still pending.
5. Bob joins later via the same URL.
6. Expected: Bob joins and gets the role.

- [ ] **Step 5: Send invite as non-owner (sanity check)**

As a regular member of a space (not the owner), verify that `messageDB.getSpaceKey(spaceId, 'owner')` returns falsy — the role-picker should not render and the pending-invite write should be skipped even if somehow triggered.

- [ ] **Step 6: Report any failures**

If any step fails, open a task doc under `.agents/bugs/` describing the issue and loop back to the relevant implementation task. If all pass, proceed.

### Task 13: Extract Lingui strings

- [ ] **Step 1: Run extraction**

```bash
yarn lingui extract
```

- [ ] **Step 2: Verify new strings appear in catalogs**

Grep for new strings in `src/locales/en/messages.po`:

```bash
grep -E "Assign Role|Pending Role Invites|just now|ago" src/locales/en/messages.po | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/
git commit -m "i18n: extract strings for invite-with-role UI"
```

### Task 14: Final typecheck, lint, build

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 2: Lint**

```bash
yarn lint
```

- [ ] **Step 3: Build**

```bash
yarn build
```

- [ ] **Step 4: If all pass, update task file footer**

```bash
python "$HOME/.config/.claude/skills/docs-manager/task-sync.py" \
  .agents/tasks/2026-04-20-invite-with-role-implementation.md \
  note "All phases complete, all verifications passed"
```

### Task 15: Prepare PR

- [ ] **Step 1: Review the commit log**

```bash
git log --oneline main..HEAD
```

Expected: one commit per task (roughly 13 commits).

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/invite-with-role
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base main --title "feat: attach a role to personal invites (#81)" --body "$(cat <<'EOF'
## Summary
- Space owners can pre-assign a role when sending a personal invite
- Role auto-applies when the invited user joins (works in both private and public invite modes)
- "Pending Role Invites" panel in Space Settings → Roles shows pre-assignments and lets owners cancel them
- Closes QuilibriumNetwork/quorum-desktop#81

## Design
See `.agents/tasks/2026-04-20-invite-with-role-design.md` and `2026-04-20-invite-with-role-implementation.md`.

Key property: roles only materialize from owner-signed data in the space manifest. The invite URL/crypto is untouched. Role grants are tied to the joiner's address, not to the specific URL.

## Depends on
- `@quilibrium/quorum-shared` PR adding `PendingRoleInvite` type (must be merged first)

## Test plan
- [ ] Private-mode invite with role → role applied on join
- [ ] Public-mode invite with role → role applied on join
- [ ] Send without role → normal join, no pending entry
- [ ] Re-invite same address with different role → old entry overwritten
- [ ] Cancel pending invite via panel → entry removed
- [ ] Kick user with pending entry → entry cleared
- [ ] Regenerate public link → all pending entries cleared
- [ ] Forwarded invite to different user → no role applied
- [ ] Non-owner doesn't see role picker or pending panel
EOF
)"
```

- [ ] **Step 4: Return PR URL to user**

---

*Last updated: 2026-04-20*
