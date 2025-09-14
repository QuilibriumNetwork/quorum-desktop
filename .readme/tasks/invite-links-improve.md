# Public Invite Links Improvement Task


Improve the public invite links feature in SpaceEditor to provide clearer UX with confirmation modals and actual enable/disable functionality. Currently, the toggle only shows/hides UI elements without actually enabling/disabling the public link functionality.

**Original Issue Reference:** https://quilibrium.slack.com/archives/C08SP1TUJHJ/p1754368782373349

## Technical Analysis Summary

### Current System Behavior
- **Toggle**: Only changes local UI state (`publicInvite`), doesn't persist to database
- **`space.isPublic`**: Database property but not updated by toggle (BUG)
- **`space.inviteUrl`**: Contains the actual invite link, controls functionality
- **Generate Button**: Creates new cryptographic keys and invite URL

### Confirmed Capabilities
✅ **Can disable public links**: Setting `space.inviteUrl = ''` invalidates all existing public invite links
✅ **Can generate new links**: Existing `generateNewInviteLink()` function works correctly
✅ **Can update space properties**: `updateSpace()` function can persist changes

## Implementation Plan

### Phase 1: Update Toggle Behavior

**File:** `src/components/space/SpaceEditor.tsx`

#### 1.1 Change Toggle Message
- **Current:** "Public invite links allow anyone with access to the link join your Space. Understand the risks of enabling this, and to whom and where you share the link."
- **New:** "Enable public invite link" (use text-main for text color)

#### 1.2 Replace Direct Toggle with Modal Triggers
```typescript
// Remove direct state change:
<Switch onChange={setPublicInvite} value={publicInvite} />

// Replace with modal triggers:
<Switch
  onChange={(value) => {
    if (value) {
      setShowEnableModal(true);
    } else {
      setShowDisableModal(true);
    }
  }}
  value={publicInvite}
/>
```

#### 1.3 Add Modal State Management
```typescript
const [showEnableModal, setShowEnableModal] = useState(false);
const [showDisableModal, setShowDisableModal] = useState(false);
const [showGenerateModal, setShowGenerateModal] = useState(false);
```

### Phase 2: Implement Confirmation Modals

#### 2.1 Enable Confirmation Modal
```typescript
<ConfirmationModal
  visible={showEnableModal}
  title="Enable Public Invite Link"
  message="Are you sure you want to enable the public invite link?\nThis will allow anyone with access to the link to join your Space. Consider who you share the link with and where you post it."
  confirmText="Confirm"
  variant="danger"
  showProtip={false}
  onConfirm={handleEnablePublicInvites}
  onCancel={() => setShowEnableModal(false)}
/>
```

#### 2.2 Disable Confirmation Modal
```typescript
<ConfirmationModal
  visible={showDisableModal}
  title="Disable Public Invite Link"
  message="Are you sure you want to disable the public invite link?\nAnyone with your old public invite link won't be able to join your Space anymore."
  confirmText="Confirm"
  variant="danger"
  showProtip={false}
  onConfirm={handleDisablePublicInvites}
  onCancel={() => setShowDisableModal(false)}
/>
```

#### 2.3 Generate New Link Confirmation Modal
```typescript
<ConfirmationModal
  visible={showGenerateModal}
  title="Generate New Public Invite Link"
  message="Are you sure you want to generate a new public invite link?\nAnyone with your old public invite link won't be able to join your Space anymore."
  confirmText="Confirm"
  variant="danger"
  showProtip={false}
  onConfirm={handleGenerateNewLink}
  onCancel={() => setShowGenerateModal(false)}
/>
```

### Phase 3: Implement Modal Actions

**Key UX Principle:** Modal closes immediately after confirmation, then operation runs in background with loading states and errors shown in main SpaceEditor modal.

#### 3.1 Add State Management for Enhanced UX
```typescript
const [errorMessage, setErrorMessage] = useState('');
const [generating, setGenerating] = useState(false);
const [generationSuccess, setGenerationSuccess] = useState(false);
const [deleting, setDeleting] = useState(false);
const [deletionSuccess, setDeletionSuccess] = useState(false);
```

