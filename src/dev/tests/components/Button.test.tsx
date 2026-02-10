import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '@/components/primitives/Button/Button.web';

// Mock the Icon component
vi.mock('@/components/primitives/Icon', () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>
      {name}
    </span>
  ),
}));

// Mock ReactTooltip
vi.mock('@/components/ui', () => ({
  ReactTooltip: ({
    id,
    content,
  }: {
    id: string;
    content: string;
  }) => (
    <div data-testid={`tooltip-${id}`}>{content}</div>
  ),
}));

describe('Button (baseline)', () => {
  // 1. Renders with correct CSS class for each type variant
  it.each([
    ['primary', 'btn-primary'],
    ['secondary', 'btn-secondary'],
    ['subtle', 'btn-subtle'],
    ['subtle-outline', 'btn-subtle-outline'],
    ['danger', 'btn-danger'],
    ['danger-outline', 'btn-danger-outline'],
    ['unstyled', 'btn-unstyled'],
    ['light-white', 'btn-light-white'],
    ['primary-white', 'btn-primary-white'],
    ['secondary-white', 'btn-secondary-white'],
    ['light-outline-white', 'btn-light-outline-white'],
  ] as const)('renders correct CSS class for type="%s"', (type, expectedClass) => {
    render(
      <Button type={type} onClick={() => {}}>
        Test
      </Button>
    );
    const btn = screen.getByText('Test');
    expect(btn.className).toContain(expectedClass);
  });

  // 2. Renders children text content
  it('renders children text content', () => {
    render(<Button onClick={() => {}}>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  // 3. Calls onClick when clicked (not disabled)
  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // 4. Does NOT call onClick when disabled
  it('does not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={handleClick} disabled>
        Click
      </Button>
    );
    await user.click(screen.getByText('Click'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  // 5. Applies size classes
  it.each([
    ['compact', 'btn-compact'],
    ['small', 'btn-small'],
    ['large', 'btn-large'],
  ] as const)('applies size class for size="%s"', (size, expectedClass) => {
    render(
      <Button onClick={() => {}} size={size}>
        Test
      </Button>
    );
    const btn = screen.getByText('Test');
    expect(btn.className).toContain(expectedClass);
  });

  // 6. Renders Icon when iconName provided
  it('renders Icon when iconName is provided', () => {
    render(
      <Button onClick={() => {}} iconName="settings">
        Settings
      </Button>
    );
    expect(screen.getByTestId('icon-settings')).toBeInTheDocument();
  });

  // 7. Renders icon-only mode (hides children text)
  it('hides children in icon-only mode', () => {
    render(
      <Button onClick={() => {}} iconName="settings" iconOnly>
        Hidden Text
      </Button>
    );
    expect(screen.getByTestId('icon-settings')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument();
  });

  // 8. Applies btn-full-width class when fullWidth=true
  it('applies btn-full-width class when fullWidth is true', () => {
    render(
      <Button onClick={() => {}} fullWidth>
        Full
      </Button>
    );
    const btn = screen.getByText('Full');
    expect(btn.className).toContain('btn-full-width');
  });

  // 9. Applies custom className
  it('applies custom className', () => {
    render(
      <Button onClick={() => {}} className="my-custom-class">
        Custom
      </Button>
    );
    const btn = screen.getByText('Custom');
    expect(btn.className).toContain('my-custom-class');
  });

  // 10. Renders ReactTooltip when tooltip prop provided
  it('renders ReactTooltip when tooltip prop is provided', () => {
    render(
      <Button onClick={() => {}} tooltip="Help text" id="btn-help">
        Help
      </Button>
    );
    expect(screen.getByTestId('tooltip-btn-help-tooltip')).toBeInTheDocument();
    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  // 11. Uses btn-disabled-onboarding class for that variant
  it('applies btn-disabled-onboarding class for disabled-onboarding type', () => {
    render(
      <Button onClick={() => {}} disabled type="disabled-onboarding">
        Onboarding
      </Button>
    );
    const btn = screen.getByText('Onboarding');
    expect(btn.className).toContain('btn-disabled-onboarding');
  });
});

describe('Button (accessibility)', () => {
  // A1. Button is focusable with Tab
  it('is focusable with Tab', async () => {
    const user = userEvent.setup();
    render(<Button onClick={() => {}}>Focus me</Button>);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Focus me' })).toHaveFocus();
  });

  // A2. Enter key triggers onClick
  it('triggers onClick on Enter key', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Press Enter</Button>);
    const btn = screen.getByRole('button', { name: 'Press Enter' });
    btn.focus();
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalled();
  });

  // A3. Space key triggers onClick
  it('triggers onClick on Space key', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Press Space</Button>);
    const btn = screen.getByRole('button', { name: 'Press Space' });
    btn.focus();
    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalled();
  });

  // A4. Disabled button is not focusable
  it('disabled button is not focusable', async () => {
    const user = userEvent.setup();
    render(<Button onClick={() => {}} disabled>Disabled</Button>);
    await user.tab();
    expect(screen.getByText('Disabled')).not.toHaveFocus();
  });

  // A5. disabled-onboarding button IS focusable (uses aria-disabled)
  it('disabled-onboarding button is still focusable', async () => {
    const user = userEvent.setup();
    render(
      <Button onClick={() => {}} disabled type="disabled-onboarding">
        Onboarding
      </Button>
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Onboarding' })).toHaveFocus();
  });

  // A6. ariaLabel renders as aria-label on icon-only buttons
  it('renders aria-label from ariaLabel prop', () => {
    render(
      <Button onClick={() => {}} iconName="settings" iconOnly ariaLabel="Settings">
        Hidden
      </Button>
    );
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  // A7. Button has implicit role="button"
  it('has implicit button role', () => {
    render(<Button onClick={() => {}}>Role test</Button>);
    expect(screen.getByRole('button', { name: 'Role test' })).toBeInTheDocument();
  });
});
