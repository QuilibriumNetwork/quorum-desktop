---
type: task
title: Multi-User Invite Selection Enhancement
status: in-progress
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Multi-User Invite Selection Enhancement

> **⚠️ AI-Generated**: May contain errors. Verify before use.

Implemneted by Tyler?

## Overview

Enhance the Space Settings invite modal to support sending invites to multiple users at once through:
1. **Multi-select dropdown** from existing conversations
2. **Comma-separated manual addresses** in the text input field
3. **Combined selection** allowing both methods together

This improves user experience when inviting several people to a space by reducing repetitive actions.

## Current Behavior

**File**: `src/components/modals/SpaceSettingsModal/Invites.tsx`

- Single-user selection from existing conversations dropdown
- Single address input for manual entry
- Send Invite button processes one user at a time
- Requires multiple clicks to invite several users

**Current User Flow**:
1. Open Space Settings → Invites tab
2. Select one conversation OR enter one manual address
3. Click Send Invite (waits for completion)
4. Repeat steps 2-3 for each additional user

## Desired Behavior

- **Multi-select dropdown** from existing conversations
- **Batch invite processing** with progress indication
- **Result summary** showing successes/failures
- **Maintained single manual address** input (separate from multi-select)

**New User Flow**:
1. Open Space Settings → Invites tab
2. Select multiple conversations from dropdown
3. Click "Send Invites (N)" button
4. See progress indicator and results summary

## Technical Feasibility

### ✅ UI Component Support

The Select primitive (`src/components/primitives/Select`) **fully supports multi-select**:

- `multiple={true}` prop enables multi-selection
- `value: string | string[]` handles arrays
- Built-in "Select All" / "Clear All" functionality
- Chip-based display for selected items
- Checkboxes alongside options

### ✅ Backend Compatibility

The invite system supports multiple invites through sequential processing:

**Private Invites**:
- Each invite consumes one secret from finite `evals` array
- Multiple invites = multiple secrets consumed
- **Risk**: Large batches may exhaust secret pool quickly

**Public Invites**:
- All invites send the same public URL
- Unlimited capacity (no secret consumption)
- **Behavior**: Same link distributed to all recipients

### ⚠️ Current Limitations

**Single-User Architecture**: The entire invite chain processes one address at a time:

- `useInviteManagement.invite(address: string)` - single address only
- `InvitationService.sendInviteToUser(address, ...)` - single user per call
- UI state tracks single `selectedUser` object

## Implementation Plan

### Phase 1: Multi-Select UI

**File**: `src/components/modals/SpaceSettingsModal/Invites.tsx`

1. **Update Select Component**:
   ```tsx
   <Select
     multiple={true}
     value={selectedUsers}  // string[]
     onChange={(addresses: string[]) => setSelectedUsers(addresses)}
     options={getUserOptions()}
     placeholder={t`Select conversations`}
     showSelectAllOption={true}
   />
   ```

2. **Update State Management**:
   ```tsx
   const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
   ```

3. **Update Button**:
   ```tsx
   <Button
     disabled={sendingInvite || (selectedUsers.length === 0 && !resolvedUser)}
     onClick={() => {
       if (selectedUsers.length > 0) {
         inviteMultiple(selectedUsers);
       } else if (resolvedUser) {
         invite(resolvedUser.user_address);
       }
     }}
   >
     <Trans>
       {selectedUsers.length > 0
         ? `Send Invites (${selectedUsers.length})`
         : 'Send Invite'
       }
     </Trans>
   </Button>
   ```

### Phase 1.5: Comma-Separated Manual Addresses

**File**: `src/components/modals/SpaceSettingsModal/Invites.tsx`

Support multiple addresses in the manual entry field using comma separation.

1. **Update Manual Address Processing**:
   ```tsx
   // Parse comma-separated addresses
   const parseManualAddresses = (input: string): string[] => {
     return input
       .split(',')
       .map(addr => addr.trim())
       .filter(addr => addr.length > 0);
   };

   const manualAddresses = parseManualAddresses(manualAddress);
   const hasMultipleManualAddresses = manualAddresses.length > 1;
   ```

