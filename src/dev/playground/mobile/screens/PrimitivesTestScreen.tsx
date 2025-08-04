import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text.strong }]}>Layout Primitives Test</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.main }]}>
            Testing Container, Flex components, and ResponsiveContainer
          </Text>
        </View>

        {/* Button Primitive Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Button Primitive</Text>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>Button Types:</Text>
            <FlexRow gap="md" wrap style={styles.buttonRow}>
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

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>Button Sizes:</Text>
            <FlexRow gap="md" align="center" style={styles.buttonRow}>
              <Button type="primary" size="normal" onClick={() => {}}>
                Normal Size
              </Button>
              <Button type="primary" size="small" onClick={() => {}}>
                Small Size
              </Button>
            </FlexRow>
          </View>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>Disabled State:</Text>
            <FlexRow gap="md" style={styles.buttonRow}>
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
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Container Primitive</Text>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>Container with padding:</Text>
            <Container
              padding="md"
              backgroundColor={theme.colors.accent[100]}
              style={styles.containerDemo}
            >
              <Text>Container with medium padding</Text>
            </Container>
          </View>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>
              Container with margin and width:
            </Text>
            <Container
              width="full"
              margin="sm"
              padding="lg"
              backgroundColor={theme.colors.accent[200]}
              style={styles.containerDemo}
            >
              <Text>Full width container with margin</Text>
            </Container>
          </View>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>Touchable Container:</Text>
            <Container
              padding="md"
              backgroundColor={theme.colors.utilities.success + '20'}
              onPress={() => {}}
              style={styles.containerDemo}
            >
              <Text>Tap this container!</Text>
            </Container>
          </View>
        </View>

        {/* Flex Primitives Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Flex Primitives</Text>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>FlexRow with gap:</Text>
            <FlexRow gap="md" style={[styles.flexDemo, { backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default }]}>
              <View style={[styles.flexItem, { backgroundColor: theme.colors.accent[100] }]}>
                <Text>Item 1</Text>
              </View>
              <View style={[styles.flexItem, { backgroundColor: theme.colors.accent[100] }]}>
                <Text>Item 2</Text>
              </View>
              <View style={[styles.flexItem, { backgroundColor: theme.colors.accent[100] }]}>
                <Text>Item 3</Text>
              </View>
            </FlexRow>
          </View>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>FlexBetween:</Text>
            <FlexBetween style={[styles.flexDemo, { backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default }]}>
              <Text style={[styles.flexText, { color: theme.colors.text.main }]}>Left Content</Text>
              <Button type="secondary" size="small" onClick={() => {}}>
                Right Action
              </Button>
            </FlexBetween>
          </View>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>FlexCenter:</Text>
            <FlexCenter style={[styles.flexDemo, styles.centerDemo, { backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default }]}>
              <Text style={[styles.flexText, { color: theme.colors.text.main }]}>Centered Content</Text>
            </FlexCenter>
          </View>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>FlexColumn with gap:</Text>
            <FlexColumn gap="md" style={[styles.flexDemo, { backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default }]}>
              <View style={[styles.flexItem, { backgroundColor: theme.colors.accent[100] }]}>
                <Text>Item 1</Text>
              </View>
              <View style={[styles.flexItem, { backgroundColor: theme.colors.accent[100] }]}>
                <Text>Item 2</Text>
              </View>
              <View style={[styles.flexItem, { backgroundColor: theme.colors.accent[100] }]}>
                <Text>Item 3</Text>
              </View>
            </FlexColumn>
          </View>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>FlexColumn with alignment:</Text>
            <FlexColumn
              gap="sm"
              align="center"
              style={[styles.flexDemo, { minHeight: 120, backgroundColor: theme.colors.surface[2], borderColor: theme.colors.border.default }]}
            >
              <Text style={[styles.flexText, { color: theme.colors.text.main }]}>Centered items</Text>
              <Button type="primary" size="small" onClick={() => {}}>
                Button
              </Button>
              <Text style={[styles.flexText, { color: theme.colors.text.main }]}>In column</Text>
            </FlexColumn>
          </View>
        </View>

        {/* Modal Primitives Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Modal Primitives</Text>

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>Modal Tests:</Text>
            <FlexRow gap="md" wrap style={styles.buttonRow}>
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

          <View style={styles.testGroup}>
            <Text style={[styles.testLabel, { color: theme.colors.text.main }]}>Backdrop Test:</Text>
            <Button type="light" onClick={() => setShowBackdrop(true)}>
              Show Backdrop Only
            </Button>
          </View>
        </View>

        {/* ResponsiveContainer Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>ResponsiveContainer</Text>
          <View style={[styles.infoBox, { backgroundColor: theme.colors.utilities.warning + '20', borderColor: theme.colors.utilities.warning }]}>
            <Text style={[styles.infoText, { color: theme.colors.utilities.warning }]}>
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
        <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text.strong }]}>Modal with Backdrop</Text>
          <Text style={[styles.modalText, { color: theme.colors.text.main }]}>
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
        <View style={[styles.backdropContent, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text.strong }]}>Content on Backdrop</Text>
          <Text style={[styles.modalText, { color: theme.colors.text.main }]}>
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
        <View style={styles.modalPrimitiveContent}>
          <Text style={[styles.modalText, { color: theme.colors.text.main }]}>
            This modal is built using the Modal primitive, which internally uses
            the ModalContainer primitive for backdrop and animations.
          </Text>

          <View style={styles.modalFeatures}>
            <Text style={[styles.featuresTitle, { color: theme.colors.text.strong }]}>Key Features:</Text>
            <Text style={[styles.featureItem, { color: theme.colors.text.main }]}>
              • Uses ModalContainer for consistent backdrop behavior
            </Text>
            <Text style={[styles.featureItem, { color: theme.colors.text.main }]}>
              • Smooth open/close animations
            </Text>
            <Text style={[styles.featureItem, { color: theme.colors.text.main }]}>
              • Cross-platform React Native implementation
            </Text>
            <Text style={[styles.featureItem, { color: theme.colors.text.main }]}>
              • Size variants (small, medium, large, full)
            </Text>
            <Text style={[styles.featureItem, { color: theme.colors.text.main }]}>
              • Desktop modal → Mobile drawer transformation
            </Text>
          </View>

          <FlexRow gap="md" justify="end" style={styles.modalActions}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor removed - now uses theme.colors.bg.app dynamically
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    // color removed - now uses theme.colors.text.strong dynamically
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    // color removed - now uses theme.colors.text.main dynamically
  },
  section: {
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    // color removed - now uses theme.colors.text.strong dynamically
    marginBottom: 12,
  },
  testGroup: {
    marginBottom: 16,
  },
  testLabel: {
    fontSize: 14,
    fontWeight: '500',
    // color removed - now uses theme.colors.text.main dynamically
    marginBottom: 8,
  },
  buttonRow: {
    paddingVertical: 8,
  },
  flexDemo: {
    // backgroundColor removed - now uses theme colors dynamically
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    // borderColor removed - now uses theme colors dynamically
  },
  centerDemo: {
    height: 60,
  },
  flexItem: {
    // backgroundColor removed - now uses theme colors dynamically
    padding: 8,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  flexText: {
    // color removed - now uses theme colors dynamically
    fontSize: 14,
  },
  containerDemo: {
    borderRadius: 8,
  },
  infoBox: {
    // backgroundColor and borderColor removed - now uses theme colors dynamically
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    // color removed - now uses theme colors dynamically
    fontSize: 14,
  },
  modalContent: {
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 12,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  backdropContent: {
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 12,
    padding: 24,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    // color removed - now uses theme colors dynamically
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalPrimitiveContent: {
    padding: 16,
  },
  modalFeatures: {
    marginVertical: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    // color removed - now uses theme colors dynamically
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    marginBottom: 4,
    lineHeight: 18,
  },
  modalActions: {
    marginTop: 16,
  },
});
