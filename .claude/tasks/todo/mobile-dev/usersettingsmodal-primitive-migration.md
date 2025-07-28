# UserSettingsModal Primitive Migration Plan

**Created:** 2025-07-28  
**Purpose:** Comprehensive migration of UserSettingsModal to use primitive architecture  
**Goal:** Test primitive integration, identify issues, create migration template for other complex modals

---

## Migration Overview

UserSettingsModal is an ideal test case because it contains:
- **4 navigation sections** with FontAwesome icons
- **Multiple form elements** (input, select, toggles, radio groups)
- **Tooltips and info icons** throughout
- **File upload functionality** with dropzone
- **Complex layouts** (desktop sidebar + mobile stacked)
- **Business logic integration** (theme switching, notifications, etc.)

**Total Elements to Migrate:** ~25+ components/patterns

---

## Phase 1: Foundation Components (Week 1)

### 1.1 Build New ThemeRadioGroup Using RadioGroup Primitive
- [ ] **Analyze current ThemeRadioGroup.tsx**
  - [x] **Current structure:** Custom radio inputs with FontAwesome icons (faSun, faMoon, faDesktop)
  - [x] **Current styling:** Custom border-accent active states, flex layouts
  - [x] **Current functionality:** Theme switching with useTheme context
  - [x] **Icons used:** faSun, faMoon, faDesktop
  - [x] **Layout:** Supports horizontal and vertical modes

- [ ] **Create new ThemeRadioGroup using RadioGroup primitive**
  - [ ] Extract theme options array to reusable constant
  - [ ] Replace FontAwesome icons with Icon primitive (sun, moon, desktop)
  - [ ] Use RadioGroup primitive with proper theme integration
  - [ ] Maintain identical visual appearance and behavior
  - [ ] Test theme switching functionality thoroughly

- [ ] **Integration testing**
  - [ ] Test in UserSettingsModal appearance section
  - [ ] Verify theme persistence works
  - [ ] Check light/dark/system mode switching
  - [ ] Validate mobile and desktop layouts

**Notes:** This is foundational - theme switching affects the entire UI

### 1.2 Build New AccentColorSwitcher Using ColorSwatch Primitive  
- [ ] **Analyze current AccentColorSwitcher.tsx**
  - [x] **Current structure:** Div-based color buttons with onClick handlers
  - [x] **Current styling:** 32px circles with FontAwesome check icons
  - [x] **Current functionality:** Accent color switching with localStorage
  - [x] **Colors:** blue, purple, fuchsia, orange, green, yellow
  - [x] **Active state:** Shows faCheck icon with white color

- [ ] **Create new AccentColorSwitcher using ColorSwatch primitive**
  - [ ] Extract ACCENT_COLORS constant to shared location
  - [ ] Replace div buttons with ColorSwatch primitive
  - [ ] Replace FontAwesome faCheck with Icon primitive (check)
  - [ ] Maintain identical color switching behavior
  - [ ] Test accent color persistence and DOM class updates

- [ ] **Integration testing**
  - [ ] Test in UserSettingsModal appearance section
  - [ ] Verify accent color changes apply immediately
  - [ ] Check localStorage persistence works
  - [ ] Validate all 6 accent colors work correctly

**Notes:** Color switching affects theme variables throughout the app

---

## Phase 2: Form Elements Migration (Week 1-2)

### 2.1 Input Elements
- [ ] **Display Name Input (General tab)**
  - [x] **Current:** `<input className="w-full quorum-input modal-input-text">`
  - [ ] **Replace with:** `<Input fullWidth value={displayName} onChange={setDisplayName} />`
  - [ ] **Test:** Text entry, form submission, character limits

- [ ] **Status Input (commented out - future use)**
  - [x] **Current:** Raw input with character counter (currently disabled)
  - [ ] **Future:** Use Input primitive when re-enabled
  - [ ] **Note:** No immediate action needed

### 2.2 Toggle Switches
- [ ] **Enable Sync Toggle (Privacy tab)**
  - [x] **Current:** `<ToggleSwitch onClick={() => setAllowSync((prev) => !prev)} active={allowSync} />`
  - [ ] **Replace with:** `<Switch value={allowSync} onChange={setAllowSync} />`
  - [ ] **Test:** Toggle behavior, privacy settings persistence

- [ ] **Non-repudiability Toggle (Privacy tab)**
  - [x] **Current:** `<ToggleSwitch onClick={() => setNonRepudiable((prev) => !prev)} active={nonRepudiable} />`
  - [ ] **Replace with:** `<Switch value={nonRepudiable} onChange={setNonRepudiable} />`
  - [ ] **Test:** Toggle behavior, security settings persistence

- [ ] **Desktop Notifications Toggle (Notifications tab)**
  - [x] **Current:** `<ToggleSwitch onClick={handleNotificationToggle} active={notificationsEnabled} />`
  - [ ] **Replace with:** `<Switch value={notificationsEnabled} onChange={handleNotificationToggle} />`
  - [ ] **Test:** Browser permission requests, notification status updates