2. **Update Input Placeholder**:
   ```tsx
   <Input
     className="w-full placeholder:text-sm"
     value={manualAddress}
     placeholder="Type addresses separated by commas (e.g., user1@example.com, user2@example.com)"
     onChange={setManualAddress}
   />
   ```

3. **Add Visual Feedback for Multiple Addresses**:
   ```tsx
   {hasMultipleManualAddresses && (
     <div className="mt-2 text-sm text-subtle">
       <Icon name="info-circle" size="sm" className="inline mr-1" />
       <Trans>Detected {manualAddresses.length} addresses</Trans>
     </div>
   )}
   ```

4. **Update Button Logic**:
   ```tsx
   <Button
     disabled={sendingInvite || (selectedUsers.length === 0 && manualAddresses.length === 0)}
     onClick={() => {
       const addressesToInvite = [
         ...selectedUsers,
         ...manualAddresses
       ];

       if (addressesToInvite.length > 1) {
         inviteMultiple(addressesToInvite);
       } else if (addressesToInvite.length === 1) {
         invite(addressesToInvite[0]);
       }
     }}
   >
     <Trans>
       {(() => {
         const totalAddresses = selectedUsers.length + manualAddresses.length;
         return totalAddresses > 1
           ? `Send Invites (${totalAddresses})`
           : 'Send Invite';
       })()}
     </Trans>
   </Button>
   ```

5. **Add Address Validation**:
   ```tsx
   // Basic validation for manual addresses
   const validateAddresses = (addresses: string[]): string[] => {
     const errors = [];
     addresses.forEach((addr, index) => {
       if (!addr.includes('@') || addr.length < 5) {
         errors.push(`Address ${index + 1}: "${addr}" appears invalid`);
       }
     });
     return errors;
   };

   const addressErrors = hasMultipleManualAddresses
     ? validateAddresses(manualAddresses)
     : [];
   ```

6. **Display Validation Errors**:
   ```tsx
   {addressErrors.length > 0 && (
     <Callout variant="error" size="sm" className="mt-2">
       <div>
         <strong>Address Validation Errors:</strong>
         <ul className="mt-1 text-sm">
           {addressErrors.map((error, idx) => (
             <li key={idx}>• {error}</li>
           ))}
         </ul>
       </div>
     </Callout>
   )}
   ```

### Phase 2: Batch Processing Hook

**File**: `src/hooks/business/spaces/useInviteManagement.ts`

1. **Add Multi-Invite Function**:
   ```tsx
   const inviteMultiple = async (addresses: string[]) => {
     setSendingInvite(true);
     const results = [];

     for (const address of addresses) {
       try {
         await sendInviteToUser(address, spaceId, currentPasskeyInfo);
         results.push({ address, success: true });
       } catch (error) {
         results.push({ address, success: false, error: error.message });
       }
     }

     setSendingInvite(false);
     setBatchResults(results);
     setSelectedUser(undefined); // Clear single selection
   };
   ```

2. **Add Batch Results State**:
   ```tsx
   const [batchResults, setBatchResults] = useState<BatchInviteResult[]>([]);

   interface BatchInviteResult {
     address: string;
     success: boolean;
     error?: string;
   }
   ```

### Phase 3: Results UI

**File**: `src/components/modals/SpaceSettingsModal/Invites.tsx`

1. **Add Results Summary**:
   ```tsx
   {batchResults.length > 0 && (
     <div className="mt-4">
       <Callout
         variant={batchResults.every(r => r.success) ? "success" : "warning"}
         size="sm"
       >
         <div>
           <strong>Invite Results:</strong>
           <ul className="mt-2 text-sm">
             {batchResults.map((result, idx) => (
               <li key={idx} className={result.success ? "text-success" : "text-error"}>
                 {getDisplayNameForAddress(result.address)}: {result.success ? "✓ Sent" : `✗ ${result.error}`}
               </li>
             ))}
           </ul>
         </div>
       </Callout>
     </div>
   )}
   ```

2. **Add Progress Indicator**:
   ```tsx
   {sendingInvite && selectedUsers.length > 1 && (
     <div className="mt-4">
       <Callout variant="info" size="sm">
         <div className="flex items-center gap-2">
           <Icon name="spinner" className="icon-spin" />
           <span>Sending invites... ({currentInviteIndex} / {selectedUsers.length})</span>
         </div>
       </Callout>
     </div>
   )}
   ```

