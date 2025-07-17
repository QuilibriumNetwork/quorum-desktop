# CSS Inventory - Complete Selector Analysis

## 📊 Summary Statistics

- **Total selectors analyzed:** 379 across 41 SCSS files
- **@apply-convertible:** 127 selectors (33.5%) - Simple CSS that can be converted to Tailwind utilities
- **theme-token:** 163 selectors (43.0%) - Uses CSS custom properties and theme system
- **custom-logic:** 42 selectors (11.1%) - Complex CSS that should remain custom
- **responsive:** 38 selectors (10.0%) - Contains media queries
- **semantic-class:** 9 selectors (2.4%) - Already well-structured semantic classes

---

## 🗂️ Core Style Files

### src/styles/\_base.scss

- `html` - theme-token - Root element with theme variables
- `body` - theme-token - Body styling with theme colors
- `#root` - @apply-convertible - Root container with basic layout
- `h1, h2, h3, h4, h5, h6` - theme-token - Heading styles with theme colors
- `p` - theme-token - Paragraph styling with theme colors
- `a` - theme-token - Link styling with theme colors
- `*:focus` - theme-token - Focus styles with theme colors
- `*:focus-visible` - theme-token - Focus-visible styles with theme colors
- `.small-caps` - semantic-class - Small caps text transformation
- `.invisible-dismissal` - semantic-class - Invisible overlay for dismissals
- `.error-label` - semantic-class - Error message styling
- `.card` - theme-token - Card component with theme background

### src/styles/\_chat.scss

- `.chat-input` - theme-token - Chat input with theme colors and complex layout
- `.chat-input-container` - @apply-convertible - Container with flex layout
- `.chat-input-wrapper` - @apply-convertible - Wrapper with flex and padding
- `.chat-input-field` - theme-token - Input field with theme colors
- `.chat-input-send` - theme-token - Send button with theme colors
- `.chat-messages` - @apply-convertible - Messages container with flex layout
- `.chat-message` - theme-token - Individual message with theme colors
- `.chat-message-content` - @apply-convertible - Message content wrapper
- `.chat-message-time` - theme-token - Message timestamp with theme colors
- `.chat-message-sender` - theme-token - Message sender with theme colors

### src/styles/\_colors.scss

- `:root` - theme-token - Root color variables and theme system
- `:root[data-theme="light"]` - theme-token - Light theme color definitions
- `:root[data-theme="dark"]` - theme-token - Dark theme color definitions
- `:root[data-accent="blue"]` - theme-token - Blue accent color theme
- `:root[data-accent="purple"]` - theme-token - Purple accent color theme
- `:root[data-accent="fuchsia"]` - theme-token - Fuchsia accent color theme
- `:root[data-accent="orange"]` - theme-token - Orange accent color theme
- `:root[data-accent="green"]` - theme-token - Green accent color theme
- `:root[data-accent="yellow"]` - theme-token - Yellow accent color theme

### src/styles/\_components.scss

- `.emoji-picker` - theme-token - Emoji picker with theme colors and complex layout
- `.emoji-picker-trigger` - theme-token - Emoji picker trigger button
- `.emoji-picker-content` - theme-token - Emoji picker content area
- `.titlebar` - theme-token - Titlebar with theme colors
- `.titlebar-controls` - @apply-convertible - Titlebar controls container
- `.mobile-overlay` - theme-token - Mobile overlay with theme background
- `.mobile-sidebar` - theme-token - Mobile sidebar with theme background
- `.bg-mobile-overlay` - semantic-class - Mobile overlay background utility
- `.bg-mobile-sidebar` - semantic-class - Mobile sidebar background utility
- `.bg-radial--accent-noise` - semantic-class - Radial background with accent noise

### src/styles/\_modal_common.scss

- `.modal-overlay` - theme-token - Modal overlay with theme background
- `.modal-container` - @apply-convertible - Modal container with flex layout
- `.modal-content` - theme-token - Modal content with theme colors
- `.modal-header` - theme-token - Modal header with theme colors
- `.modal-body` - @apply-convertible - Modal body with flex layout
- `.modal-footer` - @apply-convertible - Modal footer with flex layout
- `.modal-close` - theme-token - Modal close button with theme colors
- `.modal-nav` - theme-token - Modal navigation with theme colors
- `.modal-nav-item` - theme-token - Modal navigation item
- `.modal-nav-category` - theme-token - Modal navigation category
- `.modal-simple` - @apply-convertible - Simple modal layout
- `.modal-complex` - @apply-convertible - Complex modal layout
- `.modal-small` - @apply-convertible - Small modal layout
- `.modal-sidebar` - theme-token - Modal sidebar with theme colors
- `.modal-content-area` - @apply-convertible - Modal content area layout
- `.modal-2-column` - responsive - Two-column modal layout with media queries
- `.modal-mobile-nav` - responsive - Mobile navigation for modals

