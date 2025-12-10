# Dropdown Panels

## Overview

The dropdown panel is a versatile UI component used throughout the Quorum desktop and web application to display various types of content, such as search results, pinned messages, and notifications. It is designed to be a flexible and reusable component that can be easily adapted to different use cases.

## Implementation

The core of this feature is the `DropdownPanel` component, located in `src/components/ui/DropdownPanel.tsx`. This component is responsible for rendering the panel and its content, and it provides a number of props to customize its appearance and behavior.

### Desktop Implementation

On desktop devices, the `DropdownPanel` component renders as a traditional dropdown panel that appears below the element that triggered it. It can be positioned in different ways, such as centered, right-aligned, or below the search bar.

### Mobile (Touch) Implementation

On touch devices, the `DropdownPanel` component uses the `MobileDrawer` component to render the content in a bottom sheet. This provides a more mobile-friendly experience, as it is easier to interact with a bottom sheet on a touch screen.

The `DropdownPanel` component automatically detects whether the user is on a touch device and renders the appropriate component. This is done using the `isTouchDevice` utility function.

The `MobileDrawer` component, located in `src/components/ui/MobileDrawer.tsx`, provides a swipe-to-close gesture and a backdrop that can be tapped to close the drawer.

## Content Types

The `DropdownPanel` component is used to display the following types of content:

### Pinned Messages

The `PinnedMessagesPanel` component uses the `DropdownPanel` to display a list of pinned messages in a channel. On desktop, this appears as a dropdown panel on the right side of the screen. On mobile, it appears as a bottom sheet.

### Notifications

The `NotificationPanel` component uses the `DropdownPanel` to display a list of notifications. Similar to the pinned messages panel, it appears as a dropdown on desktop and a bottom sheet on mobile.

### Search Results

The `SearchResults` component uses the `DropdownPanel` to display a list of search results. On desktop, the results appear in a dropdown below the search bar. On mobile, the search input and results are displayed in a bottom sheet. This provides a more immersive search experience on smaller screens.

## Conclusion

The `DropdownPanel` and `MobileDrawer` components work together to provide a flexible and responsive UI for displaying various types of content. By automatically switching between a dropdown panel and a bottom sheet based on the user's device, we can provide an optimal user experience across all platforms.

---

_Verified: 2025-12-09 - File paths confirmed current_