# Mobile Keyboard Avoidance System

Simple CSS-based keyboard avoidance solution using modern web standards that ensures message input areas remain visible when virtual keyboards appear on mobile devices.

## Current Solution: CSS-Only Approach

The working solution uses **native web standards** instead of JavaScript workarounds:

### Implementation

#### 1. Viewport Meta Tag Enhancement
```html
<!-- Before -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- After -->  
<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content" />
```

**Key addition**: `interactive-widget=resizes-content`
- Tells the browser to resize the content area when virtual keyboards appear
- Works natively without JavaScript intervention

#### 2. Dynamic Viewport Height Support
```scss
// Container.scss & _chat.scss
.container {
  height: calc(100vh - 14px);
  @supports (height: 100dvh) {
    height: calc(100dvh - 14px); // Dynamic viewport height
  }
}
```

**Benefits of `100dvh`**:
- Automatically adjusts for virtual keyboards
- Modern CSS unit specifically designed for this problem
- No JavaScript calculation needed

#### 3. Improved Flexbox Layout
```scss
// Channel.scss & DirectMessage.scss
.chat-container {
  flex: 1 1 auto; // Changed from flex: 1
}

.message-list {
  flex: 1 1 auto; // Allows proper shrinking
  min-height: 0; // Critical for vertical shrinking
}
```

#### 4. Sticky Message Composer
```scss
// Channel.scss & DirectMessage.scss  
.message-editor-container {
  position: sticky;
  bottom: 0;
  background: transparent;
  z-index: 5;
}
```

**Effect**: Input stays visible at bottom when keyboard appears

## Files Modified

### 1. `index.html`
- Added `interactive-widget=resizes-content` to viewport meta tag

### 2. `src/components/Container.scss`
- Added `100dvh` support with fallback to `100vh`

### 3. `src/styles/_chat.scss`
- Added `100dvh` support for main chat container
- Changed flex properties for better responsiveness
- Added `min-height: 0` for vertical shrinking

### 4. `src/components/channel/Channel.scss`
- Updated flexbox properties to `flex: 1 1 auto`
- Added sticky positioning for message editor container

### 5. `src/components/direct/DirectMessage.scss`
- Same flexbox and sticky positioning improvements as Channel

### 6. Removed Files/Code
- **All JavaScript keyboard avoidance utilities** from `src/utils.ts`
- **useEffect hooks** for keyboard handling in both components
- **Complex import statements** referencing JavaScript handlers

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome Mobile | ✅ Full | Native `interactive-widget` support |
| Safari iOS | ✅ Full | Excellent `100dvh` support |
| Firefox Mobile | ✅ Full | Good standards compliance |
| Older Browsers | ✅ Fallback | Falls back to `100vh` gracefully |


---

*Last updated: August 30, 2025*  