### 2.3 Select Elements
- [ ] **Language Selector (Appearance tab)**
  - [x] **Current:** Already using Select primitive - no changes needed ✅
  - [x] **Status:** Uses `<Select value={language} options={...} onChange={...} width="300px" dropdownPlacement="bottom" />`
  - [ ] **Verify:** Proper integration with i18n system still works

---

## Phase 3: Icon Migration (Week 2)

### 3.1 Navigation Icons
- [ ] **Sidebar Navigation Icons**
  - [x] **Current icons:** faUser, faShield, faBell, faPalette (with "mr-2 text-accent" classes)
  - [ ] **Replace with:** `<Icon name="user" />`, `<Icon name="shield" />`, `<Icon name="bell" />`, `<Icon name="palette" />`
  - [ ] **Test:** Icon rendering in both desktop sidebar and mobile stacked menu
  - [ ] **Verify:** Accent color theming still applies

### 3.2 Close Button Icon
- [ ] **Modal Close Button**
  - [x] **Current:** `<FontAwesomeIcon icon={faTimes} />`
  - [ ] **Replace with:** `<Icon name="times" />` 
  - [ ] **Test:** Close button functionality and styling

### 3.3 Action Icons
- [ ] **Error Message Close Icons**
  - [x] **Current:** `<FontAwesomeIcon icon={faTimes} className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100" />`
  - [ ] **Replace with:** `<Icon name="times" size="small" className="cursor-pointer ml-2 opacity-70 hover:opacity-100" />`
  - [ ] **Test:** Error dismissal functionality

---

## Phase 4: Tooltip Migration (Week 2-3)

### 4.1 Info Tooltip Icons
- [ ] **Sync Setting Tooltip**
  - [x] **Current:** `<FontAwesomeIcon id="allow-sync-tooltip-anchor" icon={faInfoCircle} className="info-icon-tooltip mt-2 ml-2" />`
  - [ ] **Replace with:** `<Icon name="info-circle" className="mt-2 ml-2" />` 
  - [ ] **Update tooltip:** Use Tooltip primitive instead of ReactTooltip

- [ ] **Non-repudiability Tooltip**
  - [x] **Current:** `<FontAwesomeIcon id="non-repudiable-tooltip-anchor" icon={faInfoCircle} className="info-icon-tooltip mt-2 ml-2" />`
  - [ ] **Replace with:** `<Icon name="info-circle" className="mt-2 ml-2" />`
  - [ ] **Update tooltip:** Use Tooltip primitive

- [ ] **Notifications Tooltip**
  - [x] **Current:** `<FontAwesomeIcon id="notifications-tooltip-anchor" icon={faInfoCircle} className="info-icon-tooltip mt-2 ml-2" />`
  - [ ] **Replace with:** `<Icon name="info-circle" className="mt-2 ml-2" />`
  - [ ] **Update tooltip:** Use Tooltip primitive

### 4.2 Complex Tooltips
- [ ] **User Icon Upload Tooltip**
  - [x] **Current:** `<ReactTooltip id="user-icon-tooltip" content="Upload an avatar..." place="bottom" className="!w-[400px]" anchorSelect="#user-icon-tooltip-target" />`
  - [ ] **Replace with:** `<Tooltip content="Upload an avatar..." position="bottom" maxWidth="400px">` wrapper
  - [ ] **Test:** Tooltip positioning and file upload workflow

- [ ] **Language Refresh Tooltip**  
  - [x] **Current:** `<ReactTooltip id="language-refresh-tooltip" place="top" anchorSelect="#language-refresh-button" content="..." className="!bg-surface-5 !text-main !w-[400px]" />`
  - [ ] **Replace with:** `<Tooltip content="..." position="top" maxWidth="400px">` wrapper
  - [ ] **Test:** Tooltip styling and language refresh functionality

---

## Phase 5: Button Migration (Week 3)

### 5.1 Action Buttons
- [ ] **Save Changes Buttons (Multiple tabs)**
  - [x] **Current:** Already using Button primitive - verify consistency ✅
  - [x] **Status:** `<Button type="primary" onClick={() => { saveChanges(); }}>{t\`Save Changes\`}</Button>`
  - [ ] **Verify:** All save buttons work identically

- [ ] **Remove Device Buttons (Privacy tab)**
  - [x] **Current:** Already using Button primitive ✅
  - [x] **Status:** `<Button onClick={() => { removeDevice(d.identity_public_key); }} type="danger" size="small">{t\`Remove\`}</Button>`
  - [ ] **Verify:** Device removal functionality works

- [ ] **Export Key Button (Privacy tab)**
  - [x] **Current:** Already using Button primitive ✅
  - [x] **Status:** `<Button type="danger" onClick={() => { downloadKey(); }}>{t\`Export\`}</Button>`
  - [ ] **Verify:** Key export functionality works

- [ ] **Language Refresh Button (Appearance tab)**
  - [x] **Current:** Already using Button primitive ✅  
  - [x] **Status:** `<Button id="language-refresh-button" type="secondary" disabled={!languageChanged} onClick={forceUpdate}>{t\`Refresh\`}</Button>`
  - [ ] **Verify:** Language refresh works properly

