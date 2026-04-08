---
type: bug
title: "SpaceMember field name mismatch between MessageDB and quorum-shared"
status: open
priority: medium
ai_generated: true
created: 2026-04-08
updated: 2026-04-08
---

# SpaceMember field name mismatch between MessageDB and quorum-shared

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

The `saveSpaceMember`, `getSpaceMember`, and `getSpaceMembers` methods in `src/db/messages.ts` cannot use the shared `SpaceMember` type from `@quilibrium/quorum-shared` because the field names differ:

| Concept | Local DB / IndexedDB schema | Shared `SpaceMember` type |
|---|---|---|
| User address | `user_address` | `address` (via `UserProfile`) |
| Avatar URL | `user_icon` | `profile_image` (via `UserProfile`) |
| Display name | `display_name` | `display_name` (matches) |
| Inbox address | `inbox_address` | `inbox_address` (matches) |

This forces `messages.ts` to maintain its own inline type definitions that duplicate the shared type with different field names. Any future shared type additions (like `joinedAt`) require manually mirroring the field in the local inline type.

Discovered during the new-member-badge implementation (2026-04-08) when attempting to use `SpaceMember` directly as the `saveSpaceMember` parameter type caused ~20 type errors across the codebase.

## Root Cause

The IndexedDB `space_members` object store was defined with snake_case field names (`user_address`, `user_icon`) that don't match the `UserProfile` base type in quorum-shared (`address`, `profile_image`). The two schemas evolved independently.

Key files:
- `src/db/messages.ts:1060-1115` — `saveSpaceMember`, `getSpaceMember`, `getSpaceMembers` with inline types
- `node_modules/@quilibrium/quorum-shared/src/types/user.ts:75-88` — `UserProfile` and `SpaceMember` definitions

## Solution

Two options, in order of preference:

1. **Update the shared type** — Add `user_address` and `user_icon` as aliases (or rename `address` / `profile_image`) in `quorum-shared` to match the DB schema. Lower risk since the DB schema is the source of truth on both desktop and mobile.

2. **Migrate the IndexedDB schema** — Add an IndexedDB migration to rename the fields to match the shared type. Higher risk (requires schema version bump, migration logic, coordinating with mobile).

Whichever approach is chosen, the inline types in `messages.ts` should be replaced with the shared `SpaceMember` type to eliminate duplication.

## Prevention

When extending `SpaceMember` or `UserProfile` in quorum-shared, verify that field names match what is stored in IndexedDB on both platforms before publishing. Consider adding a type-level test that compares the shared type against the DB schema fields.
