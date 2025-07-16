# Enhanced Component Architecture Proposal

## Current Problem

- **Code Duplication**: Quorum Mobile and Quorum Desktop contain mirrored code, leading to increased maintenance overhead and potential inconsistencies.

## Proposed Solution

Implement a **two-layer architecture** that separates platform-specific rendering from shared business logic, avoiding the dependency on `react-native-web`.

### Layer 1: Simple/Primitive Components

These components encapsulate all platform-specific rendering. They provide an abstract interface for both web and mobile implementations.

#### Goals

- **Consistent Interface**: Ensure that both versions implement a unified props interface and share common logic and styles as much as possible.

#### Example: Button Component

- **Button.native.tsx**:

```tsx
import React from 'react';
import { Pressable, Text, ViewProps } from 'react-native';

interface ButtonProps extends ViewProps {
  title: string;
  onPress: () => void;
}

export function Button(props: ButtonProps) {
  const { title, onPress, ...rest } = props;
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      style={{ padding: 12, borderRadius: 6 }}
    >
      <Text>{title}</Text>
    </Pressable>
  );
}
```

- **Button.web.tsx**:

```tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
}

export function Button(props: ButtonProps) {
  const { title, onClick, ...rest } = props;
  return (
    <button
      {...rest}
      onClick={onClick}
      style={{ padding: 12, borderRadius: 6 }}
    >
      {title}
    </button>
  );
}
```

### Layer 2: Business Logic

These components are platform-agnostic and leverage the primitive components from Layer 1.

#### Example: Using the Button in a Feature Component

**FeatureComponent.tsx**:

```tsx
import React from 'react';
import { Button } from './Button';

const FeatureComponent = () => {
  const handleButtonClick = () => {
    alert('Button clicked!');
  };

  return (
    <div>
      <h1>Welcome</h1>
      <Button title="Click Me" onPress={handleButtonClick} />
    </div>
  );
};

export default FeatureComponent;
```

### Key Requirement

Ensure that "raw HTML portion of components" is encapsulated within these tightly-contained primitive components. This entails:

- **❌ Avoiding** direct use of `<div>`, `<span>`, `<Pressable>`, `<Text>` in your business logic components.
- **✅ Utilizing** abstract components like `<Button>`, `<Input>`, `<Card>` from your primitive layer.

### Resulting Benefits

- **Code Reuse**: Business logic is shared across platforms; only primitive components require platform-specific implementations.
- **Consistency**: Guarantees that UI components behave consistently across platforms.
- **Maintenance**: Simplifies updates since changes at the primitive level automatically propagate throughout the application.

### Structuring the Codebase

#### Recommended Directory Structure

```
src/
  components/
    Button/
      Button.native.tsx
      Button.web.tsx
      index.ts
    Card/
      Card.native.tsx
      Card.web.tsx
      index.ts
```

- **Component-Level Index Files**: Utilize index files to abstract platform logic using `Platform.select` for dynamic component resolution.
- **Shared Utilities**: Host shared styles and utility functions in a common directory.

This enhanced architecture employs platform-specific implementations while emphasizing uniformity, maintainability, and scalability across both mobile and desktop platforms, without the complexity of `react-native-web`.
