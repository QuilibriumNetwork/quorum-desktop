# Component Patterns: Good vs Bad Examples

Real-world examples of effective primitive usage patterns vs anti-patterns.

**⚠️ IMPORTANT: All primitive usage in these examples uses exact prop names from the [API Reference](../../../.agents/docs/features/primitives/API-REFERENCE.md). Always verify prop names before using primitives.**

## ✅ GOOD PATTERNS

### 1. Strategic Modal Implementation
```tsx
// Good: Primitives for structure, raw HTML for complex content
import { Modal, Container, Button, FlexRow, Spacer } from '../primitives';

function DataExportModal({ visible, onClose, data }) {
  return (
    <Modal visible={visible} onClose={onClose} title="Export Data">
      <Container padding="md">
        {/* Complex table - semantic HTML for accessibility */}
        <div className="export-options-table">
          <table>
            <thead>
              <tr>
                <th>Data Type</th>
                <th>Include</th>
                <th>Format</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    <Switch                     // Primitive for interaction
                      checked={item.included}
                      onChange={checked => updateItem(item.id, checked)}
                    />
                  </td>
                  <td>
                    <Select                     // Primitive for interaction
                      value={item.format}
                      onChange={format => updateFormat(item.id, format)}
                      options={formatOptions}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Spacer size="lg" />

        {/* Simple layout - primitive works well */}
        <FlexRow gap="sm" justify="end">
          <Button type="subtle" onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleExport}>Export</Button>
        </FlexRow>
      </Container>
    </Modal>
  );
}
```

### 2. Pragmatic Form Design
```tsx
// Good: Mixed approach based on complexity
import { Container, Input, Button, FlexColumn, Text } from '../primitives';

function UserProfileForm({ user, onSave }) {
  return (
    <Container padding="lg" className="user-profile-form">
      <FlexColumn gap="md">                    {/* Primitive: simple layout */}

        {/* Simple form fields - use semantic text components */}
        <FlexColumn gap="xs">
          <Label>Display Name</Label>                    {/* Block-level label */}
          <Input
            value={user.displayName}
            onChange={setDisplayName}
            error={errors.displayName}
          />
        </FlexColumn>

        {/* Complex avatar upload - raw HTML for positioning */}
        <div className="avatar-upload-section">
          <Label>Profile Picture</Label>                     {/* Block-level label */}
          <div className="avatar-upload-container">
            <div className="avatar-preview">
              <img src={user.avatar} alt="Profile" />
              <div className="avatar-overlay">
                <Button
                  type="subtle"
                  size="small"
                  iconName="camera"
                  onClick={handleAvatarClick}
                >
                  Change
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Simple action row - primitive layout */}
        <FlexRow gap="sm" justify="end">
          <Button type="subtle" onClick={onCancel}>Cancel</Button>
          <Button type="primary" onClick={onSave}>Save Changes</Button>
        </FlexRow>

      </FlexColumn>
    </Container>
  );
}
```

### 3. Efficient List Rendering
```tsx
// Good: Raw HTML for performance, primitives for interactions
import { Button, Text } from '../primitives';

function MessageList({ messages, onEdit, onDelete }) {
  return (
    <div className="message-list">                {/* Raw HTML: performance-critical */}
      {messages.map(message => (
        <div key={message.id} className="message-item">
          <div className="message-content">
            <div className="message-header">
              <span className="author">{message.author}</span>
              <span className="timestamp">{message.timestamp}</span>
            </div>
            <div className="message-text">{message.content}</div>
          </div>
          <div className="message-actions">
            <Button                               {/* Primitive: interaction */}
              type="subtle"
              size="small"
              iconName="edit"
              onClick={() => onEdit(message.id)}
            />
            <Button                               {/* Primitive: interaction */}
              type="danger"
              size="small"
              iconName="delete"
              onClick={() => onDelete(message.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

## ❌ BAD PATTERNS (Anti-Examples)

### 1. Over-Engineering with Primitives
```tsx
// Bad: Forcing primitives where they hurt readability/performance
import { Container, FlexRow, FlexColumn, Text } from '../primitives';

