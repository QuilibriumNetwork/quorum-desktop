import React from 'react';
import { ResponsiveContainerProps } from './types';
import './ResponsiveContainer.scss';

/**
 * ResponsiveContainer Web Implementation
 * 
 * Provides responsive main content area with proper NavMenu offset.
 * Fixes the original Container.scss bug where desktop used 72px instead of 74px.
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`responsive-container ${className}`}>
      {children}
    </div>
  );
};