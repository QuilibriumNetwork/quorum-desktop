# Text + Image Combined Message — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user writes text and attaches an image in the composer, send a single `PostMessage` with the image embedded in `embeddedMedia` instead of two separate messages.

**Architecture:** The send path in `useMessageComposer.ts` is extended with a combined branch: when both `pendingMessage` and `processedImage` are present, encode the image as base64 `embeddedMedia` entries and send one `PostMessage`. `Message.tsx` gains a renderer for `type: 'image'` / `'image-thumbnail'` entries that displays the image below the text and opens the existing lightbox on click. `MessageComposer.tsx` gets a one-line fix to block send while image processing is in progress.

**Tech Stack:** TypeScript, React, existing `getEmbeddedMediaSrc` utility, existing `useImageModal` hook, `crypto.randomUUID()`

**Spec:** `.agents/tasks/2026-04-09-text-image-combined-message-spec.md`

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/business/messages/useMessageComposer.ts` | Add combined send branch; add `isProcessingImage` guard |
| `src/components/message/Message.tsx` | Render `embeddedMedia` image entries below post text |
| `src/components/message/MessageComposer.tsx` | Disable send button when `isProcessingImage` is true |

---

## Chunk 1: Send Path

### Task 1: Block send while image is processing + combined send

**Files:**
- Modify: `src/hooks/business/messages/useMessageComposer.ts`

- [ ] **Step 1: Add `isProcessingImage` guard at top of `submitMessage`**

  In `submitMessage` (line ~154), the current guard is:
  ```typescript
  if ((pendingMessage || processedImage) && !isSubmitting) {
  ```

  Add an early return immediately after the opening brace, before the mention validation block:

  ```typescript
  if ((pendingMessage || processedImage) && !isSubmitting) {
    // Block send while image is still being processed
    if (isProcessingImage) return;

    // Validate mentions before submission
    if (pendingMessage && !validateMentions(pendingMessage)) {
  ```

  Also add `isProcessingImage` to the `useCallback` dependency array at line ~232:
  ```typescript
  }, [
    pendingMessage,
    processedImage,
    isSubmitting,
    isProcessingImage,
    onSubmitMessage,
    inReplyTo,
    validateMentions,
    messageValidation.isOverLimit,
  ]);
  ```

- [ ] **Step 2: Replace the text-only + image-only branches with a combined branch**

  The current `try` block (lines ~174–223) has two sequential branches:
  1. `if (pendingMessage)` — sends text (with optional YouTube embeds)
  2. `if (processedImage)` — sends `EmbedMessage`

  Replace with three branches: combined, text-only, image-only:

  ```typescript
  try {
    if (pendingMessage && processedImage) {
      // --- Combined: text + image → single PostMessage ---
      const key = crypto.randomUUID();

      // Encode full image
      const fullBuffer = await processedImage.full.file.arrayBuffer();
      const fullData = Buffer.from(fullBuffer).toString('base64');
      const imageEntry = {
        type: 'image' as const,
        key,
        data: fullData,
        mimeType: processedImage.full.file.type,
      };

      // Encode thumbnail if available
      const mediaEntries: Array<{ type: string; key: string; data: string; mimeType: string }> = [];
      if (processedImage.thumbnail) {
        const thumbBuffer = await processedImage.thumbnail.file.arrayBuffer();
        const thumbData = Buffer.from(thumbBuffer).toString('base64');
        mediaEntries.push({
          type: 'image-thumbnail' as const,
          key,
          data: thumbData,
          mimeType: processedImage.thumbnail.file.type,
        });
      }
      mediaEntries.push(imageEntry);

      // Also fetch YouTube thumbnails if text has standalone YouTube URLs
      const videoIds = extractStandaloneYouTubeVideoIds(pendingMessage);
      if (videoIds.length > 0) {
        const results = await Promise.all(
          videoIds.map(async (videoId) => {
            const data = await fetchYouTubeThumbnailAsBase64(videoId);
            if (!data) return null;
            return {
              type: 'youtube-thumbnail' as const,
              key: videoId,
              data,
              mimeType: 'image/jpeg',
            };
          })
        );
        const youtubeEntries = results.filter(
          (r): r is NonNullable<typeof r> => r !== null
        );
        mediaEntries.push(...youtubeEntries);
      }

      await onSubmitMessage(
        { type: 'post' as const, text: pendingMessage, embeddedMedia: mediaEntries },
        inReplyTo?.messageId
      );
    } else if (pendingMessage) {
      // --- Text only (existing logic) ---
      const videoIds = extractStandaloneYouTubeVideoIds(pendingMessage);
      if (videoIds.length > 0) {
        const results = await Promise.all(
          videoIds.map(async (videoId) => {
            const data = await fetchYouTubeThumbnailAsBase64(videoId);
            if (!data) return null;
            return {
              type: 'youtube-thumbnail' as const,
              key: videoId,
              data,
              mimeType: 'image/jpeg',
            };
          })
        );
        const embeddedMedia = results.filter(
          (r): r is NonNullable<typeof r> => r !== null
        );
        if (embeddedMedia.length > 0) {
          await onSubmitMessage(
            { type: 'post' as const, text: pendingMessage, embeddedMedia },
            inReplyTo?.messageId
          );
        } else {
          await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
        }
      } else {
        await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
      }
    } else if (processedImage) {
      // --- Image only (existing EmbedMessage path) ---
      const fullImageBuffer = await processedImage.full.file.arrayBuffer();
      const fullImageUrl = `data:${processedImage.full.file.type};base64,${Buffer.from(fullImageBuffer).toString('base64')}`;

      let thumbnailUrl: string | undefined;
      if (processedImage.thumbnail) {
        const thumbnailBuffer = await processedImage.thumbnail.file.arrayBuffer();
        thumbnailUrl = `data:${processedImage.thumbnail.file.type};base64,${Buffer.from(thumbnailBuffer).toString('base64')}`;
      }

      const embedMessage: EmbedMessage = {
        type: 'embed',
        imageUrl: fullImageUrl,
        thumbnailUrl,
        isLargeGif: processedImage.isLargeGif,
      } as EmbedMessage;
      await onSubmitMessage(embedMessage, inReplyTo?.messageId);
    }

    // Clear state after successful submission
    setPendingMessage('');
    setProcessedImage(undefined);
    setInReplyTo(undefined);
  } finally {
    setIsSubmitting(false);
  }
  ```

  > Note: `PostMessage.embeddedMedia[].type` is typed as `string`, so the `as const` casts are not strictly required for assignability. They are kept as documentation of intent.

  > **Important:** The `data` field must be raw base64 with no `data:` URI prefix. `getEmbeddedMediaSrc` adds the `data:${mimeType};base64,` prefix at read time. The image-only `EmbedMessage` path stores the full URI directly in `imageUrl` — do not copy that pattern here or the URI will be double-prefixed and images will break.

- [ ] **Step 3: Verify TypeScript**

  ```bash
  cd d:/GitHub/Quilibrium/quorum-desktop
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```
  Expected: no errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/hooks/business/messages/useMessageComposer.ts
  git commit -m "feat: combined text+image PostMessage send; block send during image processing"
  ```

---

## Chunk 2: Composer UX Fix

### Task 2: Disable send button while image is processing

**Files:**
- Modify: `src/components/message/MessageComposer.tsx`

- [ ] **Step 1: Add `isProcessingImage` to the send button's disabled condition**

  Find the send button at line ~844:
  ```typescript
  <Button
    type="unstyled"
    onClick={messageValidation?.isOverLimit ? undefined : onSubmitMessage}
    className={`message-composer-send-btn ${messageValidation?.isOverLimit ? 'disabled' : ''}`}
  >
  ```

  Replace with:
  ```typescript
  <Button
    type="unstyled"
    onClick={messageValidation?.isOverLimit || isProcessingImage ? undefined : onSubmitMessage}
    className={`message-composer-send-btn ${messageValidation?.isOverLimit || isProcessingImage ? 'disabled' : ''}`}
  >
  ```

  > `isProcessingImage` is already a prop on `MessageComposer` (line ~55) and already destructured (line ~113) — no prop changes needed.

- [ ] **Step 2: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```
  Expected: no errors

- [ ] **Step 3: Smoke test — send button blocked during processing**

  - Attach a large image in the composer
  - While "Processing image..." callout is visible, confirm the send button is visually disabled (cursor, opacity)
  - Confirm clicking it does nothing

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/message/MessageComposer.tsx
  git commit -m "fix: disable send button while image is processing"
  ```

---

## Chunk 3: Rendering

### Task 3: Render embedded images below post text in Message.tsx

**Files:**
- Modify: `src/components/message/Message.tsx`

The combined message is a `PostMessage`, so it flows through the existing post rendering path. After the text tokens are rendered, we need to check for image entries in `embeddedMedia` and render them.

There are two rendering paths in `Message.tsx` for post content:
1. **Markdown path** (lines ~1001–1030): uses `MessageMarkdownRenderer`
2. **Token path** (lines ~1033+): renders tokens directly

Both paths share the same message object. We add image rendering **after** each path's output, inside the same containing `<div>`.

> **GIF note (out of scope):** The combined path does not support the click-to-animate GIF behavior. If the user attaches a GIF with text, it will display as a static thumbnail with a lightbox — not the in-place animation the image-only `EmbedMessage` path provides. This is an accepted regression for this feature; GIF+text combined messages are an edge case. The image-only path (no text) continues to use `EmbedMessage` with full GIF support unchanged.

> **Receipt indicator note:** In the token path, the receipt indicator (`receiptIndicator`) is rendered inside the last text token div. After wrapping in a Fragment in Step 4, the images appear outside it. This is intentional — the receipt indicator stays with the text, not the image, consistent with how the markdown path handles it (`suffix` is a prop on `MessageMarkdownRenderer`).

- [ ] **Step 1: Add missing imports to `Message.tsx`**

  `getEmbeddedMediaSrc` and `MessageContent` are not currently imported in `Message.tsx`. Add them:

  Find the existing import from `@quilibrium/quorum-shared` (lines ~5-12) and add `MessageContent` to it:
  ```typescript
  import type {
    Message as MessageType,
    MessageContent,
    PostMessage,
    // ...existing imports...
  } from '@quilibrium/quorum-shared';
  ```

  Add a new import for `getEmbeddedMediaSrc` with the other utility imports:
  ```typescript
  import { getEmbeddedMediaSrc } from '../../utils/embeddedMedia';
  ```

- [ ] **Step 2: Add a helper to collect image keys from embeddedMedia**

  Place this function after all hook calls are complete (around line ~310+, before the render return), not at line ~197 which is mid-hook-initialization:


  ```typescript
  // Returns unique keys for embedded image entries (combined messages)
  const getEmbeddedImageKeys = (content: MessageContent | undefined): string[] => {
    if (content?.type !== 'post' || !content.embeddedMedia) return [];
    const keys: string[] = [];
    for (const entry of content.embeddedMedia) {
      if ((entry.type === 'image' || entry.type === 'image-thumbnail') && !keys.includes(entry.key)) {
        keys.push(entry.key);
      }
    }
    return keys;
  };
  ```

- [ ] **Step 3: Add embedded image rendering after the markdown path**

  The markdown path ends at line ~1030 with:
  ```typescript
        return (
          <div className="message-post-content break-words">
            <MessageMarkdownRenderer
              ...
              embeddedMedia={embeddedMedia}
            />
          </div>
        );
  ```

  Replace with:
  ```typescript
        const imageKeys = getEmbeddedImageKeys(message.content);
        return (
          <div className="message-post-content break-words">
            <MessageMarkdownRenderer
              content={contentData.fullText}
              mapSenderToUser={mapSenderToUser}
              onUserClick={onUserClick}
              onChannelClick={onChannelClick}
              onMessageLinkClick={(channelId, messageId) => {
                if (spaceId) {
                  navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);
                }
              }}
              hasEveryoneMention={message.mentions?.everyone}
              roleMentions={message.mentions?.roleIds}
              channelMentions={message.mentions?.channelIds}
              spaceRoles={spaceRoles}
              spaceChannels={spaceChannels}
              messageSenderId={message.content?.senderId}
              currentUserAddress={user.currentPasskeyInfo?.address}
              currentSpaceId={spaceId}
              suffix={receiptIndicator}
              embeddedMedia={embeddedMedia}
            />
            {imageKeys.map((key) => {
              const thumbnailSrc =
                getEmbeddedMediaSrc(message.content as any, 'image-thumbnail', key) ??
                getEmbeddedMediaSrc(message.content as any, 'image', key);
              const fullSrc = getEmbeddedMediaSrc(message.content as any, 'image', key);
              if (!thumbnailSrc || !fullSrc) return null;
              return (
                <div key={key} className="relative inline-block mt-1">
                  <img
                    src={thumbnailSrc}
                    className="message-image rounded-lg cursor-pointer hover:opacity-80"
                    onClick={() => showImageModal(fullSrc)}
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
  ```

- [ ] **Step 4: Add embedded image rendering after the token path**

  The token path (line ~1033) returns `contentData.content.map(...)`. This renders a flat list of token elements. Find the outer wrapper for the token path — it should be inside the same `if/else` branch. Add image rendering after the map output.

  Locate the return inside the token-path branch. It will look something like:
  ```typescript
        return contentData.content.map((c, i) => {
          // ...token rendering...
        });
  ```

  Wrap it so images can be appended:
  ```typescript
        const imageKeys = getEmbeddedImageKeys(message.content);
        return (
          <>
            {contentData.content.map((c, i) => {
              // ...existing token rendering — no changes inside...
            })}
            {imageKeys.map((key) => {
              const thumbnailSrc =
                getEmbeddedMediaSrc(message.content as any, 'image-thumbnail', key) ??
                getEmbeddedMediaSrc(message.content as any, 'image', key);
              const fullSrc = getEmbeddedMediaSrc(message.content as any, 'image', key);
              if (!thumbnailSrc || !fullSrc) return null;
              return (
                <div key={key} className="relative inline-block mt-1">
                  <img
                    src={thumbnailSrc}
                    className="message-image rounded-lg cursor-pointer hover:opacity-80"
                    onClick={() => showImageModal(fullSrc)}
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              );
            })}
          </>
        );
  ```

  > `showImageModal` is already destructured near line ~197: `const { showImageModal } = useImageModal()`. Do NOT use `formatting.handleImageClick` — that requires a `React.MouseEvent` as first argument and is a different wrapper.

- [ ] **Step 5: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```
  Expected: no errors

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/message/Message.tsx
  git commit -m "feat: render embedded images below post text with lightbox support"
  ```

---

## Chunk 4: Verification

### Task 4: End-to-end smoke tests

- [ ] **Step 1: Combined message sends as one**

  - Open the app, type some text, attach an image
  - Hit send
  - Confirm: only **one** message appears in the chat (not two)
  - Confirm: text appears above the image

- [ ] **Step 2: Image renders correctly**

  - The sent message shows the image below the text
  - Image is sized similarly to `EmbedMessage` images (uses `message-image` class)

- [ ] **Step 3: Lightbox opens on click**

  - Click the image in the combined message
  - Confirm: lightbox/modal opens with the full-size image
  - Confirm: lightbox closes normally

- [ ] **Step 4: Image-only still works**

  - Attach an image with no text
  - Send
  - Confirm: sends as `EmbedMessage` (single image message, no text above)
  - Confirm: click still opens lightbox

- [ ] **Step 5: Text-only still works**

  - Type text with no image attached
  - Send
  - Confirm: plain text message, no image

- [ ] **Step 6: Text + image + YouTube URL**

  - Type a standalone YouTube URL on its own line, add some other text, attach an image
  - Send
  - Confirm: one message, YouTube facade rendered, image rendered below text

- [ ] **Step 7: Send button blocked during processing**

  - Attach a large image (find a file >5MB if possible)
  - While "Processing image..." callout is visible, click send
  - Confirm: nothing happens, button appears disabled

- [ ] **Step 8: Lint and type check**

  ```bash
  yarn lint
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```
  Expected: no new errors

- [ ] **Step 9: Final commit if any cleanup needed**

  ```bash
  git add -p
  git commit -m "chore: cleanup after text+image combined message implementation"
  ```

---

*Created: 2026-04-09 | Updated: 2026-04-09 (post-review fixes)*
