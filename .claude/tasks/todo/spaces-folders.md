# Space Reordering & Folder Management Implementation Guide

This is just a generic plan and muste be carefully validate against the current repo, tech stack, existing plugins/components.

## Overview

This guide covers implementing Discord-style space (server) reordering and folder grouping functionality for both web and mobile platforms. The feature allows users to drag-and-drop spaces to reorder them and create folders by dropping one space onto another.

## Cross-Platform Architecture

### Web Implementation
- **Library**: @dnd-kit (already in use)
- **Components**: DndContext, SortableContext, useSortable
- **UX Pattern**: Mouse drag-and-drop with hover states

### Mobile Implementation  
- **Library**: react-native-draggable-flatlist
- **Components**: DraggableFlatList with custom render items
- **UX Pattern**: Long-press to initiate drag, then drag-and-drop

### Shared Business Logic
- Space management hooks and utilities
- Folder creation/deletion logic
- State synchronization with backend
- Persistence layer

## Data Structure Design

### Core Data Models

```typescript
interface Space {
  id: string;
  name: string;
  icon: string;
  order: number;
  folderId?: string; // null if not in folder
}

interface SpaceFolder {
  id: string;
  name: string;
  color: FolderColor; // predefined color from enum
  order: number;
  isExpanded: boolean;
  spaceIds: string[]; // ordered list of spaces in folder
  createdAt: Date;
  updatedAt: Date;
}

enum FolderColor {
  RED = 'red',
  ORANGE = 'orange', 
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
  PURPLE = 'purple',
  PINK = 'pink',
  GRAY = 'gray',
}

interface FolderColorConfig {
  id: FolderColor;
  name: string;
  hex: string;
  darkHex?: string; // for dark mode
}

interface SpaceListItem {
  id: string;
  type: 'space' | 'folder';
  order: number;
  data: Space | SpaceFolder;
}
```

### State Management Considerations

- **Optimistic Updates**: Update UI immediately, rollback on error
- **Consistent Ordering**: Use order fields for deterministic sorting
- **Atomic Operations**: Folder creation/deletion should be transactional
- **Conflict Resolution**: Handle concurrent modifications gracefully

## Web Implementation Details

### @dnd-kit Setup

**Advantages of @dnd-kit:**
- Excellent collision detection algorithms
- Built-in accessibility support
- Smooth animations and visual feedback
- Supports complex drag operations (space-to-space, space-to-folder)

**Key Components:**
- `DndContext` for overall drag state management
- `SortableContext` for reorderable lists
- `useSortable` hook for individual draggable items
- `DragOverlay` for custom drag preview

### Collision Detection Strategy

```typescript
// Custom collision detection for folder creation
const customCollisionDetection = (args) => {
  // 1. Check if dragging space over another space (folder creation)
  // 2. Check if dragging space over folder (add to folder)
  // 3. Check if dragging folder (folder reordering)
  // 4. Fall back to default collision detection
};
```

### Web-Specific Considerations

- **Hover States**: Visual feedback when hovering over drop targets
- **Scroll During Drag**: Auto-scroll when dragging near edges
- **Mouse Interactions**: Different behavior for left-click vs right-click
- **Keyboard Accessibility**: Support arrow keys and Enter/Space for selection
- **Folder Tooltips**: Show folder names on hover using react-tooltip
- **Color Picker Integration**: Right-click or settings menu for folder customization

## Mobile Implementation Details

### react-native-draggable-flatlist Setup

**Why This Library:**
- Performant with large lists (60fps animations)
- Built on react-native-reanimated for smooth gestures
- Supports complex drag interactions
- Actively maintained with good community support

**Key Features:**
- Long-press activation (matches mobile UX expectations)
- Visual feedback during drag (scaling, shadow effects)
- Auto-scroll when dragging near edges
- Haptic feedback integration

### Mobile UX Patterns

```typescript
// Long-press activation with context menu
const handleLongPress = (space) => {
  // Option 1: Immediate drag activation (Discord pattern)
  startDrag(space);
  
  // Option 2: Context menu first, then drag option
  showActionSheet(['Move Space', 'Create Folder', 'Cancel']);
};
```

### Mobile-Specific Considerations

- **Touch Target Sizes**: Minimum 44dp touch targets (iOS guidelines)
- **Haptic Feedback**: Vibration on drag start, folder creation, errors
- **Visual Scaling**: Scale up dragged items for better visual feedback
- **Safe Area Handling**: Account for notches and home indicators
- **Performance**: Optimize for lower-end devices
- **Folder Names**: Consider long-press info panel or settings screen for name display
- **Color Selection**: Modal or bottom sheet for folder customization

