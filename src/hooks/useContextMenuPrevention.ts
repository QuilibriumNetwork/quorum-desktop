import { useEffect } from 'react';

/**
 * Hook to prevent native browser context menu app-wide
 * Allows native menu on input fields for spell-check, paste, etc.
 */
export function useContextMenuPrevention(): void {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Allow native context menu on editable fields (spell-check, paste, etc.)
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);
}

export default useContextMenuPrevention;
