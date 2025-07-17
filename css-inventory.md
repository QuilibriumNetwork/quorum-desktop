# CSS Inventory for Tailwind Refactor

This document provides a comprehensive inventory of all CSS selectors across the project's 41 SCSS files, classified by their suitability for conversion to Tailwind CSS.

## Classification Legend

- **@apply-convertible** - Simple CSS properties that can be converted to Tailwind utilities
- **theme-token** - Uses CSS custom properties like var(--color-text-main)
- **custom-logic** - Complex behavior, animations, or advanced CSS that should remain custom
- **responsive** - Contains media queries or responsive behavior
- **semantic-class** - Already a semantic class that could use @apply internally

---

## src/index.scss

- **@font-face** - custom-logic - Font loading definition
- **@tailwind imports** - semantic-class - Tailwind CSS imports

---

## src/styles/\_base.scss

- **:root** - theme-token - Global CSS variables and layout dimensions
- **a** - theme-token - Link styling with theme variables
- **a:hover** - theme-token - Link hover states
- **html.dark a:hover** - theme-token - Dark theme link hover
- **h1** - @apply-convertible - Simple heading styles
- **mark** - theme-token - Search highlighting with theme colors
- **.small-caps** - @apply-convertible - Font variant styling
- **.invisible-dismissal** - semantic-class - Modal backdrop overlay
- **.invisible-dismissal-no-blur** - semantic-class - Backdrop variant
- **.invisible-dark** - semantic-class - Dark overlay variant
- **.error-label** - semantic-class - Error message styling
- **.card** - theme-token - Card component with theme borders
- **.bg-radial--accent-noise** - custom-logic - Complex background with multiple gradients
- **button** - @apply-convertible - Legacy button styles (may be unused)

---

## src/styles/\_colors.scss

- **:root** - theme-token - Light theme color definitions
- **html.dark** - theme-token - Dark theme color overrides
- **.accent-blue** - theme-token - Blue accent theme
- **.accent-purple** - theme-token - Purple accent theme
- **.accent-fuchsia** - theme-token - Fuchsia accent theme
- **.accent-orange** - theme-token - Orange accent theme
- **.accent-green** - theme-token - Green accent theme
- **.accent-yellow** - theme-token - Yellow accent theme

---

## src/styles/\_components.scss

- **.EmojiPickerReact** - theme-token - Third-party emoji picker theming
- **.-webkit-app-region-drag** - custom-logic - Electron titlebar dragging
- **.-webkit-app-region-no-drag** - custom-logic - Electron titlebar no-drag
- **.titlebar** - custom-logic - Electron titlebar styling
- **.titlebar button** - custom-logic - Electron titlebar button styling
- **.bg-mobile-overlay** - theme-token - Mobile overlay background
- **.bg-mobile-sidebar** - theme-token - Mobile sidebar background
- **.mobile-sidebar-right** - @apply-convertible - Mobile sidebar padding

---

## src/styles/\_chat.scss

- **.chat-container** - responsive - Chat layout with mobile optimizations
- **.message-name-mentions-you** - theme-token - Message mention styling
- **.message-name-mentions-role** - theme-token - Role mention styling
- **.message-mentions-you** - theme-token - Message background for mentions
- **.message-mentions-role** - theme-token - Message background for role mentions
- **.message-list** - responsive - Message list with mobile width handling
- **.message-list-expanded** - responsive - Expanded message list
- **.message-list::-webkit-scrollbar** - custom-logic - Scrollbar hiding
- **.message-sender-icon** - responsive - Message sender avatar
- **.message-content** - responsive - Message content with mobile optimizations
- **.message-sender-name** - @apply-convertible - Message sender name styling
- **.message-timestamp** - theme-token - Message timestamp styling
- **.message-post-content** - @apply-convertible - Message post content margin
- **.message-editor** - theme-token - Message editor styling with responsive behavior
- **.message-editor::placeholder** - theme-token - Message editor placeholder

---

## src/styles/\_modal_common.scss

