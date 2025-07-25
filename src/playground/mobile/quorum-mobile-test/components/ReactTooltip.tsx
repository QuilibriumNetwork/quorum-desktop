import React from 'react';

/**
 * Mock ReactTooltip component for mobile test environment
 * Provides minimal tooltip functionality for testing primitives
 */

interface TooltipProps {
  id?: string;
  effect?: string;
  place?: string;
  className?: string;
  children?: React.ReactNode;
}

const ReactTooltip: React.FC<TooltipProps> = ({ children }) => {
  // For mobile testing, we just render children without tooltip functionality
  return <>{children}</>;
};

export default ReactTooltip;