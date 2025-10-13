import React from 'react';
import { ResponsiveContainerProps } from './types';
import './ResponsiveContainer.scss';
import { useResponsiveLayoutContext } from '../../context/ResponsiveLayoutProvider';

/**
 * ResponsiveContainer Web Implementation
 *
 * Provides responsive main content area with proper NavMenu offset.
 * Fixes the original Container.scss bug where desktop used 72px instead of 74px.
 * Supports NavMenu hiding below 1024px.
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = '',
}) => {
  const { navMenuOpen } = useResponsiveLayoutContext();

  const containerClass = `responsive-container ${navMenuOpen ? '' : 'nav-menu-hidden'} ${className}`;

  return <div className={containerClass}>{children}</div>;
};