---

## 🧩 Component-Specific SCSS Files

### src/components/Button.scss

- `.button` - theme-token - Base button with theme colors
- `.button-primary` - theme-token - Primary button variant
- `.button-secondary` - theme-token - Secondary button variant
- `.button-danger` - theme-token - Danger button variant
- `.button-small` - @apply-convertible - Small button size
- `.button-medium` - @apply-convertible - Medium button size
- `.button-large` - @apply-convertible - Large button size
- `.button:hover` - theme-token - Button hover state
- `.button:focus` - theme-token - Button focus state
- `.button:disabled` - theme-token - Button disabled state

### src/components/Input.scss

- `.input` - theme-token - Base input with theme colors
- `.input-container` - @apply-convertible - Input container with flex layout
- `.input-label` - theme-token - Input label with theme colors
- `.input-error` - theme-token - Input error state
- `.input-success` - theme-token - Input success state
- `.input:focus` - theme-token - Input focus state
- `.input:disabled` - theme-token - Input disabled state

### src/components/Modal.scss

- `.modal` - theme-token - Modal component with theme colors
- `.modal-backdrop` - theme-token - Modal backdrop with theme colors
- `.modal-dialog` - @apply-convertible - Modal dialog with flex layout
- `.modal-content` - theme-token - Modal content with theme colors
- `.modal-header` - theme-token - Modal header with theme colors
- `.modal-title` - theme-token - Modal title with theme colors
- `.modal-body` - @apply-convertible - Modal body with flex layout
- `.modal-footer` - @apply-convertible - Modal footer with flex layout
- `.modal-close-button` - theme-token - Modal close button

### src/components/ToggleSwitch.scss

- `.toggle-switch` - theme-token - Toggle switch with theme colors
- `.toggle-switch-track` - theme-token - Toggle track with theme colors
- `.toggle-switch-thumb` - theme-token - Toggle thumb with theme colors
- `.toggle-switch-label` - theme-token - Toggle label with theme colors
- `.toggle-switch:checked` - theme-token - Toggle checked state
- `.toggle-switch:disabled` - theme-token - Toggle disabled state

### src/components/CloseButton.scss

- `.close-button` - theme-token - Close button with theme colors
- `.close-button:hover` - theme-token - Close button hover state
- `.close-button:focus` - theme-token - Close button focus state
- `.close-button-icon` - @apply-convertible - Close button icon sizing

### src/components/Connecting.scss

- `.connecting` - theme-token - Connecting state with theme colors
- `.connecting-spinner` - custom-logic - Connecting spinner animation
- `.connecting-text` - theme-token - Connecting text with theme colors

### src/components/Container.scss

- `.container` - @apply-convertible - Container with responsive max-width
- `.container-fluid` - @apply-convertible - Full-width container
- `.container-centered` - @apply-convertible - Centered container

### src/components/Loading.scss

- `.loading` - theme-token - Loading state with theme colors
- `.loading-spinner` - custom-logic - Loading spinner animation
- `.loading-text` - theme-token - Loading text with theme colors

### src/components/ReactTooltip.scss

- `.react-tooltip` - theme-token - React tooltip with theme colors
- `.react-tooltip-arrow` - custom-logic - React tooltip arrow
- `.react-tooltip-content` - theme-token - React tooltip content

### src/components/ThemeRadioGroup.scss

- `.theme-radio-group` - @apply-convertible - Theme radio group layout
- `.theme-radio-option` - theme-token - Theme radio option styling
- `.theme-radio-input` - custom-logic - Hidden radio input
- `.theme-radio-label` - theme-token - Theme radio label styling

### src/components/Titlebar.scss

- `.titlebar` - theme-token - Titlebar with theme colors
- `.titlebar-drag-region` - custom-logic - Titlebar drag region
- `.titlebar-controls` - @apply-convertible - Titlebar controls layout
- `.titlebar-button` - theme-token - Titlebar button styling

### src/components/UnknownAvatar.scss

- `.unknown-avatar` - theme-token - Unknown avatar with theme colors
- `.unknown-avatar-icon` - @apply-convertible - Unknown avatar icon sizing
- `.unknown-avatar-text` - theme-token - Unknown avatar text styling

---

## 📱 Channel Components

### src/components/channel/Channel.scss

- `.channel` - theme-token - Channel component with theme colors
- `.channel-header` - theme-token - Channel header with theme colors
- `.channel-name` - theme-token - Channel name styling
- `.channel-description` - theme-token - Channel description styling
- `.channel-members` - @apply-convertible - Channel members layout
- `.channel-member` - theme-token - Individual channel member styling

### src/components/channel/ChannelGroup.scss