## Folder Customization Features

### Predefined Color System

Discord-style folder colors should be implemented with a limited, carefully chosen palette that works well in both light and dark themes.

#### Recommended Color Palette

```typescript
const FOLDER_COLORS: FolderColorConfig[] = [
  { 
    id: FolderColor.RED, 
    name: 'Red', 
    hex: '#ed4245', 
    darkHex: '#f04747' 
  },
  { 
    id: FolderColor.ORANGE, 
    name: 'Orange', 
    hex: '#f57c00', 
    darkHex: '#ff9800' 
  },
  { 
    id: FolderColor.YELLOW, 
    name: 'Yellow', 
    hex: '#fbc02d', 
    darkHex: '#ffeb3b' 
  },
  { 
    id: FolderColor.GREEN, 
    name: 'Green', 
    hex: '#57f287', 
    darkHex: '#00e676' 
  },
  { 
    id: FolderColor.BLUE, 
    name: 'Blue', 
    hex: '#5865f2', 
    darkHex: '#7289da' 
  },
  { 
    id: FolderColor.PURPLE, 
    name: 'Purple', 
    hex: '#9c27b0', 
    darkHex: '#e91e63' 
  },
  { 
    id: FolderColor.PINK, 
    name: 'Pink', 
    hex: '#eb459e', 
    darkHex: '#f48fb1' 
  },
  { 
    id: FolderColor.GRAY, 
    name: 'Gray', 
    hex: '#747f8d', 
    darkHex: '#99aab5' 
  },
];

const getColorForTheme = (color: FolderColor, isDark: boolean) => {
  const colorConfig = FOLDER_COLORS.find(c => c.id === color);
  return isDark ? colorConfig.darkHex : colorConfig.hex;
};
```

#### Color Selection Constraints

- **Limited Palette**: 8 predefined colors maximum
- **Accessibility**: High contrast ratios for text/icon visibility
- **Theme Consistency**: Colors work in both light and dark modes
- **Visual Hierarchy**: Colors shouldn't clash with space icons or UI elements

### Folder Naming System

#### Default Naming Strategy

```typescript
const generateDefaultFolderName = (spaces: Space[]) => {
  // Option 1: Use first space name
  if (spaces.length > 0) {
    return `${spaces[0].name} Group`;
  }
  
  // Option 2: Generic naming
  return `Folder ${folderCount + 1}`;
  
  // Option 3: Smart naming based on space categories
  const categories = detectSpaceCategories(spaces);
  if (categories.length === 1) {
    return `${categories[0]} Servers`;
  }
  
  return 'Mixed Servers';
};
```

#### Naming Rules and Validation

```typescript
const validateFolderName = (name: string): ValidationResult => {
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Folder name cannot be empty' };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'Folder name too long (50 character max)' };
  }
  
  if (containsInvalidCharacters(trimmed)) {
    return { valid: false, error: 'Invalid characters in folder name' };
  }
  
  return { valid: true };
};
```

### Web Implementation: Tooltips and Context Menus

#### Folder Tooltip Implementation

```typescript
import { Tooltip } from '../primitives/Tooltip';

const FolderIcon = ({ folder, onEdit, ...props }) => {
  return (
    <Tooltip 
      content={folder.name}
      placement="right"
      delay={500}
      className="space-folder-tooltip"
    >
      <div 
        className="folder-icon"
        style={{ backgroundColor: getColorForTheme(folder.color, isDarkMode) }}
        onContextMenu={(e) => showFolderContextMenu(e, folder)}
        {...props}
      >
        {/* Folder visual with space count badge */}
      </div>
    </Tooltip>
  );
};
```

#### Folder Customization Modal

```typescript
const FolderSettingsModal = ({ folder, isOpen, onClose, onSave }) => {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color);
  const [validation, setValidation] = useState(null);
  
  const handleSave = () => {
    const result = validateFolderName(name);
    if (!result.valid) {
      setValidation(result);
      return;
    }
    
    onSave({ ...folder, name, color });
    onClose();
  };
  
  return (
    <Modal title="Folder Settings" isOpen={isOpen} onClose={onClose}>
      <div className="folder-settings">
        <Input
          label="Folder Name"
          value={name}
          onChange={setName}
          error={validation?.error}
          maxLength={50}
        />
        
        <ColorPicker
          label="Folder Color"
          colors={FOLDER_COLORS}
          selected={color}
          onChange={setColor}
        />
        
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};
```

