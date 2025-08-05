import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';

// Import our primitives
import { ModalContainer } from '../components/primitives/ModalContainer';
import { OverlayBackdrop } from '../components/primitives/OverlayBackdrop';
import { Container } from '../components/primitives/Container';
import { FlexRow } from '../components/primitives/FlexRow';
import { FlexColumn } from '../components/primitives/FlexColumn';
import { FlexBetween } from '../components/primitives/FlexBetween';
import { FlexCenter } from '../components/primitives/FlexCenter';
import { ResponsiveContainer } from '../components/primitives/ResponsiveContainer';
import Button from '../components/primitives/Button';
import Modal from '../components/primitives/Modal';
import { Text } from '../components/primitives/Text';
import { Icon } from '../components/primitives/Icon';
import { commonTestStyles } from '../styles/commonTestStyles';

/**
 * Mobile test screen for all primitives
 * Tests React Native implementations of cross-platform primitives
 */
export const PrimitivesTestScreen: React.FC = () => {
  const theme = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showNoBackdropModal, setShowNoBackdropModal] = useState(false);
  const [showModalPrimitive, setShowModalPrimitive] = useState(false);

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPaddingCompact}>
        <View style={commonTestStyles.titleContainer}>
          <Icon name="tools" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
          <Text size="2xl" weight="bold" variant="strong">Layout Primitives Test</Text>
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Testing Container, Flex components, and ResponsiveContainer
          </Text>
        </View>

        {/* Button Primitive Section */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Button Primitive</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">Button Types:</Text>
            </View>
            <FlexRow gap="md" wrap style={{ paddingVertical: 8 }}>
              <Button
                type="primary"
                onClick={() => {}}
              >
                Primary
              </Button>
              <Button
                type="secondary"
                onClick={() => {}}
              >
                Secondary
              </Button>
              <Button type="light" onClick={() => {}}>
                Light
              </Button>
            </FlexRow>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">Button Sizes:</Text>
            </View>
            <FlexRow gap="md" align="center" style={{ paddingVertical: 8 }}>
              <Button type="primary" size="normal" onClick={() => {}}>
                Normal Size
              </Button>
              <Button type="primary" size="small" onClick={() => {}}>
                Small Size
              </Button>
            </FlexRow>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">Disabled State:</Text>
            </View>
            <FlexRow gap="md" style={{ paddingVertical: 8 }}>
              <Button type="primary" disabled onClick={() => {}}>
                Disabled Primary
              </Button>
              <Button type="secondary" disabled onClick={() => {}}>
                Disabled Secondary
              </Button>
            </FlexRow>
          </View>
        </View>

        {/* Container Primitive Section */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Container Primitive</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">Container with padding:</Text>
            </View>
            <Container
              padding="md"
              backgroundColor={theme.colors.accent[100]}
              style={{ borderRadius: 8 }}
            >
              <Text size="sm" variant="default">Container with medium padding</Text>
            </Container>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                Container with margin and width:
              </Text>
            </View>
            <Container
              width="full"
              margin="sm"
              padding="lg"
              backgroundColor={theme.colors.accent[200]}
              style={{ borderRadius: 8 }}
            >
              <Text size="sm" variant="default">Full width container with margin</Text>
            </Container>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">Touchable Container:</Text>
            </View>
            <Container
              padding="md"
              backgroundColor={theme.colors.utilities.success + '20'}
              onPress={() => {}}
              style={{ borderRadius: 8 }}
            >
              <Text size="sm" variant="default">Tap this container!</Text>
            </Container>
          </View>
        </View>

        {/* Flex Primitives Section */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Flex Primitives</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">FlexRow with gap:</Text>
            </View>
            <FlexRow gap="md" style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default, borderWidth: 1, borderRadius: 8 }]}>
              <View style={{ backgroundColor: theme.colors.accent[100], padding: 8, borderRadius: 4, minWidth: 60, alignItems: 'center' }}>
                <Text size="sm" variant="default">Item 1</Text>
              </View>
              <View style={{ backgroundColor: theme.colors.accent[100], padding: 8, borderRadius: 4, minWidth: 60, alignItems: 'center' }}>
                <Text size="sm" variant="default">Item 2</Text>
              </View>
              <View style={{ backgroundColor: theme.colors.accent[100], padding: 8, borderRadius: 4, minWidth: 60, alignItems: 'center' }}>
                <Text size="sm" variant="default">Item 3</Text>
              </View>
            </FlexRow>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">FlexBetween:</Text>
            </View>
            <FlexBetween style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default, borderWidth: 1, borderRadius: 8 }]}>
              <Text size="sm" variant="default">Left Content</Text>
              <Button type="secondary" size="small" onClick={() => {}}>
                Right Action
              </Button>
            </FlexBetween>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">FlexCenter:</Text>
            </View>
            <FlexCenter style={[commonTestStyles.testGroup, { height: 60, backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default, borderWidth: 1, borderRadius: 8 }]}>
              <Text size="sm" variant="default">Centered Content</Text>
            </FlexCenter>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">FlexColumn with gap:</Text>
            </View>
            <FlexColumn gap="md" style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default, borderWidth: 1, borderRadius: 8 }]}>
              <View style={{ backgroundColor: theme.colors.accent[100], padding: 8, borderRadius: 4, minWidth: 60, alignItems: 'center' }}>
                <Text size="sm" variant="default">Item 1</Text>
              </View>
              <View style={{ backgroundColor: theme.colors.accent[100], padding: 8, borderRadius: 4, minWidth: 60, alignItems: 'center' }}>
                <Text size="sm" variant="default">Item 2</Text>
              </View>
              <View style={{ backgroundColor: theme.colors.accent[100], padding: 8, borderRadius: 4, minWidth: 60, alignItems: 'center' }}>
                <Text size="sm" variant="default">Item 3</Text>
              </View>
            </FlexColumn>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">FlexColumn with alignment:</Text>
            </View>
            <FlexColumn
              gap="sm"
              align="center"
              style={[commonTestStyles.testGroup, { minHeight: 120, backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default, borderWidth: 1, borderRadius: 8 }]}
            >
              <Text size="sm" variant="default">Centered items</Text>
              <Button type="primary" size="small" onClick={() => {}}>
                Button
              </Button>
              <Text size="sm" variant="default">In column</Text>
            </FlexColumn>
          </View>
        </View>

        {/* Modal Primitives Section */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Modal Primitives</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">Modal Tests:</Text>
            </View>
            <FlexRow gap="md" wrap style={{ paddingVertical: 8 }}>
              <Button type="primary" onClick={() => setShowModal(true)}>
                Show Modal with Backdrop
              </Button>

              <Button
                type="secondary"
                onClick={() => setShowModalPrimitive(true)}
              >
                Show Modal Primitive
              </Button>
            </FlexRow>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">Backdrop Test:</Text>
            </View>
            <Button type="light" onClick={() => setShowBackdrop(true)}>
              Show Backdrop Only
            </Button>
          </View>
        </View>

        {/* ResponsiveContainer Section */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">ResponsiveContainer</Text>
          </View>
          <View style={{ backgroundColor: theme.colors.utilities.warning + '20', borderColor: theme.colors.utilities.warning, borderWidth: 1, borderRadius: 8, padding: 12 }}>
            <Text size="sm" color={theme.colors.utilities.warning}>
              ResponsiveContainer is a layout primitive that works behind the
              scenes. On mobile, it provides SafeAreaView integration and proper
              content positioning.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal with backdrop */}
      <ModalContainer
        visible={showModal}
        onClose={() => setShowModal(false)}
        closeOnBackdropClick={true}
        closeOnEscape={true}
      >
        <View style={{ backgroundColor: theme.colors.bg.card, borderRadius: 12, padding: 24, margin: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5 }}>
          <Text size="lg" weight="semibold" variant="strong" align="center" marginBottom={12}>Modal with Backdrop</Text>
          <Text size="sm" variant="default" align="center" marginBottom={16} lineHeight={20}>
            This modal uses the ModalContainer primitive with backdrop. Tap
            outside or press the close button to close.
          </Text>
          <Button onClick={() => setShowModal(false)}>Close Modal</Button>
        </View>
      </ModalContainer>

      {/* Backdrop only test */}
      <OverlayBackdrop
        visible={showBackdrop}
        onBackdropClick={() => setShowBackdrop(false)}
        blur={true}
      >
        <View style={{ backgroundColor: theme.colors.bg.card, borderRadius: 12, padding: 24, margin: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5 }}>
          <Text size="lg" weight="semibold" variant="strong" align="center" marginBottom={12}>Content on Backdrop</Text>
          <Text size="sm" variant="default" align="center" marginBottom={16} lineHeight={20}>
            This demonstrates the OverlayBackdrop primitive. Tap the dark area
            to close.
          </Text>
        </View>
      </OverlayBackdrop>

      {/* Modal Primitive Demo */}
      <Modal
        title="Modal Primitive Demo"
        visible={showModalPrimitive}
        onClose={() => setShowModalPrimitive(false)}
        size="medium"
      >
        <View style={{ padding: 16 }}>
          <Text size="sm" variant="default" align="center" marginBottom={16} lineHeight={20}>
            This modal is built using the Modal primitive, which internally uses
            the ModalContainer primitive for backdrop and animations.
          </Text>

          <View style={{ marginVertical: 16 }}>
            <Text size="base" weight="semibold" variant="strong" marginBottom={8}>Key Features:</Text>
            <Text size="sm" variant="default" marginBottom={4} lineHeight={18}>
              • Uses ModalContainer for consistent backdrop behavior
            </Text>
            <Text size="sm" variant="default" marginBottom={4} lineHeight={18}>
              • Smooth open/close animations
            </Text>
            <Text size="sm" variant="default" marginBottom={4} lineHeight={18}>
              • Cross-platform React Native implementation
            </Text>
            <Text size="sm" variant="default" marginBottom={4} lineHeight={18}>
              • Size variants (small, medium, large, full)
            </Text>
            <Text size="sm" variant="default" marginBottom={4} lineHeight={18}>
              • Desktop modal → Mobile drawer transformation
            </Text>
          </View>

          <FlexRow gap="md" justify="end" style={{ marginTop: 16 }}>
            <Button
              type="secondary"
              onClick={() => setShowModalPrimitive(false)}
            >
              Cancel
            </Button>
            <Button type="primary" onClick={() => setShowModalPrimitive(false)}>
              Confirm
            </Button>
          </FlexRow>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// All styles now centralized in commonTestStyles
