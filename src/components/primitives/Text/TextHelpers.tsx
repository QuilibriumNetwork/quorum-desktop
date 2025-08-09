import React from 'react';
// Import Text from index which properly exports the platform-specific version
import { Text } from './index';
import { NativeTextProps } from './types';

/**
 * Typography helpers for common text patterns to reduce View wrapper verbosity
 * These components provide sensible defaults for common use cases
 */

// Paragraph with proper spacing
export const Paragraph: React.FC<Omit<NativeTextProps, 'marginBottom'>> = (props) => (
  <Text {...props} marginBottom={8} />
);


// Label with minimal spacing
export const Label: React.FC<Omit<NativeTextProps, 'size' | 'variant' | 'marginBottom'>> = (props) => (
  <Text 
    {...props} 
    size="sm" 
    variant="strong" 
    marginBottom={8}
  />
);

// Description/caption text with spacing
export const Caption: React.FC<Omit<NativeTextProps, 'size' | 'variant' | 'marginTop'>> = (props) => (
  <Text 
    {...props} 
    size="sm" 
    variant="subtle" 
    marginTop={8}
  />
);

// Title with size and weight options
export const Title: React.FC<Omit<NativeTextProps, 'size' | 'weight' | 'variant' | 'marginBottom'> & { size?: 'sm' | 'md' | 'lg' | 'xl'; weight?: 'normal' | 'medium' | 'semibold' | 'bold' }> = ({ size = 'lg', weight = 'bold', ...props }) => (
  <Text 
    {...props} 
    size={size === 'sm' ? 'lg' : size === 'md' ? 'xl' : size === 'lg' ? '2xl' : '3xl'}
    weight={weight} 
    variant="strong" 
    marginBottom={
      size === 'sm' ? 8 : 
      size === 'md' ? 12 : 
      size === 'lg' ? 16 : 
      20
    }
  />
);

// Inline text without spacing (for use within other containers)
export const InlineText: React.FC<NativeTextProps> = (props) => (
  <Text {...props} />
);