### Mobile Implementation: Color and Name Management

#### Mobile Folder Customization Options

Since mobile UX differs from desktop, consider these approaches for folder name display:

**Option 1: Long-press Info Panel**
```typescript
const showFolderInfo = (folder) => {
  // Show brief overlay with folder name and space count
  showToast(`${folder.name} • ${folder.spaceIds.length} spaces`, {
    duration: 2000,
    position: 'center'
  });
};
```

**Option 2: Folder Settings Screen**
```typescript
const navigateToFolderSettings = (folder) => {
  navigation.navigate('FolderSettings', { folderId: folder.id });
};
```

**Option 3: Bottom Sheet Context Menu**
```typescript
import { useActionSheet } from '@expo/react-native-action-sheet';

const FolderContextMenu = ({ folder }) => {
  const { showActionSheetWithOptions } = useActionSheet();
  
  const showOptions = () => {
    showActionSheetWithOptions({
      options: [
        `📁 ${folder.name}`, // Show name as first option (disabled)
        'Edit Folder',
        'Change Color', 
        'Delete Folder',
        'Cancel'
      ],
      cancelButtonIndex: 4,
      destructiveButtonIndex: 3,
      disabledButtonIndices: [0], // Make folder name non-selectable
    }, handleSelection);
  };
};
```

#### Mobile Color Picker Component

```typescript
const MobileColorPicker = ({ selectedColor, onColorSelect, isVisible, onClose }) => {
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.colorPickerContainer}>
        <Text style={styles.title}>Choose Folder Color</Text>
        
        <View style={styles.colorGrid}>
          {FOLDER_COLORS.map((colorConfig) => (
            <Pressable
              key={colorConfig.id}
              style={[
                styles.colorOption,
                { backgroundColor: colorConfig.hex },
                selectedColor === colorConfig.id && styles.selectedColor
              ]}
              onPress={() => {
                onColorSelect(colorConfig.id);
                onClose();
              }}
            >
              {selectedColor === colorConfig.id && (
                <CheckIcon color="white" size={24} />
              )}
            </Pressable>
          ))}
        </View>
        
        <Button title="Cancel" onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
};
```

### Desktop Folder Creation
1. Drag space A over space B
2. Visual feedback: Highlight target space
3. On drop: Create folder containing both spaces
4. Folder appears in position of target space

### Mobile Folder Creation
1. Long-press space A to start drag
2. Drag over space B until highlighted
3. Release to create folder
4. Optional: Show confirmation dialog

### Folder Creation Rules

```typescript
const canCreateFolder = (sourceSpace, targetSpace) => {
  // Rules to validate folder creation
  return (
    sourceSpace.id !== targetSpace.id &&
    !sourceSpace.folderId && // Source not already in folder
    !targetSpace.folderId && // Target not already in folder
    sourceSpace.type === 'space' &&
    targetSpace.type === 'space'
  );
};

// Enhanced folder validation with color and naming
const validateFolderCreation = (sourceSpace, targetSpace, folderData) => {
  const baseValidation = canCreateFolder(sourceSpace, targetSpace);
  if (!baseValidation) return false;
  
  // Validate color is from approved palette
  if (!FOLDER_COLORS.some(c => c.id === folderData.color)) {
    throw new Error('Invalid folder color selected');
  }
  
  // Validate folder name
  const nameValidation = validateFolderName(folderData.name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error);
  }
  
  return true;
};
```

## State Management Strategy

### Optimistic Updates

```typescript
const reorderSpaces = async (newOrder) => {
  // 1. Update UI immediately
  setSpaces(newOrder);
  
  try {
    // 2. Persist to backend
    await api.updateSpaceOrder(newOrder);
  } catch (error) {
    // 3. Rollback on failure
    setSpaces(previousOrder);
    showErrorToast('Failed to reorder spaces');
  }
};
```

### Conflict Resolution

- **Version Locking**: Include version/timestamp in updates
- **Last Writer Wins**: Simple conflict resolution strategy
- **Merge Strategies**: For complex folder operations
- **Real-time Sync**: WebSocket updates for multi-device consistency

## Error Handling & Edge Cases

### Common Edge Cases

1. **Empty Folders**: 
   - Auto-delete folders with 0 spaces
   - Convert folders with 1 space back to regular space
   - Preserve folder name/color when re-adding spaces

