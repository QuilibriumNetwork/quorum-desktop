# Modal System Documentation

## Overview

The Quorum Desktop app uses a **hybrid modal system** with multiple rendering strategies designed for cross-platform compatibility and consistent user experience. The system addresses different technical challenges (z-index stacking, state management, performance) through three distinct modal rendering patterns.

## Modal System Architecture

### **Current System: Three Modal Rendering Strategies**

The app currently uses **three different modal systems** in parallel, each solving specific technical problems:

#### **🏗️ System 1: ModalProvider (App-Level Context Modals)**
- **Render Location**: Router level (highest in component tree)
- **Used By**: UserSettingsModal, SpaceEditor, ChannelEditor, KickUserModal, etc.
- **State Management**: useModalState hook + React Context
- **Problem Solved**: Complex state management, centralized modal control
- **Z-Index**: Perfect (rendered above all UI elements)

#### **📐 System 2: Layout-Level Modals (Layout Component)**  
- **Render Location**: Layout.tsx component
- **Used By**: CreateSpaceModal, ConfirmationModal
- **State Management**: useModalManagement hook + Context providers
- **Problem Solved**: Z-index stacking issues, simpler than ModalProvider
- **Z-Index**: Perfect (rendered before NavMenu)

#### **⚠️ System 3: Component-Level Modals (DEPRECATED - AVOID)**
- **Render Location**: Deep in component tree (Message.tsx, etc.)
- **Used By**: Previously ConfirmationModal (now migrated), some legacy modals
- **State Management**: Local component state
- **Problem Solved**: None (causes problems)
- **Z-Index**: **BROKEN** - trapped by CSS stacking contexts

### **Why Three Systems Exist**

This hybrid approach emerged organically to solve different problems:

1. **ModalProvider** was created for complex modals needing centralized state
2. **Layout-Level** was used for simpler modals (CreateSpaceModal worked fine)
3. **Component-Level** was the original approach but causes z-index issues

### **System Comparison & Trade-offs**

| Aspect | ModalProvider | Layout-Level | Component-Level |
|--------|--------------|--------------|----------------|
| **Z-Index** | ✅ Perfect | ✅ Perfect | ❌ Broken |
| **Setup Complexity** | 🟡 High | 🟢 Low | 🟢 Very Low |
| **State Management** | ✅ Centralized | 🟡 Local | 🟢 Simple |
| **Performance** | ✅ Conditional render | ✅ Conditional render | ✅ Conditional render |
| **Prop Drilling** | ✅ None (Context) | 🟡 Some (Context) | ❌ Heavy drilling |
| **Maintainability** | ✅ High | 🟢 Good | ❌ Poor |

### **Current System Issues & Improvements Needed**

#### **🔴 Known Issues with Current Hybrid System**

1. **Inconsistency**: Developers must learn three different patterns
2. **Context Confusion**: Multiple context systems (ModalProvider, ConfirmationModalProvider, local state)
3. **Code Duplication**: Similar state management patterns across systems
4. **Documentation Burden**: More complex mental model for new developers
5. **Migration Risk**: Legacy component-level modals can break with layout changes

#### **📊 Modal Distribution Analysis**

- **ModalProvider**: ~6 modals (complex modals)
- **Layout-Level**: ~2 modals (CreateSpaceModal, ConfirmationModal) 
- **Component-Level**: ~1-2 legacy modals (need migration)

#### **Potential System Improvements**

**Recommendations for future refactoring**:

#### **🎯 Option A: Unified ModalProvider System (Recommended)**
- Migrate all modals to single ModalProvider
- Create modal "types" for different complexity levels
- ✅ **Pros**: Single system, centralized state, perfect z-index, consistent patterns
- ❌ **Cons**: Migration effort, slightly more boilerplate for simple modals
- **Migration Effort**: Medium (2-3 modals to migrate)

#### **Option B: Enhanced Layout-Level System**  
- Make Layout-Level system more powerful (handle complex state)
- Deprecate ModalProvider gradually
- ✅ **Pros**: Simpler setup, good z-index, less context complexity
- ❌ **Cons**: More code in Layout.tsx, less centralized than ModalProvider
- **Migration Effort**: High (6+ modals to migrate)

#### **Option C: Hybrid with Clear Rules (Current)**
- Keep existing system with better documentation
- Establish strict usage guidelines
- ✅ **Pros**: No migration needed, works with existing code
- ❌ **Cons**: Maintains three-system complexity, developer learning curve
- **Migration Effort**: None (documentation only)

#### **🚀 Recommended Next Steps**