#### 3.2 Handle Enable Public Invites (With Enhanced Loading States)
```typescript
const handleEnablePublicInvites = async () => {
  setShowEnableModal(false); // Close modal immediately

  try {
    setErrorMessage(''); // Clear previous errors

    if (!space.inviteUrl || space.inviteUrl === '') {
      // No existing invite link - generate new one automatically
      setGenerating(true); // Show warning callout with spinner
      await generateNewInviteLink();

      // Show success message
      setGenerationSuccess(true);
      setTimeout(() => setGenerationSuccess(false), 3000); // Auto-hide after 3s
    }

    setPublicInvite(true);

  } catch (error) {
    console.error('Failed to enable public invites:', error);
    setErrorMessage('Failed to enable public invite link. Please try again.');
    setPublicInvite(false); // Revert toggle state on error
  } finally {
    setGenerating(false);
  }
};
```

#### 3.3 Handle Disable Public Invites (With Enhanced Loading States)
```typescript
const handleDisablePublicInvites = async () => {
  setShowDisableModal(false); // Close modal immediately

  try {
    setErrorMessage(''); // Clear previous errors
    setDeleting(true); // Show warning callout with spinner

    setPublicInvite(false);

    // CRITICAL: Actually delete/invalidate the invite link
    await updateSpace({
      ...space,
      inviteUrl: '', // This makes ALL existing public invite links invalid
    });

    // Show success message
    setDeletionSuccess(true);
    setTimeout(() => setDeletionSuccess(false), 3000); // Auto-hide after 3s

    console.log('Public invite links have been disabled and invalidated');

  } catch (error) {
    console.error('Failed to disable public invites:', error);
    setErrorMessage('Failed to disable public invite link. Please try again.');
    setPublicInvite(true); // Revert toggle state on error
  } finally {
    setDeleting(false);
  }
};
```

#### 3.4 Handle Generate New Link (Streamlined)
```typescript
const handleGenerateNewLink = async () => {
  setShowGenerateModal(false); // Close modal immediately

  try {
    setErrorMessage(''); // Clear previous errors
    setGenerating(true); // Show warning callout with spinner

    await generateNewInviteLink();

    // Show success message
    setGenerationSuccess(true);
    setTimeout(() => setGenerationSuccess(false), 3000); // Auto-hide after 3s

    console.log('New public invite link generated, old link invalidated');

  } catch (error) {
    console.error('Failed to generate new invite link:', error);
    setErrorMessage('Failed to generate new invite link. Please try again.');
  } finally {
    setGenerating(false);
  }
};
```

#### 3.5 Add Enhanced Callout Messages in Main Modal
```typescript
// Add this in the SpaceEditor modal, above the toggle section
// Import: import { Icon } from '../primitives';

{/* Link generation loading */}
{generating && (
  <Callout variant="warning" size="sm" className="mb-4">
    <div className="flex items-center gap-2">
      <Icon name="spinner" spin={true} className="text-warning" />
      <span>Generating new public invite link...</span>
    </div>
  </Callout>
)}

{/* Link generation success */}
{generationSuccess && (
  <Callout variant="success" size="sm" className="mb-4" autoClose={3}>
    <div className="flex items-center gap-2">
      <Icon name="check-circle" className="text-success" />
      <span>Public invite link generated successfully.</span>
    </div>
  </Callout>
)}

{/* Link deletion loading */}
{deleting && (
  <Callout variant="warning" size="sm" className="mb-4">
    <div className="flex items-center gap-2">
      <Icon name="spinner" spin={true} className="text-warning" />
      <span>Disabling public invite link...</span>
    </div>
  </Callout>
)}

{/* Link deletion success */}
{deletionSuccess && (
  <Callout variant="success" size="sm" className="mb-4" autoClose={3}>
    <div className="flex items-center gap-2">
      <Icon name="check-circle" className="text-success" />
      <span>Public invite link has been disabled successfully.</span>
    </div>
  </Callout>
)}

{/* Error state */}
{errorMessage && (
  <Callout variant="error" size="sm" className="mb-4">
    <div className="flex items-center gap-2">
      <Icon name="exclamation-triangle" className="text-error" />
      <span>{errorMessage}</span>
    </div>
  </Callout>
)}
```

### Phase 4: Update Generate Button Behavior & Remove Old Loading States

**File:** `src/components/space/SpaceEditor.tsx`

#### 4.1 Remove Old Loading States from UI
**Remove these elements from the current code:**
- ❌ Remove: `{generating ? (loading message) : (normal link)}` from link field
- ❌ Remove: `disabled={generating}` from button
- ❌ Remove: `{generating ? t'Generating link...' : <Trans>Generate New Invite Link</Trans>}` from button text

