/**
 * The instrument this refactor's second tranche exists to leave behind.
 *
 * The 24-row migration table that drove Phase D was built from "which files
 * import a name resolver" — so a file that never imported one (it just
 * rendered `member.display_name` or `currentPasskeyInfo.displayName`
 * straight from a query/prop, no resolver in sight) was invisible to that
 * table AND to the eslint ratchet that guards resolver imports. Two of that
 * exact class were found by the operator driving the app (a crashing modal,
 * a nav-rail tooltip showing the wrong name); the rest — the search hooks,
 * the moderation modals, `ConversationSettingsModal` — were found only by a
 * manual audit. This test is that audit, made permanent.
 *
 * WHAT IT SCANS: `src/components/**` and `src/hooks/business/**` — the
 * render + display-shaping layers, where every real defect in this class has
 * lived. Deliberately EXCLUDES `src/hooks/queries/**` and `src/hooks/mutations/**`
 * (the data-fetching boundary: a fetcher or query-key builder reading
 * `response.display_name` off a raw API/DB payload is the data layer doing
 * its job, exactly like `identityProvider.tsx`'s own internal reads — it is
 * not a RENDER, and there is nowhere else for that read to happen). Also
 * excludes `src/identity/**` itself (the one module allowed to own this) and
 * `src/components/primitives/**` (SCSS-only re-export shims, no logic).
 *
 * WHAT COUNTS AS AN OFFENSE: a file that (a) references one of the five raw
 * member-name fields (`displayName`, `primaryUsername`, `globalDisplayName`,
 * `display_name`, `primary_username`) as a plain identifier — a property
 * read (`x.displayName`) or a destructure (`{ displayName }`) — AND (b) does
 * NOT import anything from `src/identity`. Condition (b) is the load-bearing
 * half: a component that already imports `useResolvedName`/`<MemberName>`
 * and ALSO happens to have a prop or local named `displayName` (an avatar
 * receiving an already-resolved BARE name, say) is not the bug this exists
 * to catch — the bug is a raw field reaching the screen with NO resolver
 * anywhere in the file. This is why `UserAvatar.tsx` (receives an
 * already-resolved name as a prop, never looks anything up itself) is a
 * genuine exception below rather than something papered over by the import
 * check.
 *
 * HONESTY, NOT COVERAGE: this is a grep-shaped heuristic, not a type-aware
 * linter — it cannot tell a resolved local variable named `displayName` from
 * a raw prop of the same name inside a file that imports identity for an
 * unrelated reason, and it cannot see through a re-export or a renamed
 * import. It exists to make the CLASS of bug loud again, not to replace
 * review. Keep the exceptions list honest: every entry needs a one-line
 * reason a reviewer can check against the file, not a rubber stamp.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = process.cwd();
const SCAN_ROOTS = ['src/components', 'src/hooks/business'];
const EXCLUDE_DIR_PREFIXES = [
  'src/identity',
  'src/components/primitives',
];

const RAW_FIELD_PATTERN = /\b(displayName|primaryUsername|globalDisplayName|display_name|primary_username)\b/;
const IDENTITY_IMPORT_PATTERN =
  /from\s+['"]((?:\.\.?\/)*identity(?:\/[^'"]*)?|@\/identity(?:\/[^'"]*)?)['"]/;
// React's own devtools naming idiom (`SomeComponent.displayName = 'SomeComponent'`,
// for forwardRef/memo components to show a real name in devtools) has NOTHING
// to do with a member's name — it is common, grows over time as components are
// added, and would otherwise force a fresh one-line exception on every new
// forwardRef/memo component forever. Stripped before pattern-matching rather
// than exception-listed one file at a time.
const REACT_DEVTOOLS_DISPLAYNAME_ASSIGNMENT = /\b[\w.]+\.displayName\s*=\s*(['"])[^'"]*\1\s*;?/g;

function stripKnownNoise(source: string): string {
  return source.replace(REACT_DEVTOOLS_DISPLAYNAME_ASSIGNMENT, '');
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.[jt]sx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isExcluded(relPath: string): boolean {
  return EXCLUDE_DIR_PREFIXES.some(
    (prefix) => relPath === prefix || relPath.startsWith(prefix + '/'),
  );
}

/**
 * Files that DO match the raw-field pattern and DO NOT import `src/identity`.
 * Every entry needs a one-line reason, verified by reading the file, not
 * assumed. Two kinds of entry, both honest, neither a rubber stamp:
 *
 *  - GENUINE NON-OFFENDER: the field is not a member's rendered identity at
 *    all (a role name, a form editing your OWN profile, an already-resolved
 *    prop, a comment, a write/broadcast site, React's own devtools naming
 *    idiom that survived the strip above).
 *  - KNOWN, UNRESOLVED: a real instance of this bug class, found by this
 *    audit but left unfixed because it sits outside the current fix wave's
 *    assigned rows/findings. Listed here so the audit passes honestly
 *    instead of silently going green over a bug it just found. Each entry's
 *    reasoning is verified in-line, not deferred to an external report —
 *    stale "not verified this tranche, see report X" wording is exactly what
 *    the final fix wave (.superpowers/sdd/2026-08-10-identity-resolution-
 *    architecture-plan/final-fix-wave-report.md) replaced with concrete
 *    verdicts.
 */