1. **Short Term**: Use current hybrid system with clear guidelines (this documentation)
2. **Medium Term**: Evaluate unified ModalProvider migration  
3. **Long Term**: Consider dedicated modal management library if complexity grows

#### **Migration Strategy (If Chosen)**

If moving to unified ModalProvider:
1. Create generic modal types in ModalProvider
2. Migrate Layout-Level modals first (easiest)
3. Update documentation and examples
4. Create migration guide for future modals

### Core Components

#### **1. Modal Primitive** (`src/components/primitives/Modal`)

The foundation of all modals, providing:

- Consistent styling and animations (300ms transitions)
- Built-in close button with ESC key and backdrop click support
- Responsive sizing with predefined size variants
- Cross-platform compatibility (web/mobile)
- Proper z-index management and backdrop blur

```tsx
import { Modal } from '../primitives';

<Modal
  title="Modal Title"
  visible={visible}
  onClose={onClose}
  size="medium" // small | medium | large | full
  closeOnBackdropClick={true}
  closeOnEscape={true}
>
  <div className="modal-content">{/* Modal content */}</div>
</Modal>;
```

#### **2. Supporting Primitives**

All modals use these primitives for consistency:

- **Button** - All buttons use Button primitive
- **Input** - All text inputs use Input primitive
- **Switch** - All toggles use Switch primitive
- **Icon** - All icons use Icon primitive (no FontAwesome)
- **Tooltip** - Most tooltips use Tooltip primitive
- **Select** - All dropdowns use Select primitive

### CSS Architecture

#### **Modal Primitive Styles** (`src/components/primitives/Modal/Modal.scss`)

Core modal functionality:

- Size variants: `.quorum-modal-small`, `.quorum-modal-medium`, `.quorum-modal-large`
- Animation keyframes and transitions
- Close button positioning
- Responsive breakpoints
- Width utility classes (`.modal-width-large`, `.modal-width-medium`)

#### **Application-Specific Styles** (`src/styles/_modal_common.scss`)

Complex modal layouts and business logic styling:

- `.modal-complex-*` - Complex modal layouts (UserSettingsModal, SpaceEditor)
- `.modal-content-*` - Content section patterns
- `.modal-nav-*` - Navigation and sidebar patterns
- Form styling patterns and responsive layouts

### Modal Size Variants

- **`small`** - 400px max-width, for simple editors (ChannelEditor, GroupEditor)
- **`medium`** - 600px max-width, for standard forms (CreateSpaceModal, JoinSpaceModal)
- **`large`** - 800px max-width, for complex modals (UserSettingsModal, SpaceEditor)
- **`full`** - 95vw max-width, for content-heavy modals

## Modal Implementation Patterns

### **Pattern 1: Simple Modal**

**Best for**: Basic forms, confirmations, simple interactions
**Components**: CreateSpaceModal, KickUserModal, NewDirectMessageModal, LeaveSpaceModal

```tsx
import { Modal, Button, Input } from '../primitives';

const SimpleModal = ({ visible, onClose }) => {
  return (
    <Modal
      title="Simple Modal"
      visible={visible}
      onClose={onClose}
      size="medium"
    >
      <div className="modal-body">
        <Input value={value} onChange={setValue} />
        <div className="modal-buttons-responsive">
          <Button type="primary" onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </div>
    </Modal>
  );
};
```

### **Pattern 2: Complex Modal with Navigation**

**Best for**: Multi-section modals with sidebar navigation
**Components**: UserSettingsModal, SpaceEditor

```tsx
import { Modal, Button, Switch, Icon } from '../primitives';

const ComplexModal = ({ visible, onClose }) => {
  return (
    <Modal
      title=""
      visible={visible}
      onClose={onClose}
      size="large"
      className="modal-complex-wrapper"
      noPadding={true}
    >
      <div className="modal-complex-container-inner">
        <div className="modal-complex-layout">
          <div className="modal-complex-sidebar">
            {/* Navigation */}
            <div
              className="modal-nav-category"
              onClick={() => setSection('general')}
            >
              <Icon name="cog" className="mr-2 text-accent" />
              General
            </div>
          </div>
          <div className="modal-complex-content">{/* Content sections */}</div>
        </div>
      </div>
    </Modal>
  );
};
```

### **Pattern 3: Small Editor Modal**

**Best for**: Simple editors, quick configuration
**Components**: ChannelEditor, GroupEditor

```tsx
import { Modal, Button, Input, Icon } from '../primitives';

const EditorModal = ({ visible, onClose, isEdit, itemName }) => {
  return (
    <Modal
      title={isEdit ? t`Edit Item` : t`Add Item`}
      visible={visible}
      onClose={onClose}
      size="small"
    >
      <div className="modal-body" data-small-modal>
        <Input value={name} onChange={setName} />
        <div className="modal-actions">
          <Button type="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};
```