## Technical Architecture

### Component Hierarchy
```
SpaceSettingsModal.tsx
├── useInviteManagement() hook
│   ├── inviteMultiple() - New batch function
│   ├── invite() - Existing single function
│   └── sendInviteToUser() - Core service call
└── Invites.tsx
    ├── Select (multiple=true)
    ├── Input (manual address)
    ├── Button (smart text)
    └── Results display
```

### Data Flow
1. **User Selection** → `setSelectedUsers(addresses: string[])`
2. **Button Click** → `inviteMultiple(addresses)`
3. **Sequential Processing** → Loop through addresses calling `sendInviteToUser()`
4. **Results Collection** → Store success/failure for each address
5. **UI Update** → Display summary with success/error details

## Error Handling

### Partial Failures
- Continue processing remaining addresses if one fails
- Collect all results before displaying summary
- Show mixed success/failure in results UI

### Secret Exhaustion (Private Invites)
- Display specific error for "no more secrets available"
- Suggest switching to public invite mode
- Prevent further invite attempts until resolved

### Network Errors
- Retry logic for temporary failures
- Clear error messages for network issues
- Graceful degradation to single-invite mode

## User Experience Improvements

### Progressive Enhancement
- **Fallback**: If multi-select fails, single-select still works
- **Backwards Compatible**: Existing single-invite flow unchanged
- **Discoverable**: Multi-select naturally extends current UI

### Visual Feedback
- **Selection Count**: Button shows "Send Invites (N)"
- **Progress**: Spinner with "X of Y" during batch processing
- **Results**: Success/failure list with clear icons
- **Cleanup**: Auto-clear results after successful batch

## Testing Strategy

### Unit Tests
- Multi-select state management
- Batch processing logic
- Error handling scenarios
- Results formatting

### Integration Tests
- Full invite flow with multiple users
- Mixed success/failure scenarios
- Secret exhaustion handling
- UI state transitions

### Manual Testing
1. **Multi-Select Flow**: Select 3-5 conversations, send batch invite
2. **Comma-Separated Addresses**: Enter "user1@domain.com, user2@domain.com, user3@domain.com"
3. **Mixed Flow**: Multi-select + comma-separated manual addresses both work
4. **Address Validation**: Test invalid addresses, malformed input, empty values
5. **Combined Selection**: Dropdown selection + manual addresses together
6. **Error Cases**: Test with invalid addresses, network failures
7. **Secret Limits**: Test private invite secret exhaustion
8. **Public Mode**: Verify behavior in public invite mode

## Risk Assessment

### Low Risk
- **UI Changes**: Select component already supports multi-select
- **Backwards Compatibility**: Single invite flow preserved
- **Error Isolation**: Failures affect only individual invites

### Medium Risk
- **Secret Exhaustion**: Large batches in private mode could exhaust secrets quickly
- **Performance**: Sequential processing may be slow for large batches
- **UX Confusion**: Users may not understand private vs public invite limits

### Mitigation Strategies
- **Batch Size Limits**: Cap multi-select at 10-20 users
- **Smart Defaults**: Suggest public mode for large batches
- **Clear Messaging**: Explain secret limits in UI
- **Progressive Disclosure**: Advanced options hidden by default

## Files to Modify

### Required Changes
1. **`src/components/modals/SpaceSettingsModal/Invites.tsx`** - Add multi-select UI
2. **`src/hooks/business/spaces/useInviteManagement.ts`** - Add batch processing logic

### Optional Enhancements
3. **`src/services/InvitationService.ts`** - Add native batch method for better performance
4. **`src/components/primitives/Select/types.ts`** - Extend types if needed for new props

## Related Documentation

- [Invite System Analysis](.agents/docs/features/invite-system-analysis.md) - Technical architecture
- [Select API Reference](.agents/docs/features/primitives/API-REFERENCE.md#select) - Component props
- [Multi-User UX Patterns](.agents/docs/features/primitives/02-primitives-AGENTS.md) - Design patterns


---


_Priority: Medium - UX enhancement, no blocking issues_
_Complexity: Medium - Mostly frontend work, some hook logic_
_Estimated: 1-2 weeks_
