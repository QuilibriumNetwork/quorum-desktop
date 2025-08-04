# Combined Text + Image Messages

## Overview

Currently, when a user uploads an image and types text, the message composer sends two separate messages:

1. Text message
2. Image as `EmbedMessage`

This could be improved to send a single combined message for better UX, but requires careful implementation due to system complexity.

## Current Behavior

```typescript
// In useMessageComposer.ts - submitMessage()
if (pendingMessage) {
  await onSubmitMessage(pendingMessage, inReplyTo?.messageId);      // Message 1
}
if (fileData) {
  const embedMessage: EmbedMessage = { ... };
  await onSubmitMessage(embedMessage, inReplyTo?.messageId);       // Message 2
}
```

## Desired Behavior

Single message containing both text and image content.

## Technical Requirements

### 1. API Type Changes

- **File**: `src/api/quorumApi.ts`
- **Current**: `EmbedMessage` only supports `imageUrl`, `videoUrl`, dimensions
- **Required**: Add optional `message?: string` field to `EmbedMessage`

```typescript
export type EmbedMessage = {
  senderId: string;
  type: 'embed';
  message?: string; // NEW: Optional text content
  imageUrl?: string;
  videoUrl?: string;
  width?: string;
  height?: string;
  repliesToMessageId?: string;
};
```

### 2. Backend Compatibility

- **Verify**: Backend can handle `message` field in embed messages
- **Storage**: Database schema supports text in embed messages
- **Parsing**: Message indexing/search includes text from embed messages

### 3. Frontend Message Rendering

- **Components to Update**:
  - `src/components/message/Message.tsx` - Main message display
  - `src/components/message/MessageContent.tsx` - Content rendering
  - Any message list/thread components
- **Requirements**:
  - Display text above/below image in embed messages
  - Maintain proper spacing and styling
  - Handle long text + large images gracefully
  - Preserve reply/thread functionality

### 4. Cross-Platform Considerations

- **Mobile App**: If mobile app exists, ensure compatibility
- **Message Format**: Backward compatibility with existing embed messages
- **Native Components**: Update native message renderers if applicable

### 5. Implementation Strategy

```typescript
// Updated useMessageComposer.ts logic
const submitMessage = useCallback(async () => {
  if ((pendingMessage || fileData) && !isSubmitting) {
    setIsSubmitting(true);
    try {
      if (pendingMessage && fileData) {
        // Combined message
        const embedMessage: EmbedMessage = {
          type: 'embed',
          message: pendingMessage,  // Include text
          imageUrl: `data:${fileType};base64,${Buffer.from(fileData).toString('base64')}`,
        } as EmbedMessage;
        await onSubmitMessage(embedMessage, inReplyTo?.messageId);
      } else if (pendingMessage) {
        // Text only (unchanged)
        await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
      } else if (fileData) {
        // Image only (unchanged)
        const embedMessage: EmbedMessage = { ... };
        await onSubmitMessage(embedMessage, inReplyTo?.messageId);
      }
    } finally {
      setIsSubmitting(false);
    }
  }
}, [pendingMessage, fileData, fileType, isSubmitting, onSubmitMessage, inReplyTo]);
```

## Risk Assessment

### High Risk Areas

1. **Message Display**: Breaking existing message rendering
2. **Backend Compatibility**: API changes affecting message storage/retrieval
3. **Search Functionality**: Text in embeds not being indexed properly
4. **Mobile Compatibility**: If mobile app shares message format

### Medium Risk Areas

1. **Styling Issues**: Layout problems with text + image combinations
2. **Performance**: Larger message objects affecting load times
3. **Reply/Thread Logic**: Combined messages in conversation context

### Low Risk Areas

1. **Type Changes**: Adding optional field is generally safe
2. **Fallback**: Can maintain backward compatibility

## Testing Strategy

### 1. Unit Tests

- Message composer logic for all combinations
- Message type validation
- Backward compatibility with existing message types

### 2. Integration Tests

- End-to-end message sending and display
- Reply functionality with combined messages
- Search functionality including text from embeds

### 3. Manual Testing

- **Scenarios**:
  - Text only → unchanged behavior
  - Image only → unchanged behavior
  - Text + Image → single combined message
  - Reply to combined messages
  - Long text + large images
  - Message editing/deletion
  - Search containing text from combined messages

### 4. Cross-Platform Testing

- Desktop app functionality
- Mobile app compatibility (if applicable)
- Different screen sizes and orientations

## Implementation Steps

1. **Phase 1 - Backend Validation**
   - Verify backend can handle `message` field in `EmbedMessage`
   - Test message storage and retrieval
   - Confirm search indexing works

2. **Phase 2 - Type Updates**
   - Update `EmbedMessage` type definition
   - Update TypeScript across codebase
   - Ensure backward compatibility

3. **Phase 3 - Message Rendering**
   - Update message display components
   - Test all message types render correctly
   - Handle edge cases (very long text, large images)

4. **Phase 4 - Composer Logic**
   - Update `useMessageComposer` submission logic
   - Test all input combinations
   - Maintain reply functionality

5. **Phase 5 - Testing & Polish**
   - Comprehensive testing across scenarios
   - Performance validation
   - Cross-platform compatibility check

## Success Criteria

- [ ] Single message sent for text + image input
- [ ] All existing message types still work correctly
- [ ] No performance regression
- [ ] Search functionality includes text from combined messages
- [ ] Mobile compatibility maintained (if applicable)
- [ ] No styling/layout issues with combined messages

## Estimated Effort

**Time**: 2-3 days for experienced developer
**Complexity**: Medium-High (due to cross-system impact)
**Priority**: Low-Medium (UX improvement, not critical functionality)

## Notes

- Consider this enhancement after completing current business logic extraction work
- Requires coordination with backend team if API changes needed
- Test thoroughly due to app complexity and fragility mentioned by user
- May want to implement as feature flag initially for safe rollout

---

_Created: 2025-08-02_
_Context: Business logic extraction - Channel.tsx message composer improvements_
_Status: Analysis Complete - Ready for Implementation Planning_
