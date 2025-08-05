import React from 'react';
import { Text } from './Text.native';
import { NativeTextProps } from './types';

/**
 * Typography helpers for common text patterns to reduce View wrapper verbosity
 * These components provide sensible defaults for common use cases
 */

// Paragraph with proper spacing
export const Paragraph: React.FC<Omit<NativeTextProps, 'marginBottom'>> = (props) => (
  <Text {...props} marginBottom={16} />
);

// Section heading with spacing
export const SectionHeading: React.FC<Omit<NativeTextProps, 'size' | 'weight' | 'variant' | 'marginBottom'>> = (props) => (
  <Text 
    {...props} 
    size="lg" 
    weight="semibold" 
    variant="strong" 
    marginBottom={12}
  />
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

// Title with proper spacing
export const Title: React.FC<Omit<NativeTextProps, 'size' | 'weight' | 'variant' | 'marginBottom'>> = (props) => (
  <Text 
    {...props} 
    size="2xl" 
    weight="bold" 
    variant="strong" 
    marginBottom={8}
  />
);

// Inline text without spacing (for use within other containers)
export const InlineText: React.FC<NativeTextProps> = (props) => (
  <Text {...props} />
);