- **.modal-body** - responsive - Modal body layout
- **.modal-width-large** - responsive - Large modal width
- **.modal-width-medium** - responsive - Medium modal width
- **.modal-buttons-responsive** - responsive - Modal button layout
- **.modal-text-label** - responsive - Modal text label sizing
- **.modal-text-section-header** - responsive - Modal section header
- **.modal-text-small** - responsive - Small modal text
- **.modal-input-text** - responsive - Modal input text sizing
- **.modal-input-select** - responsive - Modal select input sizing
- **.modal-icon-section** - responsive - Modal icon section padding
- **.modal-actions** - responsive - Modal actions padding
- **.modal-info** - @apply-convertible - Modal info text
- **.modal-complex-container** - responsive - Complex modal container
- **.modal-complex-layout** - responsive - Complex modal layout
- **.modal-complex-sidebar** - responsive - Complex modal sidebar
- **.modal-complex-content** - responsive - Complex modal content
- **.modal-nav-title** - semantic-class - Modal navigation title
- **.modal-nav-category** - theme-token - Modal navigation category
- **.modal-nav-mobile-single** - responsive - Mobile single column navigation
- **.modal-nav-mobile-2col** - responsive - Mobile two column navigation
- **.modal-content-header** - responsive - Modal content header
- **.modal-content-section** - responsive - Modal content section
- **.modal-content-actions** - responsive - Modal content actions
- **.modal-content-info** - responsive - Modal content info
- **.modal-content-section-header** - theme-token - Modal content section header
- **.modal-small-container** - responsive - Small modal container
- **.modal-small-layout** - @apply-convertible - Small modal layout
- **.modal-small-content** - @apply-convertible - Small modal content
- **.modal-small-actions** - responsive - Small modal actions
- **.modal-icon** - responsive - Modal icon styling
- **.modal-icon-editable** - responsive - Editable modal icon
- **.modal-banner** - responsive - Modal banner styling
- **.modal-banner-editable** - custom-logic - Editable banner with pseudo-elements
- **.modal-icon-editable::after** - custom-logic - Icon edit button pseudo-element
- **.modal-text-section** - responsive - Modal text section
- **.modal-role** - theme-token - Modal role styling

---

## src/components/Button.scss

- **.btn-base** - semantic-class - Base button class using @apply
- **.btn-primary** - theme-token - Primary button with theme colors
- **.btn-secondary** - theme-token - Secondary button with theme colors and responsive
- **.btn-light** - theme-token - Light button variant
- **.btn-light-outline** - theme-token - Light outline button
- **.btn-danger** - theme-token - Danger button with theme colors
- **.btn-small** - semantic-class - Small button modifier using @apply
- **.btn-disabled** - theme-token - Disabled button state
- **.btn-disabled-onboarding** - theme-token - Disabled onboarding button

---

## src/components/Input.scss

- **.quorum-input** - theme-token - Standard input styling
- **.quorum-input::placeholder** - theme-token - Input placeholder styling
- **.onboarding-input** - theme-token - Onboarding input variant
- **.onboarding-input::placeholder** - theme-token - Onboarding input placeholder

---

## src/components/Modal.scss

- **.quorum-modal** - responsive - Modal container with animations
- **.quorum-modal-closing** - custom-logic - Modal closing animation
- **@keyframes createBox** - custom-logic - Modal creation animation
- **.quorum-modal-close** - @apply-convertible - Modal close button positioning
- **.quorum-modal-title** - responsive - Modal title styling
- **.quorum-modal-container** - @apply-convertible - Modal container layout

---

## src/components/Container.scss

- **.container-unit** - responsive - Main container with mobile optimizations

---

## src/components/CloseButton.scss

- **.close-button** - @apply-convertible - Close button positioning

---

## src/components/ToggleSwitch.scss

- **.quorum-toggle-switch** - theme-token - Toggle switch styling
- **.quorum-toggle-switch-inactive** - theme-token - Inactive toggle state
- **.quorum-toggle-switch-active** - @apply-convertible - Active toggle positioning
- **.quorum-toggle-switch-flipper** - theme-token - Toggle switch flipper