2. **Drag Cancellation**:
   - User drags outside valid drop zone
   - Network error during operation
   - User cancels mid-drag (ESC key, back gesture)

3. **Concurrent Modifications**:
   - Another user modifies space order
   - Space deleted while being dragged
   - Folder deleted while space being added
   - Folder color/name changed during operation

4. **Performance Issues**:
   - Large numbers of spaces (100+)
   - Slow network connections
   - Memory constraints on mobile

5. **Folder Customization Edge Cases**:
   - Invalid color selection (not in predefined palette)
   - Duplicate folder names (should be allowed)
   - Very long folder names affecting UI layout
   - Color changes affecting readability of folder icons
   - Theme changes affecting folder color visibility

### Error Recovery Strategies

```typescript
const handleDragError = (error, operation) => {
  switch (error.type) {
    case 'NETWORK_ERROR':
      // Queue operation for retry
      queueForRetry(operation);
      showToast('Will retry when connection restored');
      break;
      
    case 'VALIDATION_ERROR':
      // Rollback and show specific error
      rollbackOperation(operation);
      showError(error.message);
      break;
      
    case 'CONFLICT_ERROR':
      // Refresh data and show conflict resolution
      refreshSpaceData();
      showConflictDialog(error.conflictData);
      break;
  }
};
```

## Performance Optimization

### Web Performance

- **Virtual Scrolling**: For lists with 50+ spaces
- **Debounced Updates**: Batch rapid reorder operations
- **Memoization**: Prevent unnecessary re-renders during drag
- **Image Optimization**: Lazy load space icons

### Mobile Performance

- **FlatList Optimization**: Use `getItemLayout` when possible
- **Image Caching**: Preload and cache space icons
- **Memory Management**: Release resources when out of view
- **Animation Performance**: Use native driver for animations

```typescript
// Optimize FlatList rendering
const getItemLayout = (data, index) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
});

const keyExtractor = (item) => item.id; // Stable keys for performance
```

## Accessibility Considerations

### Web Accessibility

- **Keyboard Navigation**: Full keyboard support for drag operations
- **Screen Reader Support**: Announce drag state changes
- **Focus Management**: Maintain focus during operations
- **ARIA Labels**: Descriptive labels for drag handles and drop zones

```typescript
// Screen reader announcements
const announceToScreenReader = (message) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
};
```

### Mobile Accessibility

- **VoiceOver/TalkBack**: Custom accessibility actions
- **Haptic Feedback**: Provide audio/haptic cues for operations
- **Large Text Support**: Scale with system font settings
- **High Contrast**: Ensure visibility in accessibility modes

## Testing Strategy

### Unit Tests

- Drag operation logic
- Folder creation/deletion rules
- State management functions
- Error handling scenarios

### Integration Tests

- Cross-platform drag behavior
- API integration and error handling
- State synchronization between components
- Performance under load

### Manual Testing Checklist

**Desktop:**
- [ ] Drag space to reorder
- [ ] Drag space onto space to create folder
- [ ] Drag space into existing folder
- [ ] Drag space out of folder
- [ ] Drag folder to reorder
- [ ] Right-click context menus work
- [ ] Keyboard navigation works
- [ ] Multiple selection operations
- [ ] Folder tooltips show names on hover
- [ ] Folder color picker accessible via right-click
- [ ] Folder naming modal validates input correctly
- [ ] All predefined colors render correctly in light/dark themes

**Mobile:**
- [ ] Long-press to initiate drag
- [ ] Visual feedback during drag
- [ ] Folder creation by dropping space on space
- [ ] Add space to existing folder
- [ ] Remove space from folder
- [ ] Haptic feedback works
- [ ] Works on both iOS and Android
- [ ] Performance is smooth on low-end devices
- [ ] Folder color selection modal works correctly
- [ ] Folder name editing through settings/context menu
- [ ] Long-press info shows folder names appropriately
- [ ] Color picker shows all predefined colors correctly

### Cross-Platform Testing

- [ ] Operations sync between web and mobile
- [ ] Folder state consistency
- [ ] Order preservation across platforms
- [ ] Real-time updates work correctly
- [ ] Folder colors display consistently across platforms
- [ ] Folder names sync and display appropriately on each platform
- [ ] Color theme changes update folder appearances correctly

## Best Practices & Recommendations

### Development Workflow