### 5.2 Navigation Buttons (Implicit)
- [ ] **Modal Navigation Categories**
  - [x] **Current:** Div elements with onClick handlers and cursor-pointer styling
  - [ ] **Consider:** Whether to convert to Button primitive or keep as divs (semantic choice)
  - [ ] **Decision needed:** Navigation items vs buttons - discuss UX implications

---

## Phase 6: File Upload Integration (Week 3-4)

### 6.1 File Upload Area
- [ ] **User Icon Upload**
  - [x] **Current:** Uses react-dropzone with modal-icon-editable styling
  - [x] **Current pattern:** `<div className="modal-icon-editable" {...getRootProps()}><input {...getInputProps()} /></div>`
  - [ ] **Strategy decision:** Keep react-dropzone or build FileUpload primitive
  - [ ] **Test:** File selection, drag-and-drop, error handling
  - [ ] **Verify:** File validation (PNG/JPG, 1MB limit) still works

**Notes:** File upload is complex - may defer to later phase if primitive system isn't ready

---

## Phase 7: Layout and Styling Verification (Week 4)

### 7.1 Responsive Layout Testing
- [ ] **Desktop Layout (>768px)**
  - [ ] Sidebar navigation renders correctly with Icon primitives
  - [ ] All form elements align properly
  - [ ] Tooltips position correctly
  - [ ] Modal maintains proper proportions

- [ ] **Mobile Layout (<768px)**
  - [ ] Stacked navigation renders correctly
  - [ ] Form elements stack properly  
  - [ ] Tooltips adapt to mobile positioning
  - [ ] Touch targets are appropriate size

### 7.2 Cross-Platform Integration
- [ ] **Theme Integration**
  - [ ] Light/dark mode switching works with all primitives
  - [ ] Accent color changes apply to all primitive elements
  - [ ] CSS variables integration remains consistent

- [ ] **Performance Testing**
  - [ ] Modal opening/closing performance
  - [ ] Theme switching responsiveness
  - [ ] Form interaction latency
  - [ ] Memory usage with many primitives

---

## Testing Strategy

### After Each Phase:
- [ ] **Functionality Test:** All features work identically to before migration
- [ ] **Visual Test:** No visual regressions (pixel-perfect comparison)
- [ ] **Performance Test:** No performance degradation
- [ ] **Accessibility Test:** Screen reader and keyboard navigation
- [ ] **Mobile Test:** Touch interactions work properly

### Integration Testing:
- [ ] **Settings Persistence:** All settings save and load correctly
- [ ] **Theme System:** Light/dark/system themes work
- [ ] **Accent Colors:** All 6 colors work properly
- [ ] **Notifications:** Browser permission integration works
- [ ] **Internationalization:** Language switching works
- [ ] **File Upload:** User icon upload/validation works

### Cross-Browser Testing:
- [ ] **Chrome:** All primitives render correctly
- [ ] **Firefox:** All primitives render correctly  
- [ ] **Safari:** All primitives render correctly
- [ ] **Edge:** All primitives render correctly

---

## Success Metrics

### Technical Success:
- [ ] **Zero functionality regressions** - all features work identically
- [ ] **Zero visual regressions** - appearance remains identical
- [ ] **Performance maintained** - no measurable slowdowns
- [ ] **Mobile compatibility** - all interactions work on touch devices

### Architecture Success:
- [ ] **Primitive API validation** - identify any missing features or API issues
- [ ] **Integration patterns identified** - document best practices for complex modals
- [ ] **Performance characteristics** - understand primitive overhead in complex UIs
- [ ] **Cross-platform readiness** - validate that mobile implementation will work

### Documentation Success:
- [ ] **Migration template created** - reusable process for other complex components
- [ ] **Issue documentation** - catalog any primitive improvements needed
- [ ] **Best practices guide** - document patterns that work well together
- [ ] **Performance guidelines** - understand optimal primitive usage patterns

---

## Risk Mitigation

### High-Risk Areas:
1. **Theme switching** - Complex integration with CSS variables and primitive theming
2. **File upload** - Potentially complex if FileUpload primitive isn't ready
3. **Tooltip positioning** - Complex layouts may reveal positioning issues
4. **Form validation** - Ensure Input/Switch primitives handle validation correctly

### Mitigation Strategies:
1. **Gradual rollout** - Test each phase independently
2. **Backup plan** - Keep original components until migration is proven
3. **Feature flags** - Ability to quickly revert if issues found
4. **Thorough testing** - Test every interaction before moving to next phase

---

## Implementation Notes

### Development Workflow:
1. **Work in feature branch** - `feat/usersettingsmodal-primitives`
2. **Commit after each phase** - Enable easy rollback if needed
3. **Test thoroughly** - Don't move to next phase until current phase is solid
4. **Document issues** - Keep track of primitive improvements needed

### Communication:
- [ ] **Update this document** with progress and any discovered issues
- [ ] **Note performance characteristics** of different primitive combinations
- [ ] **Document API improvements** that would help complex components
- [ ] **Share learnings** that apply to other modal migrations

---

**Last Updated:** 2025-07-28  
**Status:** Ready to begin Phase 1