## Modal Component Inventory

### **Simple Modals (Standard Pattern)**

#### **1. CreateSpaceModal** - `src/components/modals/CreateSpaceModal.tsx`

- **Purpose**: Create new space with icon, name, and privacy settings
- **Size**: Medium
- **Primitives**: Modal, Input, Button, Switch, Icon, Tooltip
- **Special**: File upload (ReactTooltip for dropzone), Tooltip primitive for info icons
- **Title**: "Create a Space"

#### **2. JoinSpaceModal** - `src/components/modals/JoinSpaceModal.tsx`

- **Purpose**: Join space via invite link with preview
- **Size**: Medium
- **Primitives**: Modal, Input, Button
- **Special**: Space manifest decryption, custom SpaceIcon component
- **Title**: "Join Space"

#### **3. LeaveSpaceModal** - `src/components/modals/LeaveSpaceModal.tsx`

- **Purpose**: Confirmation for leaving a space
- **Size**: Medium
- **Primitives**: Modal, Button
- **Special**: Dynamic title with space name, double-click confirmation
- **Title**: "Leave {spaceName}"

#### **4. NewDirectMessageModal** - `src/components/modals/NewDirectMessageModal.tsx`

- **Purpose**: Start DM by entering user address
- **Size**: Standard
- **Primitives**: Modal, Input, Button
- **Title**: "New Direct Message"

#### **5. KickUserModal** - `src/components/modals/KickUserModal.tsx`

- **Purpose**: Remove user from space confirmation
- **Size**: Standard
- **Primitives**: Modal, Button
- **Title**: "Kick User"

#### **6. ConfirmationModal** - `src/components/modals/ConfirmationModal.tsx`

- **Purpose**: Universal confirmation dialog with preview support
- **Size**: Small
- **Rendering**: Layout-Level (Layout.tsx) via ConfirmationModalProvider
- **Primitives**: Modal, Button, Container, Text, FlexRow, Spacer, ScrollContainer, Icon
- **Features**: 
  - Preview content support (MessagePreview, etc.)
  - Shift+click bypass functionality
  - PROTIP display for power users
  - Configurable variants (danger, warning, info)
- **Usage Example**:
```tsx
const { showConfirmationModal } = useConfirmationModal();

showConfirmationModal({
  title: t`Delete Message`,
  message: t`Are you sure you want to delete this message?`,
  preview: <MessagePreview message={message} />,
  variant: 'danger',
  protipAction: t`delete`,
  onConfirm: handleDelete,
});
```
- **Title**: Dynamic (passed via config)
- **Migration Note**: Previously rendered in Message component (caused z-index issues), now uses Layout-Level system

### **Complex Modals (Multi-Section Pattern)**

#### **7. UserSettingsModal** - `src/components/modals/UserSettingsModal.tsx`

- **Purpose**: User account settings and preferences
- **Size**: Large
- **Primitives**: Modal, Switch, Input, Icon, Tooltip, Select
- **Sections**: General, Privacy/Security, Notifications, Appearance
- **Special**: File upload (ReactTooltip), ThemeRadioGroup, AccentColorSwitcher, ClickToCopyContent
- **Title**: Hidden (custom layout)

#### **8. SpaceEditor** - `src/components/space/SpaceEditor.tsx`

- **Purpose**: Comprehensive space management
- **Size**: Large
- **Primitives**: Modal, Switch, Input, Icon, Tooltip, Select, Button
- **Sections**: General, Roles, Emojis, Stickers, Invites
- **Special**: File uploads (ReactTooltip), complex role management
- **Title**: Hidden (custom layout)

### **Small Editor Modals**

#### **9. ChannelEditor** - `src/components/space/ChannelEditor.tsx`

- **Purpose**: Create/edit channels
- **Size**: Small
- **Primitives**: Modal, Input, Button, Icon
- **Special**: Dynamic title, delete warnings with custom close icons
- **Title**: "Add Channel" / "Edit Channel"

#### **10. GroupEditor** - `src/components/space/GroupEditor.tsx`

- **Purpose**: Create/edit channel groups
- **Size**: Small
- **Primitives**: Modal, Input, Button, Icon
- **Special**: Dynamic title, delete warnings with custom close icons
- **Title**: "Add Group" / "Edit Group"

## System Selection Guidelines

### **Which Modal System Should I Use?**

When creating a new modal, choose the appropriate system based on these criteria:

#### **✅ Use ModalProvider System When:**
- Modal has complex state management needs
- Modal is used across multiple components/pages  
- Modal needs centralized control (open from multiple places)
- Modal has multi-section interface (UserSettingsModal, SpaceEditor)
- **Examples**: UserSettingsModal, SpaceEditor, ChannelEditor

#### **✅ Use Layout-Level System When:**
- Modal is relatively simple (forms, confirmations)
- Modal is triggered from specific UI areas
- You want simpler setup than ModalProvider
- Modal needs custom preview content
- **Examples**: CreateSpaceModal, ConfirmationModal

#### **❌ NEVER Use Component-Level Rendering**
- Causes z-index stacking issues
- Creates prop drilling problems  
- Breaks with responsive layouts
- **Migration Required**: Move to Layout-Level or ModalProvider

### **Implementation Decision Tree**

```
New Modal Needed?
│
├─ Complex multi-section modal? 
│  └─ YES → Use ModalProvider System
│
├─ Simple form/confirmation with custom content?
│  └─ YES → Use Layout-Level System  
│
└─ Legacy component-level modal?
   └─ MIGRATE → Choose ModalProvider or Layout-Level
```

### **System Implementation Examples**

#### **ModalProvider System Implementation**

1. **Add to Modal State** (`src/hooks/business/ui/useModalState.ts`):
```tsx
export interface ModalState {
  // ... existing modals
  myNewModal: {
    isOpen: boolean;
    data?: any; // modal-specific data
  };
}
```

2. **Add to ModalProvider** (`src/components/context/ModalProvider.tsx`):
```tsx
{modalState.state.myNewModal.isOpen && (
  <MyNewModal
    visible={true}
    data={modalState.state.myNewModal.data}
    onClose={modalState.closeMyNewModal}
  />
)}
```

3. **Use in Components**:
```tsx
const { openMyNewModal } = useModals();
openMyNewModal(data);
```

#### **Layout-Level System Implementation**

1. **Add to Modal Management** (`src/hooks/business/ui/useModalManagement.ts`):
```tsx
const [myModalVisible, setMyModalVisible] = useState(false);
const showMyModal = useCallback(() => setMyModalVisible(true), []);
const hideMyModal = useCallback(() => setMyModalVisible(false), []);
```

2. **Add to Layout** (`src/components/Layout.tsx`):
```tsx
{myModalVisible && (
  <MyModal visible={myModalVisible} onClose={hideMyModal} />
)}
```

3. **Pass via Context or Props**:
```tsx
<MyComponent onOpenModal={showMyModal} />
```

#### **ConfirmationModal Specific Pattern**

```tsx
// In any component within Layout tree:
const { showConfirmationModal } = useConfirmationModal();

const handleDeleteAction = () => {
  showConfirmationModal({
    title: t`Delete Item`,
    message: t`Are you sure you want to delete this item?`,
    preview: <ItemPreview item={item} />, // Optional
    variant: 'danger',
    protipAction: t`delete`,
    confirmText: t`Delete`,
    cancelText: t`Cancel`,
    onConfirm: () => {
      // Perform delete action
      deleteItem(item.id);
    },
  });
};
```

## Development Guidelines

### **Primitive Usage Requirements**

#### **Always Use Primitives For:**

- ✅ **Buttons** - Use Button primitive (all instances)
- ✅ **Text Inputs** - Use Input primitive (replaces raw `<input>`)
- ✅ **Toggles** - Use Switch primitive (replaces ToggleSwitch)
- ✅ **Icons** - Use Icon primitive (replaces FontAwesome)
- ✅ **Dropdowns** - Use Select primitive
- ✅ **Tooltips** - Use Tooltip primitive (simple cases)

#### **Exception Cases:**

- ❌ **File Upload Areas** - Keep ReactTooltip (conflicts with react-dropzone)
- ❌ **Complex Custom Components** - ClickToCopyContent, ThemeRadioGroup, etc.
- ❌ **Third-party Integrations** - When primitives conflict with external libraries

### **Modal Creation Checklist**

#### **1. Choose Appropriate Pattern**

- Simple form → Standard Modal (size: small/medium)
- Multi-section interface → Complex Modal (size: large)
- Quick editor → Small Editor Modal (size: small)

#### **2. Import Primitives**

```tsx
import { Modal, Button, Input, Icon, Switch, Tooltip } from '../primitives';
```

#### **3. Implement Proper Props**

- `visible` - Boolean visibility state
- `onClose` - Close handler function
- `title` - Localized title with `t` macro
- `size` - Appropriate size variant
- `closeOnBackdropClick={true}` - Enable backdrop close
- `closeOnEscape={true}` - Enable ESC key close

#### **4. Use Responsive Classes**

