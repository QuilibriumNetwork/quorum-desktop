# UI Folder Reorganization Task

## Objective
Reorganize 9 free-flowing UI components from `src/components/` into a new `src/components/ui/` folder to improve code organization and maintainability.

## Components to Move
The following 9 components will be moved to `src/components/ui/`:

1. **AccentColorSwitcher.tsx** - Theme accent color selector
2. **ClickToCopyContent.tsx/.native.tsx** - Copy-to-clipboard functionality (cross-platform)
3. **CloseButton.tsx** - Reusable close button component
4. **Container.tsx** - Layout container wrapper
5. **DropdownPanel.tsx** - Dropdown panel component (used by pinned messages & search)
6. **MobileDrawer.tsx** - Mobile navigation drawer
7. **ReactTooltip.tsx** - Tooltip implementation
8. **ThemeRadioGroup.tsx** - Theme selection component
9. **UnknownAvatar.tsx** - Fallback avatar component

## Remaining Free-Flowing Components
These components will remain in `src/components/` root:
- InviteRoute.tsx
- Layout.tsx
- Connecting.tsx
- Maintenance.tsx/.native.tsx
- RedirectToDefaultSpace.tsx

## Implementation Steps

### Phase 1: Directory Setup
1. Create `src/components/ui/` directory
2. Move the 9 target components to the new directory
3. Create `src/components/ui/index.ts` barrel export file

### Phase 2: Import Path Updates
Update import statements across the entire codebase from:
```typescript
import { ComponentName } from '../ComponentName'
import { ComponentName } from '../../components/ComponentName'
```
To:
```typescript
import { ComponentName } from '../ui'
import { ComponentName } from '../../components/ui'
```

### Phase 3: Comprehensive Path Search & Replace
Search and update component path references in ALL file types:

#### TypeScript/JavaScript Files (.ts, .tsx, .js, .jsx)
- Import statements
- Dynamic imports
- Comments referencing file paths

#### Documentation Files (.md)
- File path references
- Component documentation
- Architecture diagrams or descriptions

#### Configuration Files
- ESLint configurations
- TypeScript path mappings
- Build tool configurations
- Package.json scripts

#### Other Potential Files
- JSON configuration files
- Test files
- Storybook files (if any)
- IDE configuration files

### Phase 4: Search Strategy
Use comprehensive search patterns to find ALL references:

1. **Direct file path references:**
   - `src/components/ui/AccentColorSwitcher`
   - `components/AccentColorSwitcher`
   - `./AccentColorSwitcher`

2. **Import pattern variations:**
   - `from '../ui/AccentColorSwitcher'`
   - `from '../../components/ui/AccentColorSwitcher'`
   - `import AccentColorSwitcher from`

3. **File extensions in paths:**
   - `.tsx` extensions in documentation
   - `.native.tsx` for cross-platform components

4. **Case-sensitive variations:**
   - Component names in different cases
   - Path separators (/ vs \)

### Phase 5: Validation
1. **Build verification**: Ensure `yarn build` completes successfully
2. **TypeScript check**: Run type checking to catch any missed imports
3. **Development server**: Verify `yarn dev` starts without errors
4. **Component functionality**: Test each moved component still works

## Risk Mitigation

### Backup Strategy
- Create git branch for the reorganization
- Test thoroughly before merging

### Rollback Plan
- If issues arise, can quickly revert the file moves
- Import updates can be batch-reverted using search & replace

### Testing Approach
- Systematic testing of each moved component
- Verification that cross-platform variants (.native.tsx) still work
- Check that barrel exports work correctly

## Expected Benefits

1. **Cleaner project structure**: Reduced clutter in components root
2. **Better component discovery**: Developers know where to find UI components
3. **Improved maintainability**: Related components grouped together
4. **Cleaner imports**: Barrel exports enable `import { Multiple, Components } from '../ui'`
5. **Future scalability**: Easier to add new UI components to organized structure

## Files to Monitor for Path References

### High Priority (Likely to contain references)
- All `.tsx` and `.ts` files in `src/`
- Component documentation in `.agents/`
- Architecture documentation
- Package.json and build configurations

### Medium Priority (Possible references)
- ESLint and TypeScript configurations
- Test files (if any)
- IDE workspace settings

### Low Priority (Unlikely but check)
- JSON configuration files
- Shell scripts
- GitHub workflows

## Timeline Estimate
- **Phase 1**: 15 minutes (directory setup and file moves)
- **Phase 2-3**: 45-60 minutes (comprehensive search and replace)
- **Phase 4**: 15 minutes (validation and testing)
- **Total**: ~90 minutes

## Success Criteria
- ✅ All 9 components successfully moved to `src/components/ui/`
- ✅ All import statements updated throughout codebase
- ✅ No broken imports or missing components
- ✅ Build process completes without errors
- ✅ Development server starts successfully
- ✅ All moved components function correctly
- ✅ Cross-platform variants (.native.tsx) work properly

---

**Created**: September 19, 2025
**Status**: Ready for implementation
**Priority**: Medium
**Estimated Effort**: 90 minutes