---

## src/components/ReactTooltip.scss

- **@mixin tooltip-box** - theme-token - Tooltip box mixin
- **@mixin reset-text** - @apply-convertible - Text reset mixin
- **@mixin inherit-text** - @apply-convertible - Text inheritance mixin
- **.quorum-react-tooltip** - semantic-class - React tooltip using mixins
- **.quorum-react-tooltip-dark** - semantic-class - Dark react tooltip using mixins

---

## src/components/Connecting.scss

- **.connecting-splash** - theme-token - Connecting splash screen
- **.connecting-icon** - @apply-convertible - Connecting icon styling
- **@keyframes pulse-zoom** - custom-logic - Pulse animation
- **.pulse** - custom-logic - Pulse animation class
- **.connecting-message** - @apply-convertible - Connecting message styling

---

## src/components/AppWithSearch.scss

- **.app-with-search** - @apply-convertible - App with search container
- **.app-search-bar** - responsive - Search bar positioning with mobile optimizations

---

## src/components/navbar/NavMenu.scss

- **a.navbar-brand** - @apply-convertible - Navbar brand styling
- **html** - @apply-convertible - Base HTML font size
- **.logo** - @apply-convertible - Logo styling
- **header** - responsive - Header with mobile optimizations
- **.nav-menu-logo** - responsive - Navigation menu logo
- **.nav-menu-logo .space-icon** - responsive - Space icon in navigation
- **.nav-menu-spaces** - responsive - Navigation menu spaces
- **.nav-menu-spaces::-webkit-scrollbar** - custom-logic - Scrollbar hiding
- **.box-shadow** - @apply-convertible - Box shadow utility

---

## src/components/navbar/ExpandableNavMenu.scss

- **.expand-button** - responsive - Expand button styling
- **.expanded-nav-menu** - @apply-convertible - Expanded navigation menu
- **.expanded-nav-menu .quorum-button** - @apply-convertible - Button in expanded menu
- **.expanded-nav-menu .quorum-tooltip** - @apply-convertible - Tooltip in expanded menu
- **.expanded-nav-menu .quorum-tooltip-arrow-left::before** - custom-logic - Tooltip arrow pseudo-element
- **.expanded-nav-search-spaces** - @apply-convertible - Search spaces in expanded menu
- **.expanded-nav-add-spaces** - @apply-convertible - Add spaces in expanded menu
- **.expanded-nav-join-spaces** - @apply-convertible - Join spaces in expanded menu

---

## src/components/navbar/SpaceButton.scss

- **.space-button** - @apply-convertible - Space button styling

---

## src/components/navbar/SpaceIcon.scss

- **.space-icon** - responsive - Space icon with mobile optimizations
- **.space-icon-large** - @apply-convertible - Large space icon
- **.space-icon:hover** - theme-token - Space icon hover state
- **.space-icon-toggle** - @apply-convertible - Space icon toggle state
- **.space-icon-has-notifs-toggle** - theme-token - Space icon with notifications
- **.space-icon-selected** - responsive - Selected space icon
- **.space-icon-selected-toggle** - theme-token - Selected space icon toggle

---

## src/components/channel/ChannelList.scss

- **.channels-list** - theme-token - Channels list styling
- **.channels-list a** - theme-token - Channel list links
- **.channels-list a:hover** - @apply-convertible - Channel list link hover
- **.channels-list::-webkit-scrollbar** - custom-logic - Scrollbar hiding
- **.space-header** - theme-token - Space header styling
- **.space-context-menu-toggle-button** - @apply-convertible - Context menu toggle button

---

## src/components/channel/ChannelGroup.scss