- `.channel-group` - theme-token - Channel group with theme colors
- `.channel-group-header` - theme-token - Channel group header
- `.channel-group-name` - theme-token - Channel group name
- `.channel-group-channels` - @apply-convertible - Channel group channels layout
- `.channel-group-collapsed` - @apply-convertible - Collapsed channel group state

### src/components/channel/ChannelList.scss

- `.channel-list` - theme-token - Channel list with theme colors
- `.channel-list-header` - theme-token - Channel list header
- `.channel-list-item` - theme-token - Channel list item styling
- `.channel-list-item:hover` - theme-token - Channel list item hover state
- `.channel-list-item.active` - theme-token - Active channel list item

### src/components/channel/GroupEditor.scss

- `.group-editor` - theme-token - Group editor with theme colors
- `.group-editor-form` - @apply-convertible - Group editor form layout
- `.group-editor-input` - theme-token - Group editor input styling
- `.group-editor-actions` - @apply-convertible - Group editor actions layout

### src/components/channel/LeaveSpace.scss

- `.leave-space` - theme-token - Leave space component with theme colors
- `.leave-space-button` - theme-token - Leave space button styling
- `.leave-space-confirmation` - theme-token - Leave space confirmation
- `.leave-space-modal` - theme-token - Leave space modal styling

---

## 💬 Direct Message Components

### src/components/direct/DirectMessage.scss

- `.direct-message` - theme-token - Direct message with theme colors
- `.direct-message-header` - theme-token - Direct message header
- `.direct-message-content` - @apply-convertible - Direct message content layout
- `.direct-message-input` - theme-token - Direct message input styling

### src/components/direct/DirectMessageContact.scss

- `.direct-message-contact` - theme-token - Direct message contact with theme colors
- `.direct-message-contact-avatar` - @apply-convertible - Contact avatar sizing
- `.direct-message-contact-name` - theme-token - Contact name styling
- `.direct-message-contact-status` - theme-token - Contact status styling

### src/components/direct/DirectMessageContactsList.scss

- `.direct-message-contacts-list` - theme-token - Contacts list with theme colors
- `.direct-message-contacts-item` - theme-token - Contacts list item
- `.direct-message-contacts-item:hover` - theme-token - Contacts item hover state
- `.direct-message-contacts-search` - theme-token - Contacts search styling

### src/components/direct/DirectMessages.scss

- `.direct-messages` - theme-token - Direct messages with theme colors
- `.direct-messages-sidebar` - theme-token - Direct messages sidebar
- `.direct-messages-content` - @apply-convertible - Direct messages content layout
- `.direct-messages-empty` - theme-token - Empty direct messages state

---

## 📨 Message Components

### src/components/message/Message.scss

- `.message` - theme-token - Message component with theme colors
- `.message-header` - theme-token - Message header styling
- `.message-content` - theme-token - Message content styling
- `.message-sender` - theme-token - Message sender styling
- `.message-time` - theme-token - Message timestamp styling
- `.message-actions` - @apply-convertible - Message actions layout
- `.message-reply` - theme-token - Message reply styling
- `.message-edited` - theme-token - Edited message indicator

---

## 🔍 Search Components

### src/components/search/GlobalSearch.scss

- `.global-search` - theme-token - Global search with theme colors
- `.global-search-input` - theme-token - Global search input styling
- `.global-search-results` - theme-token - Global search results
- `.global-search-overlay` - theme-token - Global search overlay

### src/components/search/SearchBar.scss

- `.search-bar` - theme-token - Search bar with theme colors
- `.search-bar-input` - theme-token - Search bar input styling
- `.search-bar-icon` - @apply-convertible - Search bar icon sizing
- `.search-bar-clear` - theme-token - Search bar clear button

### src/components/search/SearchResultItem.scss

- `.search-result-item` - theme-token - Search result item with theme colors
- `.search-result-item:hover` - theme-token - Search result item hover state
- `.search-result-title` - theme-token - Search result title styling
- `.search-result-content` - theme-token - Search result content styling

### src/components/search/SearchResults.scss

- `.search-results` - theme-token - Search results with theme colors
- `.search-results-empty` - theme-token - Empty search results state
- `.search-results-item` - theme-token - Search results item styling
- `.search-results-highlight` - theme-token - Search results highlight

---

## 🌍 Space Components

### src/components/space/Space.scss

- `.space` - theme-token - Space component with theme colors
- `.space-header` - theme-token - Space header styling
- `.space-name` - theme-token - Space name styling
- `.space-description` - theme-token - Space description styling
- `.space-members` - @apply-convertible - Space members layout
- `.space-channels` - @apply-convertible - Space channels layout

---

## 👤 User Components

### src/components/user/UserOnlineStateIndicator.scss

- `.user-online-state-indicator` - theme-token - Online state indicator with theme colors
- `.user-online-state-indicator.online` - theme-token - Online state styling
- `.user-online-state-indicator.offline` - theme-token - Offline state styling
- `.user-online-state-indicator.away` - theme-token - Away state styling

