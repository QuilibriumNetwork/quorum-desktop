---
type: task
title: "Public Invite Links Improvement Task"
status: done
created: 2026-01-09
updated: 2026-01-09
---

# Public Invite Links Improvement Task

Improve the public invite links feature in SpaceEditor to provide clearer UX with confirmation modals and actual enable/disable functionality. Currently, the toggle only shows/hides UI elements without actually enabling/disabling the public link functionality.

**Original Issue Reference:** https://quilibrium.slack.com/archives/C08SP1TUJHJ/p1754368782373349

---

## 🎯 **SIMPLIFIED APPROACH - NO TOGGLE**

**DECISION:** Remove the toggle completely for a much simpler, more maintainable solution.

### **Why No-Toggle is Better:**

- ✅ **Zero state conflicts** - No toggle visual state vs modal confirmation issues
- ✅ **Simple logic** - Only 2 UI states: "No Link" vs "Link Exists"
- ✅ **Clear user intent** - Buttons show direct actions, not feature enable/disable
- ✅ **Easier testing** - 3 scenarios instead of 6+ edge cases
- ✅ **Less code** - ~50% fewer state variables and logic branches

### **New User Flow:**

**WHEN NO LINK EXISTS:**

```
[Generate Public Invite Link] (button)
↓ click
Modal confirmation → Generate operation → Success callout → Link appears
```

**WHEN LINK EXISTS:**

```
[████████████████████] (clickable link field)
[Generate New Link] [Delete Public Link] (buttons)
```

**Generate New:** Modal → Hide old link → Spinner callout → New link + Success callout
**Delete:** Modal → Delete operation → Success callout → Back to "No Link" state

---

## IMPLEMENTATION - SIMPLIFIED APPROACH

### **Phase 1: Remove Toggle, Add Simple State Management**

```typescript
// REMOVE all toggle-related state:
// ❌ const [publicInvite, setPublicInvite] = useState(false);

// KEEP only essential state:
const [generating, setGenerating] = useState(false);
const [generationSuccess, setGenerationSuccess] = useState(false);
const [deleting, setDeleting] = useState(false);
const [deletionSuccess, setDeletionSuccess] = useState(false);
const [errorMessage, setErrorMessage] = useState('');

// Modal states
const [showGenerateModal, setShowGenerateModal] = useState(false);
const [showDeleteModal, setShowDeleteModal] = useState(false);
```

### **Phase 2: Simple UI Logic**

**Replace entire toggle section with:**

```typescript
<div>
  <div className="modal-text-label">
    <Trans>Public Invite Links</Trans>
  </div>

  {/* Callouts for operations */}
  {generating && (
    <Callout variant="warning" size="sm" className="mb-4">
      <div className="flex items-center gap-2">
        <Icon name="spinner" spin={true} className="text-warning" />
        <span>Generating public invite link...</span>
      </div>
    </Callout>
  )}

  {generationSuccess && (
    <Callout variant="success" size="sm" className="mb-4" autoClose={3}>
      <span>Public invite link generated successfully.</span>
    </Callout>
  )}

  {deleting && (
    <Callout variant="warning" size="sm" className="mb-4">
      <div className="flex items-center gap-2">
        <Icon name="spinner" spin={true} className="text-warning" />
        <span>Deleting public invite link...</span>
      </div>
    </Callout>
  )}

  {deletionSuccess && (
    <Callout variant="success" size="sm" className="mb-4" autoClose={3}>
      <span>Public invite link deleted successfully.</span>
    </Callout>
  )}

  {errorMessage && (
    <Callout variant="error" size="sm" className="mb-4">
      <span>{errorMessage}</span>
    </Callout>
  )}

  {!space.inviteUrl ? (
    // STATE 1: No link exists - Show generate button
    <div className="mt-4">
      <div className="text-sm text-subtle mb-4 max-w-[500px]">
        <Trans>
          Public invite links allow anyone with access to the link to join your Space.
          Consider who you share the link with and where you post it.
        </Trans>
      </div>
      <Button
        type="primary"
        onClick={() => setShowGenerateModal(true)}
        disabled={generating}
      >
        <Trans>Generate Public Invite Link</Trans>
      </Button>
    </div>
  ) : (
    // STATE 2: Link exists - Show link + action buttons
    <div className="mt-4">
      <div className="flex pt-2 pb-1 items-center">
        <div className="small-caps text-lg text-main">
          <Trans>Current Invite Link</Trans>
        </div>
        <Tooltip
          id="current-invite-link-tooltip"
          content={t`This link will not expire, but you can generate a new one at any time, which will invalidate the old link.`}
          place="bottom"
          className="!w-[400px]"
          maxWidth={400}
        >
          <Icon
            name="info-circle"
            className="text-main hover:text-strong cursor-pointer ml-2"
          />
        </Tooltip>
      </div>

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

      <div className="flex gap-2 mt-4">
        <Button
          type="danger"
          onClick={() => setShowDeleteModal(true)}
          disabled={generating || deleting}
        >
          <Trans>Disable Public Link</Trans>
        </Button>
        <Button
          type="primary"
          onClick={() => setShowGenerateModal(true)}
          disabled={generating || deleting}
        >
          <Trans>Generate New Link</Trans>
        </Button>
      </div>
    </div>
  )}
</div>
```