#### 4.2 Updated Generate Button (Clean & Simple)
```typescript
{/* Only show Generate button AFTER link exists */}
{publicInvite && space.inviteUrl && (
  <div>
    {/* Current Invite Link Display - NO loading states here */}
    <ClickToCopyContent
      text={space.inviteUrl}
      tooltipText={t`Copy invite link to clipboard`}
      className="bg-input border-0 rounded-md px-3 py-1.5 text-sm w-full max-w-full overflow-hidden whitespace-nowrap cursor-pointer"
      iconClassName="text-muted hover:text-main"
      copyOnContentClick
    >
      <div className="flex items-center gap-2 w-full">
        <div className="truncate flex-1 text-subtle">
          {space.inviteUrl}
        </div>
      </div>
    </ClickToCopyContent>

    {/* Generate Button - Clean, no loading states */}
    <div className="mt-4 flex flex-row">
      <Button
        type="danger"
        onClick={() => setShowGenerateModal(true)}
      >
        <Trans>Generate New Invite Link</Trans>
      </Button>
    </div>
  </div>
)}
```

#### 4.3 Key Changes from Current Code
- **Button Purpose**: Now used ONLY to regenerate existing links (not initial creation)
- **Button Visibility**: Only appears when `space.inviteUrl` exists
- **Loading States**: Moved to Callout messages, removed from button/link field
- **Cleaner Logic**: No complex conditional rendering in the link display area

### Phase 5: Public Invite Link Deletion - Technical Details

**How Public Invite Link Deletion Works:**

#### Current System (Only Deletion by Replacement):
- **Generate New Link** → `space.inviteUrl` gets overwritten with new URL
- **Old Link Result** → Becomes invalid because configKey no longer matches

#### New System (Actual Deletion):
- **Toggle OFF** → `space.inviteUrl` gets set to empty string `''`
- **Link Validation Check** → Code checks: `if (!space.inviteUrl || space.inviteUrl == '')`
- **Result** → All existing public invite links throw `Error('invalid link')`

#### Technical Implementation:
```typescript
// In handleDisablePublicInvites():
await updateSpace({
  ...space,
  inviteUrl: '', // This is the actual deletion mechanism
});

// When someone tries to use old link:
// 1. parseInviteLink() extracts spaceId and configKey from URL ✅
// 2. validateInvite() calls apiClient.getSpaceManifest(spaceId) ✅
// 3. Server returns space data with inviteUrl: '' ✅
// 4. Validation logic: if (!space.inviteUrl || space.inviteUrl == '') ✅
// 5. Throws Error('invalid link') ✅ LINK DISABLED
```

#### Why This Works:
- **Database Layer**: `messageDB.saveSpace(space)` persists empty `inviteUrl`
- **API Layer**: `apiClient.postSpaceManifest()` updates server with empty URL
- **Validation Layer**: Invite validation explicitly checks for empty URLs
- **Result**: Complete invalidation of all existing public invite links

#### No Space Management Changes Needed:
The `useSpaceManagement.ts` file doesn't need `isPublic` persistence because:
- UI condition will be: `{publicInvite && space.inviteUrl && (`
- Only `space.inviteUrl` controls actual functionality
- `isPublic` field becomes redundant for this feature

### Phase 6: Update UI Display Logic

**File:** `src/components/space/SpaceEditor.tsx`

Current condition that gates invite link display:
```typescript
{space?.isPublic && publicInvite && (
```

Should be updated to rely primarily on local state:
```typescript
{publicInvite && space.inviteUrl && (
```

This ensures the UI shows invite links when toggle is on and links exist, regardless of the persistent `isPublic` flag.

**Why This Change is Necessary:**
- `publicInvite` = Current toggle state (local UI state)
- `space.inviteUrl` = Actual functional control (persisted)
- When toggling OFF: `publicInvite = false` + `space.inviteUrl = ''` → Nothing shows
- When toggling ON: `publicInvite = true` + `space.inviteUrl` populated → Link shows

## Testing Strategy

### Manual Testing Scenarios

1. **Enable Public Invites (No Existing Link):**
   - Toggle ON → Modal appears → Confirm → New link generated automatically
   - Verify: `space.inviteUrl` populated, `space.isPublic = true`, UI shows link