const EXCEPTIONS: Record<string, string> = {
  // ---- Genuine non-offenders --------------------------------------------
  'src/components/context/MessageDB.tsx':
    'the storage/sync layer (MessageDBProvider): merges incoming broadcast profile updates into local Conversation/roster records and persists them — the WRITE side that PRODUCES the fields src/identity later reads, not a render. Renders no JSX for a member name.',
  'src/components/modals/NewDirectMessageModal.tsx':
    'WRITE site, not a render: seeds a brand-new Conversation row\'s displayName placeholder (the localized "Unknown User" literal) before any identity is known. This is one of the two canonical write sites `utils/identityPlaceholder.ts` documents by name (`realDisplayNameOrUndefined` exists specifically to demote this literal back to `undefined` at READ time) — verified false positive, task explicitly flagged this file for review.',
  'src/components/search/SearchResultItem.tsx':
    'receives an already-RESOLVED `displayName` string via `displayData` (computed by useBatchSearchResultsDisplay, which DOES import src/identity) — a pure presentational pass-through, same category as UserAvatar/NotificationItem.',
  'src/hooks/business/user/useVisibleSenderProfileFallback.ts':
    "already reviewed and extensively documented in-file by a prior tranche (Phase D rows 22-24 fix round 1): every REAL name-rendering consumer has migrated to src/identity; the one remaining `displayName` consumer is quorum-shared's `replaceMentionsWithDisplayNames` building a 'replying to' preview line, and `primaryUsername`/`globalDisplayName` feed `useMentionInput.ts`'s SEARCH matching (outside this migration's scope, cannot call a per-candidate hook in a loop). Not re-verified line-by-line this tranche; deferred to that existing documentation rather than re-litigated.",
  'src/components/user/UserAvatar/UserAvatar.web.tsx':
    'receives an already-resolved BARE name as a `displayName` prop (initials/color derivation only), never looks anything up itself.',
  'src/components/user/UserAvatar/UserAvatar.native.tsx':
    'same as the .web sibling — already-resolved prop, no lookup.',
  'src/components/Router/Router.web.tsx':
    'type-only: `displayName` is a field on the app-level `user` object threaded through as a prop to children; Router itself renders none of it.',
  'src/components/Router/Router.native.tsx':
    'same as the .web sibling — type-only pass-through.',
  'src/components/modals/ChannelEditorModal.tsx':
    '`role.displayName` is a ROLE name (mention-role option label), not a member name — out of scope per the recipe (role display names are not member names).',
  'src/components/modals/SpaceSettingsModal/Roles.tsx':
    'role EDITING form — `r.displayName` is the role being created/renamed, not a member.',
  'src/components/space/RolePreview.tsx':
    '`role.displayName` — role name, not a member name (the recipe names this file explicitly as an expected false positive).',
  'src/hooks/business/spaces/useRoleManagement.ts':
    'role editing form state (`updateRoleDisplayName`, role defaults) — role names, not member names.',
  'src/components/notifications/NotificationItem.tsx':
    "the file's own doc comment: `displayName: React.ReactNode // ... an identity-resolved <MemberName>, not a caller-formatted string` — already-resolved prop, verified in the component body.",
  'src/components/user/UserOnlineStateIndicator.tsx':
    'comment only ("Message users: Only have displayName/userIcon...") — no code reference to the field.',
  'src/hooks/business/user/useUserPublicProfile.ts':
    'comment only — no code reference to the field.',
  'src/components/onboarding/OnboardingFlow.tsx':
    "onboarding: the user's OWN display name, being entered for the first time — there is no public profile yet to resolve (chicken-and-egg, identity resolution needs an authenticated address first).",
  'src/components/onboarding/steps/CompleteStep.tsx':
    'onboarding step, same reasoning as OnboardingFlow.tsx.',
  'src/components/onboarding/steps/DisplayNameStep.tsx':
    "onboarding step — the INPUT FIELD for the user's own new display name, plus its live validation. Nothing to resolve; this is what they are typing.",
  'src/hooks/business/user/useOnboardingFlowLogic.ts':
    'onboarding flow state — same reasoning as the onboarding components above.',
  'src/hooks/business/user/useUnifiedOnboardingFlow.ts':
    'onboarding flow state — same reasoning.',
  'src/hooks/business/user/useAuthenticationFlow.ts':
    'builds the initial self user record straight from the passkey response during sign-in/sign-up, before any provider or public profile exists — the legitimate bootstrap source, not a render.',
  'src/components/modals/UserSettingsModal/General.tsx':
    "settings form editing YOUR OWN profile (display name + primary username fields) — the operator's explicit exception category.",
  'src/components/modals/UserSettingsModal/UserSettingsModal.tsx':
    'same settings-form category as General.tsx (the tab container/save logic).',
  'src/hooks/business/user/useUserSettings.ts':
    'business logic behind the self-settings form (General.tsx/UserSettingsModal.tsx) — editing your own profile.',
  'src/hooks/business/spaces/useSpaceProfile.ts':
    "the per-space profile EDIT form (analogous to General.tsx, scoped to one space) — editing your own space-level display name.",
  'src/components/user/UserProfileEdit.tsx':
    'self-profile edit form (mobile/native variant of the same settings flow).',
  'src/hooks/business/validation/errorTranslator.ts':
    'form-validation COPY for the display-name input field ("Display name is required", etc.) — strings about the field, not a rendered identity.',
  'src/hooks/business/validation/useDisplayNameValidation.ts':
    'validates the TEXT the user is typing into the display-name input — not a render of anyone\'s identity.',
  'src/hooks/business/spaces/useSpaceCreation.ts':
    'WRITE site: passes your own `currentPasskeyInfo.displayName` as an argument to the space-creation API call (establishing your initial profile in the new space) — a broadcast, not a render. Same category as NewDirectMessageModal.tsx (see identityPlaceholder.ts\'s documented write-site list).',
  'src/hooks/business/spaces/useSpaceLeaving.ts':
    'WRITE site: `updateUserProfile(currentPasskeyInfo.displayName ?? \'\', ...)` broadcasts your own profile when clearing a stale space tag — a broadcast, not a render.',
  'src/hooks/business/spaces/useSpaceTagStartupRefresh.ts':
    'WRITE site: same `updateUserProfile(currentPasskeyInfo.displayName ?? \'\', ...)` broadcast pattern as useSpaceLeaving.ts, on startup tag-refresh.',
  'src/hooks/business/user/useClearLegacySpaceOverrides.ts':
    'data CLEANUP/migration: clears stale `display_name`/`user_icon` roster overrides left by an old bug (writes them empty) — a write/migration, not a render.',
  'src/hooks/business/user/useReconcileSelfIdentity.ts':
    "self-repair infrastructure, not a render: its OWN doc comment documents that ~15 sites read `currentPasskeyInfo` for self-name and this hook exists to keep that LOCAL record less stale by repairing it from the synced config. It is evidence of the problem this refactor is fixing properly elsewhere (resolving through src/identity instead of currentPasskeyInfo at all), not an instance of rendering a raw field.",
  'src/components/ui/ContextMenu.tsx':
    "VERIFIED non-offender (final fix wave, finding 3): the 'user' header variant used to render `header.displayName || header.address.slice(0, 8)` — a raw caller-supplied name with a caller-owned fallback, fed by DirectMessageContactsList.tsx's `contextMenuContact.displayName` (which could literally be the stored placeholder \"Unknown User\"). Fixed: `displayName` is now a REQUIRED field on the 'user' header type, and its one caller (`DirectMessageContactsList.tsx`'s `contextMenuHeaderName`) resolves it via `useNameResolver().resolve()` before ever constructing the header. This file itself still doesn't import src/identity by design (kept as a dumb UI primitive) — same category as UserAvatar/NotificationItem: an already-resolved name arrives as a prop.",

  // ---- Genuine non-offenders, reclassified from KNOWN-UNRESOLVED this wave —
  // each independently re-verified (not deferred to a future tranche) -------
  'src/components/message/MessageList.tsx':
    "VERIFIED non-offender: `users[].displayName` flows into `useMentionInput.ts`'s `userMatchesQuery` — SEARCH matching only, the same already-accepted exception category as `useVisibleSenderProfileFallback.ts`'s `primaryUsername`/`globalDisplayName`. The rendered mention-option LABEL comes from `MentionDropdown.tsx`'s `<MemberName>` (`option.data.address`), never from this raw field. `mentionRoles[].displayName` is a ROLE name (same category as ChannelEditorModal.tsx/Roles.tsx above). `mapSenderToUser`'s `.displayName` is a type declaration only, forwarded unread to `<Message>` (already migrated, finding 1).",
  'src/hooks/business/channels/useChannelMessages.ts':
    "VERIFIED non-offender: `mapSenderToUser`'s `member` branch returns `members[senderId]` (raw roster row, `displayName` included) UNCHANGED — by its own doc comment this branch is not currently reachable (Channel.tsx's enriched `effectiveMembers` map covers every reachable sender first), kept correct only so a future direct consumer can't reintroduce the old defect by substituting a fallback. Correctly does NOT invent a fallback (rule 3) — nothing renders this field.",
  'src/hooks/business/conversations/useConversationPreviews.ts':
    'VERIFIED non-offender: the `primaryUsername` match is inside a COMMENT (historical staleness-trap note) — no executable reference to any of the five raw fields anywhere in the file.',
  'src/hooks/business/conversations/useConversationsWithProfileBackfill.ts':
    "VERIFIED non-offender: a WRITE-side backfill (persists `displayName`/`primaryUsername` to IndexedDB when a placeholder is still stored, parallel to `useClearLegacySpaceOverrides.ts`). Its one downstream read, `DirectMessageContact.tsx`'s `props.displayName`, is used ONLY as an existence flag (`props.displayName ? <address subtitle> : null`) per that file's own doc comment — never rendered as text. The rendered name there resolves via `useResolvedMemberName`, independent of this hook's output.",
  'src/hooks/business/identity/useLocalDmNames.ts':
    "the reusable SOURCE builder that feeds `IdentityScopeProvider.locallyKnownNames` (used by `useRootIdentityScope`, `SearchResults.tsx`, and `DirectMessageContactsList.tsx` via the exported `buildLocalDmNames`) — reads a local Conversation's raw `displayName` field and demotes it through `realDisplayNameOrUndefined` before it ever reaches `src/identity`, the same WRITE-adjacent role `identityProvider.tsx`'s own internal reads play and analogous to `useMultiSpaceRosters.ts`'s raw `display_name`/`global_display_name` roster reads for `rostersBySpace` (that file is exempt structurally, via a `RosterNameRow` type import from `src/identity`, for the identical substantive reason). Renders no JSX and resolves no name itself.",
  'src/hooks/business/mentions/useMentionPillEditor.ts':
    "VERIFIED non-offender: `buildPillData`'s `type: 'user'` branch resolves via `resolveName(option.data.address)` (the identity module, threaded in as a param — see `UseMentionPillEditorOptions.resolveName`). The one raw-looking neighbor, `option.data.displayName` for `type: 'role'`, is a ROLE label (`MentionOption`'s role variant), not a member name — same category as the other role-name exceptions above. `type: 'channel'` uses `channelName`, not a member field at all.",

  // ---- Known, unresolved — real instances of this bug class, confirmed by
  // this wave, deliberately left unfixed because they sit outside its 9
  // assigned findings. Each verdict below was independently re-checked, not
  // carried over from the prior tranche's wording. ------------------------
  'src/hooks/business/ui/useUserProfileModal.ts':
    "VERIFIED dead code: `UserProfileModalUser`'s `displayName`/`primaryUsername`/`globalDisplayName` fields are populated by every caller (Channel.tsx x2, Message.tsx, BookmarksPage.tsx) but `UserProfile.tsx` — the only consumer of `selectedUser` — resolves its own name via `useResolvedMemberName(props.user.address, ...)` and never reads `props.user.displayName` (confirmed: no other consumer of `userProfileModal.selectedUser` exists in src/). Left unfixed: deleting the fields requires touching every caller's object-literal construction, a larger blast radius than this wave's assigned rows.",
  'src/components/message/MessageComposer.native.tsx':
    "VERIFIED real bug, live production surface: this repo ships its own embedded Expo/React-Native app (`mobile/`), and Metro's platform-extension resolution means `.native.tsx` siblings ARE the mobile build's actual source, not dead weight (unlike `.native.tsx` files excluded from the WEB typecheck by tsconfig). `mapSenderToUser(inReplyTo.content.senderId).displayName` renders raw into the \"Replying to {user}\" reply-preview label — a mobile user sees the same class of forgeable/stale name Message.tsx's web reply-preview had (finding 1) before this wave's fix. Left unfixed: out of scope for a desktop-repo fix wave (native/Expo surface, no test harness set up for it here).",
  'src/hooks/business/channels/useChannelData.ts':
    "VERIFIED real bug: `generateVirtualizedUserList`'s member-sidebar SEARCH filter (`member.displayName?.toLowerCase().includes(term)`) matches only `curr.display_name` — the per-space OVERRIDE tier alone, no global-name or QNS fallback. A member with no per-space nickname (the default/common state, per this file's own avatar-ladder comment) has an EMPTY `displayName`, so the sidebar search can only find them by pasting their raw address, never by the global/QNS name `<MemberName>` visibly renders beside them (fixed for the AVATAR half of this same file's output in finding 2, but not this search path). Left unfixed: not named in this wave's 9 findings; flagged rather than silently patched.",
};
// NOTE (final fix wave): `useMessageActions.ts` and
// `src/components/modals/SpaceSettingsModal/Invites.tsx` were exception
// entries here before this wave (self-name bug, bookmark-write fallback, and
// a raw invite-picker avatar name, respectively — see findings 4, 5 and 9).
// Both now import `src/identity` directly and are no longer flagged by this
// audit's own heuristic, so their entries were REMOVED rather than reworded
// — keeping an entry a file no longer needs is a silent regression risk: if
// a future edit ever drops that import, the stale entry would keep
// suppressing the audit instead of catching the regression.