### **Phase 3: Simple Modal Confirmations**

```typescript
{/* Generate/Regenerate Modal */}
<ConfirmationModal
  visible={showGenerateModal}
  title={!space.inviteUrl ? "Generate Public Invite Link" : "Generate New Public Invite Link"}
  message={
    !space.inviteUrl
      ? "Are you sure you want to generate a public invite link?\nThis will allow anyone with access to the link to join your Space."
      : "Are you sure you want to generate a new public invite link?\nAnyone with your old public invite link won't be able to join your Space anymore."
  }
  confirmText="Confirm"
  variant="danger"
  showProtip={false}
  onConfirm={handleGenerateLink}
  onCancel={() => setShowGenerateModal(false)}
/>

{/* Delete Modal */}
<ConfirmationModal
  visible={showDeleteModal}
  title="Delete Public Invite Link"
  message="Are you sure you want to delete the public invite link?\nAnyone with your current public invite link won't be able to join your Space anymore."
  confirmText="Delete"
  variant="danger"
  showProtip={false}
  onConfirm={handleDeleteLink}
  onCancel={() => setShowDeleteModal(false)}
/>
```

### **Phase 4: Simple Handler Functions**

```typescript
const handleGenerateLink = async () => {
  setShowGenerateModal(false);

  try {
    setErrorMessage('');
    setGenerating(true);

    await generateNewInviteLink();

    // Show success
    setGenerationSuccess(true);
    setTimeout(() => setGenerationSuccess(false), 3000);
  } catch (error) {
    console.error('Failed to generate invite link:', error);
    setErrorMessage('Failed to generate public invite link. Please try again.');
  } finally {
    setGenerating(false);
  }
};

const handleDeleteLink = async () => {
  setShowDeleteModal(false);

  try {
    setErrorMessage('');
    setDeleting(true);

    await updateSpace({
      ...space,
      inviteUrl: '',
      isPublic: false,
    });

    // Show success
    setDeletionSuccess(true);
    setTimeout(() => setDeletionSuccess(false), 3000);
  } catch (error) {
    console.error('Failed to delete invite link:', error);
    setErrorMessage('Failed to delete public invite link. Please try again.');
  } finally {
    setDeleting(false);
  }
};
```

### **Phase 5: Testing Scenarios**

1. **Generate First Link:**
   - Click "Generate Public Invite Link" → Modal → Confirm → Link appears with buttons

2. **Generate New Link:**
   - Click "Generate New Link" → Modal → Confirm → Old link replaced with new link

3. **Delete Link:**
   - Click "Delete Public Link" → Modal → Confirm → Link removed, back to generate button

4. **Modal Cancellation:**
   - Any modal → Cancel → No changes made

5. **Error Handling:**
   - Operation fails → Error callout shown → Can retry

---

## **COMPARISON: Toggle vs Button-Only**

| **Metric**          | **Toggle Approach**          | **Button-Only Approach** |
| ------------------- | ---------------------------- | ------------------------ |
| **State Variables** | 10+ variables                | 5 variables              |
| **Logic Conflicts** | 8 critical issues            | 0 conflicts              |
| **Code Lines**      | ~300 lines                   | ~150 lines               |
| **Edge Cases**      | 6+ scenarios                 | 2 simple states          |
| **User Clarity**    | "Enable feature" (confusing) | "Perform action" (clear) |
| **Maintenance**     | High complexity              | Low complexity           |

**RECOMMENDATION:** 🎯 **Use Button-Only Approach** - 50% less code, zero logic conflicts, much clearer UX.

---

## Files to Modify

**`src/components/space/SpaceEditor.tsx`**

- Remove toggle section (lines ~930-1010)
- Replace with simplified button-only implementation above
- Add new imports: `import { Callout } from '../primitives';`

## Dependencies & Imports

```typescript
// SpaceEditor.tsx already has:
import ConfirmationModal from '../modals/ConfirmationModal'; ✅
import { useInviteManagement } from '../../hooks'; ✅

// ADD these imports:
import { Callout } from '../primitives'; // For loading/success callouts
```

---

**Last Updated:** 2025-09-14
**Implementation Status:** ✅ **READY - SIMPLIFIED BUTTON-ONLY APPROACH**
