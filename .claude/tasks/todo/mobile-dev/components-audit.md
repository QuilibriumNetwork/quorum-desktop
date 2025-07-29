# Cross-Platform Component Audit Plan

## Mission Overview

We need to conduct a comprehensive audit of all existing components to support our cross-platform migration strategy (see .claude/tasks/todo/mobile-dev/components-shared-arch-masterplan.md). This audit will track progress through three critical phases of our architecture transformation.

## Why This Audit Is Critical

### **The Cross-Platform Challenge**
Our application currently uses a mix of:
- Raw HTML elements (`<button>`, `<input>`, `<div>`, etc.)
- Old component implementations (Button.jsx, Modal.tsx)
- Mixed business logic and UI concerns
- No clear separation for cross-platform compatibility

### **Our Architecture Goal**
Transform to a clean three-layer architecture:
1. **Primitives Layer**: Platform-specific UI components (✅ Already built and tested)
2. **Business Logic Layer**: Shared hooks and functions (🔄 Needs extraction)
3. **Component Layer**: Clean UI components using primitives (🔄 Needs migration)

### **The Migration Path**
1. **Primitives Migration**: Replace all raw HTML with our new primitives
2. **Logic Extraction**: Extract business logic to shared hooks
3. **Native Implementation**: Create mobile versions where platform-specific UX is needed

## What you need to Do

### **Phase 1: Audit Preparation**

#### **1.1 Create the Audit Infrastructure**

**File: `src/audit.json`**
```json
{
  "components": {},
  "stats": {
    "total": 0,
    "primitives_done": 0,
    "logic_extraction_done": 0,
    "native_ready": 0,
    "by_category": {
      "shared": 0,
      "platform_specific": 0,
      "complex_refactor": 0
    },
    "last_updated": "2025-01-29"
  },
  "metadata": {
    "audit_version": "1.0",
    "last_full_scan": null,
    "scan_scope": [
      "src/components/**/*.tsx",
      "src/components/**/*.jsx"
    ]
  }
}
```

**File: `src/dev/ComponentAuditViewer.tsx`**
Create the complete frontend viewer component with:
- Stats dashboard (including category breakdown)
- Filterable/sortable component table
- Category filter (shared/platform_specific/complex_refactor)
- Status badges and progress indicators
- Description and notes display
- Hook listings

**File: `src/dev/index.ts`**
Export the audit viewer for easy importing

#### **1.2 Add Development Route**
Add audit viewer to the application routing (development only):
```tsx
// In your main routing file, add:
{process.env.NODE_ENV === 'development' && (
  <Route path="/dev/audit" component={ComponentAuditViewer} />
)}
```

#### **1.3 Exclude "dev" folder from production builds (only keep it in dev builds) and exclude it from lingui extraction process**

#### **1.4 Populate the json with some demo datat for testing purposes**

```json
{
  "ComponentName.tsx": {
    "name": "ComponentName",
    "path": "src/components/path/ComponentName.tsx",
    "description": "Brief description of component function",  // What the component does
    "category": "unknown",       // shared|platform_specific|complex_refactor
    "primitives": "todo",        // Based on raw HTML analysis
    "web_native": "unknown",     // Needs human decision
    "logic_extraction": "todo",  // Based on business logic analysis
    "hooks": [],                 // Potential hooks identified
    "native": "todo",           // Will be determined after logic extraction
    "notes": "Auto-generated: Uses raw <button>, <input>. Has API calls in useEffect.",
    "updated": "2025-01-29"
  }
}
```

we need

- ✅ `src/audit.json` with demo data for one component
- ✅ `src/dev/ComponentAuditViewer.tsx` fully functional
- ✅ Development route configured at `/dev/audit`

## IMPORTANT! STOP HERE - ask for a review before proceeding 

### **Phase 2: Comprehensive Component Discovery**

#### **2.1 Scan and Catalog All Components**

**Scope**: Scan all `.tsx` and `.jsx` files in:
- `src/components/`
- Any other directories containing React components

**For Each Component Discovered**:
1. **Extract basic info**: name, path, file size
2. **Analyze imports**: What it currently imports and uses
3. **Scan for raw HTML**: `<button>`, `<input>`, `<select>`, `<textarea>`, `<div>`, etc.
4. **Identify complexity**: Lines of code, number of useEffect/useState calls
5. **Detect business logic patterns**: API calls, complex state management

#### **2.2 Component Classification**

**Categorize each component based on the architecture workflow**:

- **Category A: Shared** (`shared`)
  - Components that work identically on both platforms using only primitives
  - No platform-specific UI differences needed
  - Examples: MessageInput, UserProfile, ChannelList
  
- **Category B: Platform-Specific** (`platform_specific`)
  - Components that need different UI layouts but share business logic
  - Require .web.tsx and .native.tsx implementations
  - Examples: MessageActions (hover vs drawer), ChannelHeader (full vs compact)
  
- **Category C: Complex Refactor** (`complex_refactor`)
  - Large components that need to be broken down into smaller pieces
  - Mix multiple concerns and responsibilities
  - Examples: Message.tsx (850+ lines), Channel.tsx, SpaceSettings.tsx

**Also identify component types**:
- **Primitive**: Already our new primitive components (skip these)
- **Simple**: Basic UI components, minimal logic
- **Business**: Components with significant business logic
- **Layout**: Components focused on layout/navigation
- **Complex**: Large components mixing multiple concerns

### **Phase 3: Detailed Analysis Per Component**

#### **3.1 Primitives Usage Analysis**

**For each component, determine**:
- **Current primitive usage**: What primitives it already uses
- **Raw HTML elements**: What needs to be replaced
- **Target primitives**: What primitives should replace raw HTML
- **Completion estimate**: Percentage of primitive migration needed

