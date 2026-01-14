import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container, Flex, Text } from '@/components/primitives';

// Shared gradient colors matching web version (bg-radial--accent-noise) - EXACT WEB COLORS
// Using the exact bright colors from the web: #034081, #0287f2, #b4e235
export const AUTH_GRADIENT_COLORS = ['#034081', '#0287f2', '#b4e235'] as const; // Deep blue to bright blue to bright lime green

// Shared layout constants matching web version
export const AUTH_LAYOUT = {
  MAX_CONTENT_WIDTH: 460,
  PADDING: 16,
  BUTTON_HORIZONTAL_MARGIN: 32, // Responsive margin for buttons/inputs
} as const;

// Common styles for auth screens (text colors, spacing, etc.)
export const AUTH_TEXT_STYLES = {
  title: {
    color: 'white',
    textAlign: 'center' as const,
  },
  body: {
    color: 'white',
    textAlign: 'justify' as const,
  },
  center: {
    color: 'white',
    textAlign: 'center' as const,
  },
  link: {
    color: 'white',
    textDecorationLine: 'underline' as const,
    textAlign: 'center' as const,
  },
  address: {
    fontFamily: 'monospace' as const,
    color: 'white',
    textAlign: 'center' as const,
  },
} as const;

// Shared container styles
export const AUTH_CONTAINER_STYLES = {
  addressDisplay: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
  },
  errorContainer: {
    marginTop: 8,
  },
  dragOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  dragContent: {
    padding: 48,
    borderWidth: 2,
    borderStyle: 'dashed' as const,
    borderColor: '#3b82f6',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 25,
  },
} as const;

// Wrapper component for auth screens with gradient background
interface AuthScreenWrapperProps {
  children: React.ReactNode;
  dragOverlay?: React.ReactNode;
}

export const AuthScreenWrapper: React.FC<AuthScreenWrapperProps> = ({
  children,
  dragOverlay,
}) => (
  <>
    {/* Clean diagonal gradient from top-left to bottom-right, blue dominant */}
    <LinearGradient
      colors={AUTH_GRADIENT_COLORS}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }} // Top-left
      end={{ x: 1, y: 1 }} // Bottom-right
      locations={[0, 0.55, 1]} // Blue dominant but green even more visible
    >
      <SafeAreaView style={{ flex: 1 }}>
        {dragOverlay}
        <Flex direction="column" style={{ flex: 1 }}>
          <Flex direction="column" style={{ flex: 1 }} />
          <Flex direction="column" style={{ userSelect: 'none' }}>{children}</Flex>
          <Flex direction="column" style={{ flex: 1 }} />
        </Flex>
      </SafeAreaView>
    </LinearGradient>
  </>
);

// Title section component
interface AuthTitleProps {
  children: React.ReactNode;
}

export const AuthTitle: React.FC<AuthTitleProps> = ({ children }) => (
  <Flex
    style={{
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: AUTH_LAYOUT.PADDING,
    }}
  >
    <Text size="2xl" weight="semibold" style={AUTH_TEXT_STYLES.title}>
      {children}
    </Text>
  </Flex>
);

// Content section component with consistent max-width and centering
interface AuthContentProps {
  children: React.ReactNode;
  centerContent?: boolean;
}

export const AuthContent: React.FC<AuthContentProps> = ({
  children,
  centerContent = false,
}) => (
  <Flex style={{ justifyContent: 'center' }}>
    <Flex direction="column" style={{ flex: 1 }} />
    <Container
      style={{
        width: '100%',
        maxWidth: AUTH_LAYOUT.MAX_CONTENT_WIDTH,
        paddingHorizontal: AUTH_LAYOUT.PADDING,
        paddingVertical: AUTH_LAYOUT.PADDING,
        ...(centerContent && { alignItems: 'center' }),
      }}
    >
      {children}
    </Container>
    <Flex direction="column" style={{ flex: 1 }} />
  </Flex>
);

// Spacer component for consistent spacing
export const AuthSpacer: React.FC = () => <Flex style={{ flex: 1 }} />;

// Step Indicator component for onboarding progress
interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
}) => (
  <Flex justify="center" style={{ marginBottom: 24, marginTop: 16 }}>
    <Flex gap="sm">
      {Array.from({ length: totalSteps }, (_, index) => (
        <Container
          key={index}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              index < currentStep ? 'white' : 'rgba(255, 255, 255, 0.3)',
          }}
        />
      ))}
    </Flex>
  </Flex>
);

// Updated: August 9, 2025 at 4:50 PM