describe('raw member-name field audit — every render either imports src/identity or is a known exception', () => {
  const files = SCAN_ROOTS.flatMap((root) => walk(join(REPO_ROOT, root)))
    .map((abs) => toPosix(relative(REPO_ROOT, abs)))
    .filter((rel) => !isExcluded(rel))
    .sort();

  it('scanned a non-trivial number of files (the walker itself is not broken)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('every exception entry still exists on disk (no stale exceptions)', () => {
    for (const relPath of Object.keys(EXCEPTIONS)) {
      expect(
        () => readFileSync(join(REPO_ROOT, relPath), 'utf8'),
        `Exception lists ${relPath}, which no longer exists — remove the stale entry.`,
      ).not.toThrow();
    }
  });

  it('no file outside src/identity renders a raw member-name field without resolving through it', () => {
    const offenders: string[] = [];

    for (const relPath of files) {
      const rawSource = readFileSync(join(REPO_ROOT, relPath), 'utf8');
      const source = stripKnownNoise(rawSource);
      if (!RAW_FIELD_PATTERN.test(source)) continue;
      if (IDENTITY_IMPORT_PATTERN.test(source)) continue;
      if (EXCEPTIONS[relPath]) continue;
      offenders.push(relPath);
    }

    expect(
      offenders,
      'The following files render a raw member-name field ' +
        '(displayName / primaryUsername / globalDisplayName / display_name / ' +
        'primary_username) with no import from src/identity, and are not on ' +
        'the exceptions list. Either migrate the file onto <MemberName> / ' +
        'useResolvedName (see .superpowers/sdd/2026-08-10-identity-resolution-' +
        'architecture-plan/phase-d-recipe.md), or — ONLY if it is a genuine ' +
        'non-offender (an avatar receiving an already-resolved name, a role ' +
        'name, pure data plumbing) — add it to EXCEPTIONS above with a ' +
        'one-line reason:\n' +
        offenders.map((f) => `  - ${f}`).join('\n'),
    ).toEqual([]);
  });
});