**Example Analysis**:
```javascript
// Component: MessageInput.tsx
// Raw HTML found: <textarea>, <button>, <div>
// Current primitives: None
// Target primitives: TextArea, Button, FlexRow
// Estimated completion: 0% (needs full migration)
```

#### **3.2 Business Logic Assessment**

**Identify components that have**:
- **State management**: Multiple useState calls, complex state
- **Side effects**: useEffect with API calls, subscriptions
- **Business rules**: Permission checking, validation logic
- **Data transformation**: Complex data processing

**For each component with business logic**:
- **Extraction needed**: Yes/No assessment
- **Potential hooks**: List of hooks that should be extracted
- **Complexity level**: Simple/Medium/Complex extraction

#### **3.3 Cross-Platform Strategy**

**For each component, determine**:
- **Shared vs Separate**: Can one component work on both platforms?
- **Platform differences**: What aspects need platform-specific implementation?
- **Mobile considerations**: Touch interactions, navigation patterns, gestures

**Decision factors**:
- Layout complexity (simple forms vs complex dashboards)
- Interaction patterns (hover vs touch, keyboard vs gesture)
- Navigation integration (modal vs screen, sidebar vs tabs)

### **Phase 4: Priority Assessment**

#### **4.1 Dependency Analysis**
- **Component dependencies**: What components does each one import/use?
- **Dependency chain**: Which components block others?
- **Critical path**: High-impact components that affect many others

#### **4.2 Migration Priority**
**High Priority** (migrate first):
- Components with no dependencies
- Frequently used across the app
- Simple components with clear primitive replacements

**Medium Priority**:
- Components with moderate complexity
- Clear business logic extraction opportunities
- Important but not blocking other work

**Low Priority**:
- Complex components requiring significant refactoring
- Components with unclear cross-platform strategy
- Edge case or rarely used components

### **Phase 5: Generate Initial Audit Data**

#### **5.1 Populate audit.json**

**For each discovered component, create entry**:
```json
{
  "ComponentName.tsx": {
    "name": "ComponentName",
    "path": "src/components/path/ComponentName.tsx",
    "description": "Brief description of component function",  // What the component does
    "category": "unknown",       // shared|platform_specific|complex_refactor
    "primitives": "todo",        // Based on raw HTML analysis
    "web_native": "unknown",     // Needs human decision
    "logic_extraction": "todo",  // Based on business logic analysis
    "hooks": [],                 // Potential hooks identified
    "native": "todo",           // Will be determined after logic extraction
    "notes": "Auto-generated: Uses raw <button>, <input>. Has API calls in useEffect.",
    "updated": "2025-01-29"
  }
}
```

#### **5.2 Generate Summary Statistics**
Update stats section with:
- Total components found
- Components by category
- Estimated work by phase
- Dependency relationships

#### **5.3 Create Initial Recommendations**

**In the notes field, include**:
- Specific raw HTML elements to replace
- Identified business logic patterns
- Potential hooks to extract
- Cross-platform considerations discovered

## Expected Deliverables

### **1. Complete Audit Infrastructure**
- ✅ `src/audit.json` with comprehensive component data
- ✅ `src/dev/ComponentAuditViewer.tsx` fully functional
- ✅ Development route configured at `/dev/audit`

### **2. Component Discovery Report**
- ✅ All React components cataloged
- ✅ Raw HTML usage mapped
- ✅ Business logic patterns identified
- ✅ Cross-platform strategy recommendations

### **3. Migration Roadmap Data**
- ✅ Priority ordering for component migration
- ✅ Dependency chain analysis
- ✅ Work estimates per component
- ✅ Risk assessment for complex components

## Quality Standards

### **Accuracy Requirements**
- **100% component discovery**: No React components missed
- **Accurate HTML detection**: All raw HTML elements identified
- **Complete import analysis**: All dependencies mapped
- **Reliable classification**: Consistent categorization logic

### **Useful Analysis**
- **Actionable notes**: Specific next steps for each component
- **Realistic estimates**: Honest assessment of migration complexity
- **Clear priorities**: Logical ordering based on dependencies and impact
- **Human-readable**: Notes that developers can immediately understand and act on

## Success Criteria

**The audit is complete when**:
1. ✅ Every React component in the codebase is cataloged
2. ✅ Frontend viewer displays comprehensive, accurate data
3. ✅ Migration path is clear for each component
4. ✅ Priority order enables efficient migration workflow
5. ✅ Human team can immediately begin migration work based on audit data

## Instructions for Claude Code

### **Start Signal**
Wait for explicit instruction: *"Begin the comprehensive component audit"*

### **Execution Approach**
1. **Start with audit infrastructure**: Create JSON schema and frontend viewer first
2. **Systematic scanning**: Process components methodically, not randomly
3. **Detailed analysis**: Don't just count files - analyze content and patterns
4. **Clear documentation**: Every decision and finding should be documented
5. **Human validation**: Pause for validation after infrastructure is ready

### **Communication Protocol**
- **Progress updates**: Report findings as you discover them
- **Questions**: Ask for clarification on ambiguous components
- **Recommendations**: Provide specific suggestions for complex cases
- **Summary**: Provide overview of findings and recommendations

### **Key Deliverable**
A fully functional audit system that enables the human team to:
- ✅ See complete migration status at a glance
- ✅ Understand exactly what work needs to be done for each component
- ✅ Make informed decisions about cross-platform strategies
- ✅ Track progress as migration work proceeds

---

**Note**: This audit is the foundation for our entire cross-platform strategy. Accuracy and completeness are more important than speed. The time invested in a thorough audit will save weeks of confusion and rework during actual migration.