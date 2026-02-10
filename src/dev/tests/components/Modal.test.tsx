import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '@/components/primitives/Modal/Modal.web';

// Mock the Icon component
vi.mock('@/components/primitives/Icon', () => ({
  Icon: ({ name, size }: { name: string; size?: string }) => (
    <span data-testid={`icon-${name}`} data-size={size}>
      {name}
    </span>
  ),
}));

// Mock ModalContainer to render children directly for unit testing Modal
vi.mock('@/components/primitives/ModalContainer', () => ({
  ModalContainer: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <div data-testid="modal-container">{children}</div> : null),
}));

describe('Modal (baseline)', () => {
  const defaultProps = {
    title: 'Test Modal',
    visible: true,
    onClose: vi.fn(),
  };

  // 1. Renders title and children when visible=true
  it('renders title and children when visible=true', () => {
    render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  // 2. Does not render content when visible=false
  it('does not render content when visible=false', () => {
    render(
      <Modal {...defaultProps} visible={false}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  // 3. Renders close button (Icon with name="close") by default
  it('renders close button with close icon by default', () => {
    render(
      <Modal {...defaultProps}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByTestId('icon-close')).toBeInTheDocument();
  });

  // 4. Hides close button when hideClose=true
  it('hides close button when hideClose=true', () => {
    render(
      <Modal {...defaultProps} hideClose>
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByTestId('icon-close')).not.toBeInTheDocument();
  });

  // 5. Applies size class
  it.each([
    ['small', 'quorum-modal-small'],
    ['medium', 'quorum-modal-medium'],
    ['large', 'quorum-modal-large'],
  ] as const)('applies size class for size="%s"', (size, expectedClass) => {
    render(
      <Modal {...defaultProps} size={size}>
        <p>Content</p>
      </Modal>
    );
    const modal = screen.getByTestId('modal-container').firstElementChild!;
    expect(modal.className).toContain(expectedClass);
  });

  // 6. Applies quorum-modal-no-padding class when noPadding=true
  it('applies quorum-modal-no-padding class when noPadding=true', () => {
    render(
      <Modal {...defaultProps} noPadding>
        <p>Content</p>
      </Modal>
    );
    const modal = screen.getByTestId('modal-container').firstElementChild!;
    expect(modal.className).toContain('quorum-modal-no-padding');
  });

  // 7. Applies title alignment class when titleAlign="center"
  it('applies title center alignment class', () => {
    render(
      <Modal {...defaultProps} titleAlign="center">
        <p>Content</p>
      </Modal>
    );
    const title = screen.getByText('Test Modal');
    expect(title.className).toContain('quorum-modal-title-center');
  });

  // 8. Close button click dispatches synthetic Escape KeyboardEvent
  it('close button click dispatches synthetic Escape KeyboardEvent', async () => {
    const user = userEvent.setup();
    const escHandler = vi.fn();
    document.addEventListener('keydown', escHandler);

    render(
      <Modal {...defaultProps}>
        <p>Content</p>
      </Modal>
    );

    // Close button is now a <button> element wrapping the icon
    const closeButton = screen.getByLabelText('Close dialog');
    await user.click(closeButton);

    expect(escHandler).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Escape' })
    );

    document.removeEventListener('keydown', escHandler);
  });
});

describe('Modal (accessibility)', () => {
  const defaultProps = {
    title: 'A11y Modal',
    visible: true,
    onClose: vi.fn(),
  };

  // A1. Modal has role="dialog" and aria-modal="true"
  it('has role="dialog" and aria-modal="true"', () => {
    render(
      <Modal {...defaultProps}>
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  // A2. Close button is <button> with aria-label="Close dialog"
  it('close button is a <button> with aria-label', () => {
    render(
      <Modal {...defaultProps}>
        <p>Content</p>
      </Modal>
    );
    const closeBtn = screen.getByLabelText('Close dialog');
    expect(closeBtn.tagName).toBe('BUTTON');
  });

  // A3. Modal has aria-labelledby pointing to the title
  it('has aria-labelledby pointing to the title element', () => {
    render(
      <Modal {...defaultProps}>
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl?.textContent).toBe('A11y Modal');
  });

  // A4. No aria-labelledby when title is empty
  it('does not set aria-labelledby when no title', () => {
    render(
      <Modal visible={true} onClose={vi.fn()} title="">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
  });

  // A5. Escape key dispatches from close button click
  it('close button dispatches Escape KeyboardEvent', async () => {
    const user = userEvent.setup();
    const escHandler = vi.fn();
    document.addEventListener('keydown', escHandler);

    render(
      <Modal {...defaultProps}>
        <p>Content</p>
      </Modal>
    );

    await user.click(screen.getByLabelText('Close dialog'));
    expect(escHandler).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Escape' })
    );

    document.removeEventListener('keydown', escHandler);
  });
});