- **.channel-group** - @apply-convertible - Channel group styling
- **.channel-group-name** - @apply-convertible - Channel group name
- **.channel-group-channel** - @apply-convertible - Channel group channel
- **.channel-group-channel-name** - @apply-convertible - Channel group channel name
- **.channel-configure** - @apply-convertible - Channel configure button
- **.channel-group-channel-name:hover** - responsive - Channel name hover with mobile
- **.channel-group-channel-name-focused** - theme-token - Focused channel name
- **.channel-group-channel-name-focused:hover** - custom-logic - Focused channel name hover
- **.channel-group-channel-name-mentions-you** - custom-logic - Channel mentions you
- **.channel-group-channel-name-mentions-role** - custom-logic - Channel mentions role

---

## src/components/channel/Channel.scss

- **.channel-name** - responsive - Channel name with mobile optimizations
- **.message** - @apply-convertible - Message styling
- **.message-editor** - theme-token - Message editor background

---

## src/components/channel/GroupEditor.scss

- **.group-editor** - theme-token - Group editor modal
- **.group-editor-header** - theme-token - Group editor header
- **.group-editor-text** - @apply-convertible - Group editor text section
- **.group-editor-username** - @apply-convertible - Group editor username
- **.group-editor-info** - @apply-convertible - Group editor info
- **.group-editor-editor-actions** - @apply-convertible - Group editor actions
- **.group-editor-content** - theme-token - Group editor content
- **.group-editor-icon** - @apply-convertible - Group editor icon
- **.group-editor-icon-editable** - @apply-convertible - Editable group editor icon
- **.group-editor-icon-editable::after** - custom-logic - Icon edit button pseudo-element
- **.group-editor-banner** - @apply-convertible - Group editor banner
- **.group-editor-banner-editable** - @apply-convertible - Editable group editor banner
- **.group-editor-banner-editable::after** - custom-logic - Banner edit button pseudo-element
- **.group-editor-content-section-header** - theme-token - Content section header
- **.group-editor-content-section-header:first-child** - @apply-convertible - First section header
- **.group-editor-edit-button** - @apply-convertible - Edit button positioning

---

## src/components/channel/LeaveSpace.scss

- **.leave-space** - theme-token - Leave space modal
- **.leave-space-header** - theme-token - Leave space header
- **.leave-space-text** - @apply-convertible - Leave space text section
- **.leave-space-username** - @apply-convertible - Leave space username
- **.leave-space-info** - @apply-convertible - Leave space info
- **.leave-space-editor-actions** - @apply-convertible - Leave space actions
- **.leave-space-content** - theme-token - Leave space content
- **.leave-space-icon** - @apply-convertible - Leave space icon
- **.leave-space-icon-editable** - @apply-convertible - Editable leave space icon
- **.leave-space-icon-editable::after** - custom-logic - Icon edit button pseudo-element
- **.leave-space-banner** - @apply-convertible - Leave space banner
- **.leave-space-banner-editable** - @apply-convertible - Editable leave space banner
- **.leave-space-banner-editable::after** - custom-logic - Banner edit button pseudo-element
- **.leave-space-content-section-header** - theme-token - Content section header
- **.leave-space-content-section-header:first-child** - @apply-convertible - First section header
- **.leave-space-edit-button** - @apply-convertible - Edit button positioning

---

## src/components/direct/DirectMessage.scss

- **.direct-message-name** - responsive - Direct message name with mobile optimizations
- **.message-editor** - theme-token - Message editor background
- **.message-editor-reply** - @apply-convertible - Reply message editor
- **.message-reply-curve** - theme-token - Message reply curve
- **.message-reply-heading** - @apply-convertible - Reply heading layout
- **.message-reply-sender-icon** - @apply-convertible - Reply sender icon
- **.message-reply-sender-name** - @apply-convertible - Reply sender name
- **.message-reply-text** - @apply-convertible - Reply text styling

---

## src/components/direct/DirectMessageContact.scss

- **.direct-message-contact** - @apply-convertible - Direct message contact styling
- **.direct-message-contact-name** - @apply-convertible - Contact name styling

---

## src/components/direct/DirectMessageContactsList.scss

- **.direct-messages-list** - theme-token - Direct messages list
- **.direct-messages-list a** - theme-token - Direct messages list links
- **.direct-messages-list a:hover** - @apply-convertible - Direct messages list link hover
- **.channels-list::-webkit-scrollbar** - custom-logic - Scrollbar hiding
- **.space-header** - theme-token - Space header styling
- **.space-context-menu-toggle-button** - @apply-convertible - Context menu toggle button

