/**
 * errorKey → Lingui string translator for validation hooks.
 *
 * Shared validators (`@quilibrium/quorum-shared`) return
 * `FieldValidationResult` with `errorKey` codes. This module is the
 * single place desktop maps those codes to translated user-facing
 * strings via Lingui.
 *
 * Each key maps to a function that accepts the validator's `errorVars`
 * and returns a Lingui-translated string. Adding a new shared validator
 * means adding entries here for its error keys.
 */

import { t } from '@lingui/core/macro';
import type { FieldValidationResult } from '@quilibrium/quorum-shared';

type Vars = Record<string, string | number> | undefined;

const messages: Record<string, (vars: Vars) => string> = {
  // Space name
  'spaceName.required': () => t`Space name is required`,
  'spaceName.tooShort': (vars) => t`Space name must be at least ${vars!.min} characters`,
  'spaceName.tooLong': (vars) => t`Space name must be ${vars!.max} characters or less`,
  'spaceName.invalidChars': () => t`Space name cannot contain special characters`,

  // Space description
  'spaceDescription.invalidChars': () => t`Description cannot contain special characters`,
  'spaceDescription.tooLong': (vars) => t`Description must be ${vars!.max} characters or less`,

  // Display name
  'displayName.required': () => t`Display name is required`,
  // Bio and display name are byte-limited (Farcaster USER_DATA), not
  // character-limited. A byte count is meaningless to show a user, so the
  // message is intentionally generic with no number.
  'displayName.tooLong': () => t`Display name is too long`,
  'displayName.reservedMention': () => t`This name conflicts with mention keywords.`,
  'displayName.reservedImpersonation': () => t`Names resembling admin, moderator, or support are reserved.`,
  'displayName.invalidChars': () => t`Display name cannot contain special characters`,

  // Channel name
  'channelName.required': () => t`Channel name is required`,
  'channelName.tooLong': (vars) => t`Channel name must be ${vars!.max} characters or less`,
  'channelName.invalidChars': () => t`Channel name cannot contain special characters`,

  // Channel topic
  'channelTopic.tooLong': (vars) => t`Channel topic must be ${vars!.max} characters or less`,
  'channelTopic.invalidChars': () => t`Channel topic cannot contain special characters`,

  // Group name
  'groupName.required': () => t`Group name is required`,
  'groupName.tooLong': (vars) => t`Group name must be ${vars!.max} characters or less`,
  'groupName.invalidChars': () => t`Group name cannot contain special characters`,

  // Device name
  'deviceName.required': () => t`Device name cannot be empty`,
  'deviceName.tooLong': (vars) => t`Device name must be ${vars!.max} characters or less`,
  'deviceName.invalidChars': () => t`Device name cannot contain HTML`,
  'deviceName.invalidCharset': () => t`Device name can only contain letters, numbers, spaces, hyphens, and parentheses`,

  // User bio
  'userBio.invalidChars': () => t`Bio cannot contain special characters`,
  'userBio.tooLong': () => t`Bio is too long`,

  // User note
  'userNote.invalidContent': () => t`Note contains invalid content`,
  'userNote.tooLong': (vars) => t`Note must be ${vars!.max} characters or less`,
};

/**
 * Translate a single `FieldValidationResult` to either `undefined`
 * (when valid) or the localized error string. Used by single-result
 * validators (channel/space/display/group/device).
 */
export function translateValidationResult(
  result: FieldValidationResult
): string | undefined {
  if (result.ok) return undefined;
  const translator = messages[result.errorKey];
  if (!translator) {
    // Fail-secure: return the raw errorKey so the UI shows something
    // identifiable rather than blank text. Should never happen in
    // practice — every shared errorKey has a desktop mapping.
    return result.errorKey;
  }
  return translator(result.errorVars);
}

/**
 * Translate an array of results (multi-violation validators like bio
 * and description) to an array of localized strings. Already-valid
 * entries are filtered out.
 */
export function translateValidationResults(
  results: FieldValidationResult[]
): string[] {
  return results
    .map(translateValidationResult)
    .filter((s): s is string => s !== undefined);
}
