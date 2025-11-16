/**
 * TEMPLATE: Cross-Platform Component
 *
 * Use this template when creating new components that need to work
 * on both web and mobile platforms.
 *
 * Instructions:
 * 1. Replace COMPONENT_NAME with your actual component name
 * 2. Update the interface with your required props
 * 3. Implement business logic in shared hooks
 * 4. ALWAYS check API Reference for exact primitive prop names
 * 5. Use primitives strategically based on the decision framework
 * 6. Create .web.tsx and .native.tsx versions if platform-specific behavior needed
 *
 * ⚠️ CRITICAL: Before using any primitive, check the API Reference:
 * .agents/docs/features/primitives/API-REFERENCE.md
 */

import React from 'react';
import {
  Container,
  FlexColumn,
  FlexRow,
  Button,
  Title,
  Paragraph,
  Caption,
  // Import other primitives as needed
  // Note: Use Title, Paragraph, Caption for block-level text
  // Only use Text for truly inline content
} from '../primitives';

// Define your component's interface
interface COMPONENT_NAMEProps {
  // Add your props here
  title?: string;
  onAction?: () => void;
  // ... other props
}

// Shared business logic (extract to hooks when complex)
function useCOMPONENT_NAMELogic(props: COMPONENT_NAMEProps) {
  // Business logic, state management, API calls, etc.
  const handleAction = () => {
    // Implementation
    props.onAction?.();
  };

  return {
    handleAction,
    // ... other logic
  };
}

export function COMPONENT_NAME(props: COMPONENT_NAMEProps) {
  const { title = 'Default Title' } = props;
  const { handleAction } = useCOMPONENT_NAMELogic(props);

  return (
    <Container padding="md">                    {/* Primitive: themed container */}
      <FlexColumn gap="md">                     {/* Primitive: simple layout */}

        {/* Header section - primitives work well for simple layouts */}
        <FlexRow justify="between" align="center">
          <Title size="lg">{title}</Title>               {/* Block-level heading */}
          <Button
            type="primary"
            iconName="action"
            onClick={handleAction}
          >
            Action
          </Button>
        </FlexRow>

        {/* Content area - choose approach based on complexity */}
        {/* Option A: Simple content - use semantic text components */}
        <FlexColumn gap="sm">
          <Paragraph>Main content goes here with proper block layout</Paragraph>
          <Caption>Supporting information with subtle styling</Caption>
        </FlexColumn>

        {/* Option B: Complex content - raw HTML acceptable */}
        <div className="complex-content-area">
          {/* Use raw HTML for complex layouts, CSS animations, etc. */}
          <div className="specialized-layout">
            <span>Complex content that needs specialized CSS</span>
          </div>
        </div>

        {/* Action area - primitives for interactions */}
        <FlexRow gap="sm" justify="end">
          <Button type="subtle" onClick={() => {}}>
            Secondary Action
          </Button>
          <Button type="primary" onClick={handleAction}>
            Primary Action
          </Button>
        </FlexRow>

      </FlexColumn>
    </Container>
  );
}

/**
 * DECISION CHECKLIST:
 *
 * For each element, ask:
 * 1. Does this interact with users? → Use primitive
 * 2. Does this need theme colors/spacing? → Use primitive
 * 3. Is this layout pattern repeated? → Consider primitive
 * 4. Is the CSS complex/specialized? → Raw HTML acceptable
 * 5. Is this performance-critical? → Measure and optimize
 *
 * STRICT RULES:
 * ✅ Always use primitives: Button, Input, Select, Modal, Switch
 * ✅ Always use primitives: Component boundaries (Container for themed boxes)
 *
 * FLEXIBLE RULES:
 * 🤔 Case-by-case: Text (when it works well), Container, FlexRow/FlexColumn
 * 🤔 Case-by-case: Complex layouts, data tables, specialized animations
 */