2. **Enable Public Invites (Existing Link):**
   - Toggle ON → Modal appears → Confirm → Existing link displayed
   - Verify: No new generation, existing `space.inviteUrl` preserved

3. **Disable Public Invites:**
   - Toggle OFF → Modal appears → Confirm → Link invalidated
   - Verify: `space.inviteUrl = ''`, `space.isPublic = false`, old links don't work

4. **Generate New Link:**
   - Click button → Modal appears → Confirm → New link generated
   - Verify: `space.inviteUrl` updated, old links don't work, new link works

5. **Modal Cancellation:**
   - For all modals: Cancel should revert toggle state and close modal

### Integration Testing

1. **Link Validation:** Confirm disabled links return "invalid link" errors
2. **Persistence:** Verify changes survive app restart
3. **Multi-device:** Ensure changes sync across devices (if applicable)

## Edge Cases & Error Handling

### Error Scenarios
1. **Network failure during link generation**
2. **Database save failure**
3. **Cryptographic key generation failure**

### Proposed Error Handling
```typescript
catch (error) {
  console.error('Operation failed:', error);
  // Revert UI state
  setPublicInvite(!publicInvite);
  // Show error toast/message
  // Keep modal open to allow retry
}
```

## Files to Modify

1. **`src/components/space/SpaceEditor.tsx`**
   - Update toggle behavior
   - Add confirmation modals
   - Implement modal action handlers
   - Update UI display logic

2. **`src/hooks/business/spaces/useSpaceManagement.ts`**
   - Fix missing `isPublic` persistence bug

## Dependencies & Imports

### New Imports Needed
```typescript
// SpaceEditor.tsx already has:
import ConfirmationModal from '../modals/ConfirmationModal'; ✅

// ADD these imports:
import { Icon, Callout } from '../primitives'; // For enhanced loading states
```

### Existing APIs Used
- `updateSpace()` from MessageDB context ✅
- `generateNewInviteLink()` from useInviteManagement ✅
- `ConfirmationModal` component ✅

## Accessibility Considerations

1. **Modal Focus Management:** ConfirmationModal handles this automatically
2. **Keyboard Navigation:** Ensure modals work with keyboard-only navigation
3. **Screen Readers:** Modal titles and messages should be descriptive

## Security Considerations

1. **Link Invalidation:** Clearing `space.inviteUrl` properly invalidates links
2. **Key Regeneration:** New cryptographic keys generated for each new link
3. **No Persistent Ban List:** Note that kicked users can rejoin via new public links

## Performance Considerations

1. **Cryptographic Operations:** Link generation involves crypto operations (~200ms delay)
2. **Database Operations:** Space updates require local DB writes and API calls
3. **UI Responsiveness:** Modal confirmations prevent accidental operations

## Future Enhancements (Out of Scope)

1. **Ban List:** Prevent kicked users from rejoining via public links
2. **Link Expiration:** Add time-based link expiration
3. **Usage Analytics:** Track public link usage statistics
4. **Link Customization:** Allow custom invite link formats

## Summary of Key Improvements

### **UX Enhancements:**
✅ **Clean Separation**: Confirmation modals only confirm, operations happen in background
✅ **Visual Feedback**: Warning Callouts with spinners for loading, Success Callouts for completion
✅ **Error Handling**: User-friendly error messages with icons, automatic state reversion
✅ **Progressive Disclosure**: Generate button only appears after links exist
✅ **Auto-dismiss**: Success messages disappear automatically after 3 seconds

### **Technical Improvements:**
✅ **Actual Functionality**: Toggle now actually enables/disables links (not just UI)
✅ **Link Invalidation**: Setting `space.inviteUrl = ''` completely disables existing links
✅ **Simplified State**: Removed unnecessary `isPublic` persistence logic
✅ **Consistent Loading**: Same Callout pattern for all operations (generate/delete)
✅ **Proper Error Handling**: State reversion on failures, user-friendly messages

### **Removed Complexity:**
❌ **Old Loading States**: Removed button loading text and field loading messages
❌ **Mixed Concerns**: Separated confirmation from execution
❌ **Complex Conditionals**: Simplified button and link display logic
❌ **Console-only Errors**: All errors now have user-facing messages

**Result**: A much cleaner, more intuitive public invite links feature with proper loading states and actual enable/disable functionality.

---

**Last Updated:** 2025-09-14
**Implementation Ready:** ✅