function DataTable({ data }) {
  return (
    <Container className="table-wrapper">
      {/* This should be a <table> for accessibility and semantics */}
      <FlexColumn className="table">
        <FlexRow className="table-header">
          <Container className="col-name">
            <Text variant="strong">Name</Text>
          </Container>
          <Container className="col-email">
            <Text variant="strong">Email</Text>
          </Container>
          <Container className="col-status">
            <Text variant="strong">Status</Text>
          </Container>
          <Container className="col-actions">
            <Text variant="strong">Actions</Text>
          </Container>
        </FlexRow>

        {data.map(row => (
          <FlexRow key={row.id} className="table-row">
            <Container className="col-name">
              <Text>{row.name}</Text>
            </Container>
            <Container className="col-email">
              <Text>{row.email}</Text>
            </Container>
            <Container className="col-status">
              <Text>{row.status}</Text>
            </Container>
            <Container className="col-actions">
              <Button size="small" onClick={() => edit(row)}>Edit</Button>
            </Container>
          </FlexRow>
        ))}
      </FlexColumn>
    </Container>
  );
}
```

**Problems:**
- Loses semantic HTML table structure
- Screen readers can't navigate properly
- CSS Grid/table features unavailable
- Over-complicated for no benefit
- Performance impact from extra components

### 2. Missing Required Primitives
```tsx
// Bad: Raw HTML where primitives are needed for consistency
function LoginForm({ onSubmit }) {
  return (
    <div className="login-form">
      <div className="form-group">
        <label>Username</label>
        <input                                    // Should be Input primitive
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Password</label>
        <input                                    // Should be Input primitive
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button onClick={onSubmit}>Login</button>  {/* Should be Button primitive */}
        <button onClick={onCancel}>Cancel</button> {/* Should be Button primitive */}
      </div>
    </div>
  );
}
```

**Problems:**
- Inconsistent styling (no theme integration)
- No error state handling
- Missing accessibility features
- Won't work on React Native
- No design system integration

### 3. Inconsistent Mixed Usage
```tsx
// Bad: Arbitrary mixing without clear reasoning
function SettingsPanel({ settings, onChange }) {
  return (
    <Container padding="md">
      <div className="settings-group">           {/* Why not FlexColumn? */}
        <Text variant="heading">Notifications</Text>

        <div className="setting-item">           {/* Inconsistent with above */}
          <span>Email notifications</span>       {/* Why not Text primitive? */}
          <Switch
            checked={settings.emailNotifications}
            onChange={checked => onChange('emailNotifications', checked)}
          />
        </div>

        <FlexRow justify="between" align="center">  {/* Now using primitive? */}
          <div>Sound alerts</div>                  {/* Back to raw HTML? */}
          <input                                   {/* Should be Switch */}
            type="checkbox"
            checked={settings.soundAlerts}
            onChange={e => onChange('soundAlerts', e.target.checked)}
          />
        </FlexRow>
      </div>
    </Container>
  );
}
```

**Problems:**
- No clear pattern or reasoning
- Inconsistent user experience
- Maintenance nightmare
- Confusing for other developers

## 🎯 CONVERSION EXAMPLES

### Before/After: Table Refactor

**Before (Over-engineered):**
```tsx
<Container className="user-table">
  <FlexRow className="header">
    <Container className="col"><Text>Name</Text></Container>
    <Container className="col"><Text>Role</Text></Container>
  </FlexRow>
  {users.map(user => (
    <FlexRow key={user.id}>
      <Container className="col"><Text>{user.name}</Text></Container>
      <Container className="col"><Text>{user.role}</Text></Container>
    </FlexRow>
  ))}
</Container>
```

**After (Pragmatic):**
```tsx
<Container padding="md">                        {/* Primitive: themed container */}
  <table className="user-table">               {/* Raw HTML: semantic structure */}
    <thead>
      <tr>
        <th>Name</th>
        <th>Role</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {users.map(user => (
        <tr key={user.id}>
          <td>{user.name}</td>
          <td>{user.role}</td>
          <td>
            <Button                             {/* Primitive: interaction */}
              size="small"
              onClick={() => editUser(user.id)}
            >
              Edit
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</Container>
```

## Key Principles Applied

1. **Interactive elements always use primitives** (Button, Input, Switch)
2. **Themed containers benefit from primitives** (Container with padding/colors)
3. **Complex layouts can use raw HTML** (tables, grids, absolute positioning)
4. **Simple layouts work well with primitives** (FlexRow, FlexColumn)
5. **Performance-critical sections may need raw HTML** (long lists, real-time updates)
6. **Accessibility should guide structure decisions** (semantic HTML when appropriate)