1. **Start with Shared Logic**: Build state management first
2. **Platform-Specific UI**: Implement drag interactions separately
3. **Progressive Enhancement**: Basic reordering first, then folders
4. **Test Early and Often**: Validate on both platforms continuously

### Code Organization

```
components/
├── space-management/
│   ├── shared/
│   │   ├── hooks/
│   │   │   ├── useSpaceManagement.ts
│   │   │   ├── useFolderOperations.ts
│   │   │   ├── useSpaceReordering.ts
│   │   │   └── useFolderCustomization.ts
│   │   ├── types/
│   │   │   ├── space-types.ts
│   │   │   └── folder-types.ts
│   │   ├── constants/
│   │   │   └── folder-colors.ts
│   │   └── utils/
│   │       ├── space-validation.ts
│   │       ├── folder-validation.ts
│   │       ├── order-calculations.ts
│   │       └── color-helpers.ts
│   ├── web/
│   │   ├── SpaceList.web.tsx
│   │   ├── DraggableSpace.web.tsx
│   │   ├── SpaceFolder.web.tsx
│   │   ├── FolderTooltip.web.tsx
│   │   ├── FolderSettingsModal.web.tsx
│   │   └── ColorPicker.web.tsx
│   └── mobile/
│       ├── SpaceList.native.tsx
│       ├── DraggableSpace.native.tsx
│       ├── SpaceFolder.native.tsx
│       ├── FolderContextMenu.native.tsx
│       ├── FolderSettingsScreen.native.tsx
│       └── MobileColorPicker.native.tsx
```

### Performance Guidelines

- **Limit Concurrent Operations**: Only one drag operation at a time
- **Batch Updates**: Group multiple changes into single API calls
- **Cache Aggressively**: Cache space data and images
- **Monitor Memory**: Watch for memory leaks in drag operations

### User Experience Guidelines

- **Immediate Feedback**: Show changes instantly, confirm later
- **Clear Visual Cues**: Make drop zones and drag states obvious
- **Consistent Behavior**: Same operations should work similarly across platforms
- **Graceful Degradation**: Provide fallbacks when drag fails

## Security Considerations

### Authorization

- Verify user permissions before allowing reorder operations
- Validate space ownership for folder operations
- Rate limit reorder requests to prevent abuse

### Data Validation

```typescript
const validateSpaceOrder = (spaces) => {
  // Validate all spaces belong to user
  // Check for duplicate orders
  // Ensure folder constraints are met
  // Verify space IDs exist and are accessible
};

const validateFolderUpdate = (folder) => {
  // Validate folder belongs to user
  // Check color is from approved palette
  // Validate folder name meets requirements
  // Ensure folder contains valid spaces
  // Verify folder order is within bounds
};
```

### API Security

- Use CSRF tokens for state-changing operations
- Validate all inputs on backend
- Log space management operations for audit trail
- Implement proper rate limiting

## Deployment Considerations

### Feature Flags

```typescript
const FEATURES = {
  SPACE_REORDERING: 'space_reordering_enabled',
  FOLDER_MANAGEMENT: 'folder_management_enabled',
  MOBILE_DRAG_DROP: 'mobile_drag_drop_enabled',
};

const canReorderSpaces = useFeatureFlag(FEATURES.SPACE_REORDERING);
```

### Gradual Rollout

1. **Phase 1**: Enable for internal users
2. **Phase 2**: Enable for beta users
3. **Phase 3**: Gradual rollout to 10%, 50%, 100%
4. **Monitor**: Performance metrics and error rates at each phase

### Rollback Strategy

- Feature flags for immediate disable
- Database rollback procedures
- Clear user communication if features are disabled
- Preserve user data during rollbacks

## Monitoring & Analytics

### Key Metrics

- **Usage Metrics**: How often users reorder spaces
- **Performance Metrics**: Drag operation completion times
- **Error Rates**: Failed operations and reasons
- **User Engagement**: Folder usage and organization patterns

### Error Tracking

```typescript
const trackDragError = (error, context) => {
  analytics.track('space_drag_error', {
    error_type: error.type,
    platform: context.platform,
    operation: context.operation,
    user_id: context.userId,
    timestamp: Date.now(),
  });
};
```

### Performance Monitoring

- Track drag operation latency
- Monitor memory usage during operations
- Measure UI responsiveness
- Alert on performance degradation

---

This comprehensive guide provides the foundation for implementing robust space reordering and folder management across both web and mobile platforms. The key to success is maintaining consistency in user experience while leveraging platform-specific strengths and addressing platform-specific constraints.