- Buttons: `modal-buttons-responsive` or `w-full sm:max-w-32`
- Layout: `modal-body` for standard modals
- Width: `modal-width-medium` or `modal-width-large` when needed

#### **5. Implement Localization**

```tsx
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

// For titles
title={t`My Modal Title`}

// For content
<Trans>My translatable content</Trans>
```

### **Best Practices**

#### **Responsive Design**

- Always test on mobile (768px breakpoint)
- Use `modal-buttons-responsive` for button layouts
- Center content appropriately on small screens
- Ensure touch-friendly interactions

#### **Accessibility**

- Modal primitive handles focus management
- Use semantic titles with `t` macro
- Ensure proper contrast and font sizes
- Test keyboard navigation (Tab, ESC, Enter)

#### **State Management**

- Use React hooks for modal state
- Implement proper loading/error states
- Clean up state on modal close
- Handle async operations properly

#### **Cross-Platform Compatibility**

- Primitives ensure mobile compatibility
- Avoid platform-specific CSS
- Test on both web and mobile builds
- Use primitive props instead of custom styling

### **Common Patterns**

#### **Dynamic Titles**

```tsx
// For edit vs create scenarios
title={itemId ? t`Edit Item` : t`Add Item`}

// With dynamic content
title={t`Leave ${spaceName}`}
```

#### **Form Handling**

```tsx
<Input
  value={formData.name}
  onChange={(value) => setFormData((prev) => ({ ...prev, name: value }))}
  placeholder={t`Enter name`}
/>
```

#### **Button Layouts**

```tsx
<div className="modal-buttons-responsive">
  <Button type="secondary" onClick={onClose}>
    Cancel
  </Button>
  <Button type="primary" onClick={handleSubmit}>
    Save
  </Button>
</div>
```

#### **Tooltip Hybrid Approach**

```tsx
// Use Tooltip primitive for simple cases
<Tooltip id="info-tooltip" content="Information text">
  <Icon name="info-circle" />
</Tooltip>;

// Keep ReactTooltip for file uploads
{
  !isDragActive && (
    /* Keep ReactTooltip for file upload - conflicts with react-dropzone */
    <ReactTooltip id="upload-tooltip" content="Upload instructions" />
  );
}
```

## Troubleshooting

### **Common Issues**

#### **Import Errors**

- Ensure all primitives are imported from `../primitives`
- Check that primitive components exist and are exported
- Verify correct primitive prop interfaces

#### **Styling Issues**

- Use size prop instead of custom CSS for modal dimensions
- Check that `modal-body` and responsive classes are applied
- Ensure no conflicting z-index styles

#### **Functionality Problems**

- Verify `visible` and `onClose` props are properly connected
- Check that primitive props match expected interfaces (value/onChange vs active/onClick)
- Test backdrop and ESC key functionality

#### **Mobile Compatibility**

- Test responsive breakpoints on actual devices
- Ensure touch interactions work with primitives
- Check that mobile drawer patterns work correctly

### **Migration from Old System**

If upgrading existing modals:

1. Replace Modal wrapper import with primitive
2. Convert ToggleSwitch → Switch primitive
3. Convert raw inputs → Input primitive
4. Convert FontAwesome → Icon primitive
5. Convert simple tooltips → Tooltip primitive
6. Keep ReactTooltip for file uploads
7. Add proper size prop and responsive classes

## Future Improvements

### **Planned Enhancements**

- Enhanced mobile drawer patterns
- Improved animation consistency
- Better focus trap implementation
- Advanced tooltip positioning
- Modal stacking support

### **Cross-Platform Goals**

- Zero-change mobile compatibility
- Consistent primitive behavior
- Unified styling system
- Shared component architecture

---

## Summary

The Quorum Desktop app currently uses a **hybrid three-system modal architecture**:

1. **ModalProvider System**: Complex modals with centralized state management
2. **Layout-Level System**: Simple modals with good z-index handling  
3. **Component-Level System**: ⚠️ **DEPRECATED** - causes z-index issues

While this hybrid approach works, it creates complexity for developers. The **recommended long-term solution** is migrating to a unified ModalProvider system for consistency and maintainability.

For **new modal development**, use the [System Selection Guidelines](#system-selection-guidelines) to choose the appropriate approach. When in doubt, use the Layout-Level system for simple modals and ModalProvider for complex ones.

The recent **ConfirmationModal migration** from component-level to Layout-Level rendering demonstrates how z-index stacking issues can be resolved through proper modal architecture.

---

**Last Updated:** 2025-01-13

This documentation reflects the current hybrid modal architecture with three rendering systems. Future versions may consolidate to a unified approach as the system evolves.