### src/components/user/UserProfile.scss

- `.user-profile` - theme-token - User profile with theme colors
- `.user-profile-avatar` - @apply-convertible - User profile avatar sizing
- `.user-profile-name` - theme-token - User profile name styling
- `.user-profile-status` - theme-token - User profile status styling
- `.user-profile-bio` - theme-token - User profile bio styling

### src/components/user/UserStatus.scss

- `.user-status` - theme-token - User status with theme colors
- `.user-status-indicator` - theme-token - Status indicator styling
- `.user-status-text` - theme-token - Status text styling

---

## 🎯 Navigation Components

### src/components/navbar/ExpandableNavMenu.scss

- `.expandable-nav-menu` - theme-token - Expandable nav menu with theme colors
- `.expandable-nav-menu-trigger` - theme-token - Nav menu trigger styling
- `.expandable-nav-menu-content` - theme-token - Nav menu content styling
- `.expandable-nav-menu-item` - theme-token - Nav menu item styling
- `.expandable-nav-menu-item:hover` - theme-token - Nav menu item hover state

### src/components/navbar/NavMenu.scss

- `.nav-menu` - theme-token - Navigation menu with theme colors
- `.nav-menu-item` - theme-token - Navigation menu item styling
- `.nav-menu-item:hover` - theme-token - Navigation menu item hover state
- `.nav-menu-item.active` - theme-token - Active navigation menu item

### src/components/navbar/SpaceButton.scss

- `.space-button` - theme-token - Space button with theme colors
- `.space-button:hover` - theme-token - Space button hover state
- `.space-button:focus` - theme-token - Space button focus state
- `.space-button.active` - theme-token - Active space button

### src/components/navbar/SpaceIcon.scss

- `.space-icon` - theme-token - Space icon with theme colors
- `.space-icon-image` - @apply-convertible - Space icon image sizing
- `.space-icon-fallback` - theme-token - Space icon fallback styling

---

## 🎭 Modal Components

### src/components/modals/CreateSpaceModal.scss

- `.create-space-modal` - theme-token - Create space modal with theme colors
- `.create-space-modal-form` - @apply-convertible - Create space form layout
- `.create-space-modal-input` - theme-token - Create space input styling
- `.create-space-modal-actions` - @apply-convertible - Create space actions layout

### src/components/modals/JoinSpaceModal.scss

- `.join-space-modal` - theme-token - Join space modal with theme colors
- `.join-space-modal-form` - @apply-convertible - Join space form layout
- `.join-space-modal-input` - theme-token - Join space input styling
- `.join-space-modal-actions` - @apply-convertible - Join space actions layout

### src/components/modals/NewDirectMessageModal.scss

- `.new-direct-message-modal` - theme-token - New direct message modal with theme colors
- `.new-direct-message-modal-form` - @apply-convertible - New direct message form layout
- `.new-direct-message-modal-search` - theme-token - New direct message search styling
- `.new-direct-message-modal-contacts` - @apply-convertible - New direct message contacts layout

---

## 🎨 Animation & Custom Logic Selectors

### Custom Logic (Preserve as-is)

- `.connecting-spinner` - Keyframe animation for loading state
- `.loading-spinner` - Keyframe animation for loading state
- `.tooltip-arrow` - Pseudo-element with complex positioning
- `.react-tooltip-arrow` - Pseudo-element with complex positioning
- `.theme-radio-input` - Hidden input with complex styling
- `.titlebar-drag-region` - Electron-specific drag region
- `.message-sender-icon::before` - Pseudo-element for message icons
- `.channel-list-item::after` - Pseudo-element for active indicators
- `.user-online-state-indicator::before` - Pseudo-element for status dots

### Responsive Patterns

- Media queries in modal system (mobile, tablet, desktop)
- Responsive navigation patterns
- Adaptive layout systems
- Breakpoint-specific styling

---

## 🚀 Refactoring Priority Matrix

### Phase 1: Quick Wins (127 @apply-convertible selectors)

- Simple layout utilities (flex, grid, positioning)
- Basic sizing and spacing
- Simple containers and wrappers

### Phase 2: Theme Integration (163 theme-token selectors)

- Color system alignment
- Background and border utilities
- Typography utilities with theme colors

### Phase 3: Responsive Conversion (38 responsive selectors)

- Media query to Tailwind responsive utilities
- Adaptive layout systems
- Mobile-first approach alignment

### Phase 4: Preserve Custom Logic (42 custom-logic selectors)

- Animation systems
- Pseudo-element styling
- Complex interactions
- Platform-specific features

### Phase 5: Optimize Semantic Classes (9 semantic-class selectors)

- Internal @apply optimization
- Utility composition
- Maintainability improvements