---

## src/components/direct/DirectMessages.scss

- **.direct-messages-container** - responsive - Direct messages container with mobile optimizations
- **.direct-messages-container-channels** - responsive - Direct messages container channels with mobile slide-in

---

## src/components/message/Message.scss

- **@keyframes flash-highlight** - custom-logic - Flash highlight animation
- **.message-highlighted** - custom-logic - Message highlighted animation

---

## src/components/space/Space.scss

- **.space-container** - responsive - Space container with mobile optimizations
- **.space-container-channels** - responsive - Space container channels with mobile slide-in

---

## src/components/user/UserProfile.scss

- **.user-profile** - theme-token - User profile modal
- **.user-profile-header** - theme-token - User profile header
- **.user-profile-text** - @apply-convertible - User profile text section
- **.user-profile-username** - @apply-convertible - User profile username
- **.user-profile-info** - @apply-convertible - User profile info
- **.user-profile-editor-actions** - @apply-convertible - User profile actions
- **.user-profile-content** - @apply-convertible - User profile content
- **.user-profile-icon** - @apply-convertible - User profile icon
- **.user-profile-icon-editable** - @apply-convertible - Editable user profile icon
- **.user-profile-icon-editable::after** - custom-logic - Icon edit button pseudo-element
- **.user-profile-content-section-header** - theme-token - Content section header
- **.user-profile-content-section-header:first-child** - @apply-convertible - First section header
- **.user-profile-edit-button** - @apply-convertible - Edit button positioning

---

## src/components/user/UserStatus.scss

- **.user-status** - responsive - User status with mobile optimizations
- **.user-status:hover** - theme-token - User status hover state
- **.user-status-icon** - @apply-convertible - User status icon
- **.user-status-text** - @apply-convertible - User status text
- **.user-status-username** - @apply-convertible - User status username
- **.user-status-info** - @apply-convertible - User status info
- **.user-status-menu** - @apply-convertible - User status menu

---

## src/components/user/UserOnlineStateIndicator.scss

- **.user-state-indicator** - @apply-convertible - User state indicator
- **.user-state-online::before** - custom-logic - Online state indicator pseudo-element

---

## src/components/modals/CreateSpaceModal.scss

- **.attachment-drop** - theme-token - Attachment drop zone
- **.attachment-drop .attachment-drop-icon** - @apply-convertible - Attachment drop icon
- **.attachment-drop:hover** - theme-token - Attachment drop hover
- **.attachment-drop::after** - custom-logic - Attachment drop pseudo-element

---

## src/components/modals/JoinSpaceModal.scss

- **.modal-join-space** - semantic-class - Join space modal using @extend
- **.modal-join-space-icon** - semantic-class - Join space modal icon using @extend
- **.modal-join-space-actions** - semantic-class - Join space modal actions using @extend
- **.modal-join-space-info** - semantic-class - Join space modal info using @extend

---

## src/components/modals/NewDirectMessageModal.scss

- **.modal-new-direct-message** - semantic-class - New direct message modal using @extend
- **.modal-new-direct-message-icon** - semantic-class - New direct message modal icon using @extend
- **.modal-new-direct-message-actions** - semantic-class - New direct message modal actions using @extend
- **.modal-new-direct-message-info** - semantic-class - New direct message modal info using @extend

---

## src/components/search/GlobalSearch.scss

- **.global-search** - responsive - Global search container with mobile z-index
- **.global-search-bar** - semantic-class - Global search bar (inherits from SearchBar)
- **.global-search-results** - semantic-class - Global search results (inherits from SearchResults)

---

## src/components/search/SearchBar.scss

- **.search-bar** - @apply-convertible - Search bar container
- **.search-input-container** - theme-token - Search input container
- **.search-input-container:hover** - theme-token - Search input container hover
- **.search-input-container.focused** - theme-token - Search input container focused
- **.search-icon** - theme-token - Search icon
- **.search-icon-focused** - theme-token - Search icon focused
- **.search-input** - theme-token - Search input
- **.search-input::placeholder** - theme-token - Search input placeholder
- **.search-input:disabled** - @apply-convertible - Disabled search input
- **.search-clear-button** - theme-token - Search clear button
- **.search-clear-button:hover** - theme-token - Search clear button hover
- **.search-shortcut** - @apply-convertible - Search shortcut (hidden)
- **.search-suggestions** - theme-token - Search suggestions
- **.search-suggestion** - theme-token - Search suggestion item
- **.search-suggestion:hover** - theme-token - Search suggestion hover
- **.search-suggestion.selected** - theme-token - Selected search suggestion
- **.search-suggestion .suggestion-icon** - theme-token - Suggestion icon
- **.dark .search-suggestions** - theme-token - Dark theme search suggestions

---

## src/components/search/SearchResults.scss

- **.search-results** - theme-token - Search results container
- **.search-results-header** - theme-token - Search results header
- **.results-count** - semantic-class - Results count styling
- **.search-results-list** - theme-token - Search results list
- **.search-empty-state** - @apply-convertible - Empty state styling
- **.search-loading-state** - @apply-convertible - Loading state styling
- **.search-error-state** - @apply-convertible - Error state styling
- **.search-no-results** - @apply-convertible - No results state styling
- **.empty-icon** - theme-token - Empty icon
- **.loading-icon** - theme-token - Loading icon
- **.error-icon** - theme-token - Error icon
- **.empty-message** - theme-token - Empty message
- **.loading-message** - theme-token - Loading message
- **.error-message** - theme-token - Error message
- **.empty-hint** - theme-token - Empty hint
- **.dark .search-results** - theme-token - Dark theme search results
- **@keyframes searchResultsOpen** - custom-logic - Search results open animation

---

## src/components/search/SearchResultItem.scss

- **.search-result-item** - theme-token - Search result item
- **.search-result-item:hover** - theme-token - Search result item hover
- **.search-result-item:focus** - theme-token - Search result item focus
- **.search-result-item:last-child** - @apply-convertible - Last search result item
- **.result-header** - @apply-convertible - Result header layout
- **.result-meta** - @apply-convertible - Result meta information
- **.result-type-icon** - theme-token - Result type icon
- **.result-user-icon** - theme-token - Result user icon
- **.result-date** - theme-token - Result date
- **.result-channel** - theme-token - Result channel
- **.result-sender** - theme-token - Result sender
- **.result-separator** - theme-token - Result separator
- **.result-score** - theme-token - Result score
- **.result-content** - @apply-convertible - Result content
- **.result-text** - theme-token - Result text
- **.result-highlights** - @apply-convertible - Result highlights
- **.highlights-label** - theme-token - Highlights label
- **.highlight-term** - theme-token - Highlight term
- **.highlights-more** - theme-token - Highlights more
- **.dark .result-score** - theme-token - Dark result score
- **.dark .highlight-term** - theme-token - Dark highlight term
- **@media (max-width: 768px)** - responsive - Mobile responsive styles

---

## Summary

**Total selectors analyzed:** 379

**Classification breakdown:**

- **@apply-convertible:** 127 selectors (33.5%)
- **theme-token:** 163 selectors (43.0%)
- **custom-logic:** 42 selectors (11.1%)
- **responsive:** 38 selectors (10.0%)
- **semantic-class:** 9 selectors (2.4%)

**Recommendations:**

1. Start with @apply-convertible selectors for quick wins
2. Theme-token selectors should be carefully evaluated - many can be converted to semantic classes
3. Custom-logic selectors (animations, pseudo-elements) should remain as custom CSS
4. Responsive selectors should be converted to Tailwind's responsive utilities
5. Semantic-class selectors are already well-structured and may just need @apply optimization

This inventory will guide the systematic refactoring of the CSS codebase to use Tailwind CSS utilities while preserving necessary custom styles and maintaining the existing design system.
