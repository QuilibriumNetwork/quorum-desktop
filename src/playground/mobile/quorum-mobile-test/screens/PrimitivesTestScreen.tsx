import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import our primitives
import { ModalContainer } from '@/primitives/ModalContainer';
import { OverlayBackdrop } from '@/primitives/OverlayBackdrop';
import { FlexRow } from '@/primitives/FlexRow';
import { FlexBetween } from '@/primitives/FlexBetween';
import { FlexCenter } from '@/primitives/FlexCenter';
import { ResponsiveContainer } from '@/primitives/ResponsiveContainer';
import Button from '@/primitives/Button';
import Modal from '@/primitives/Modal';

/**
 * Mobile test screen for all primitives
 * Tests React Native implementations of cross-platform primitives
 */
export const PrimitivesTestScreen: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showNoBackdropModal, setShowNoBackdropModal] = useState(false);
  const [showModalPrimitive, setShowModalPrimitive] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Mobile Primitives Test</Text>
          <Text style={styles.subtitle}>
            Testing React Native implementations of cross-platform primitives
          </Text>
        </View>

        {/* Button Primitive Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Button Primitive</Text>
          
          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>Button Types:</Text>
            <FlexRow gap="md" wrap style={styles.buttonRow}>
              <Button type="primary" onPress={() => console.log('Primary pressed')}>
                Primary
              </Button>
              <Button type="secondary" onPress={() => console.log('Secondary pressed')}>
                Secondary
              </Button>
              <Button type="light" onPress={() => console.log('Light pressed')}>
                Light
              </Button>
            </FlexRow>
          </View>

          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>Button Sizes:</Text>
            <FlexRow gap="md" align="center" style={styles.buttonRow}>
              <Button type="primary" size="normal" onPress={() => {}}>
                Normal Size
              </Button>
              <Button type="primary" size="small" onPress={() => {}}>
                Small Size
              </Button>
            </FlexRow>
          </View>

          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>Disabled State:</Text>
            <FlexRow gap="md" style={styles.buttonRow}>
              <Button type="primary" disabled onPress={() => {}}>
                Disabled Primary
              </Button>
              <Button type="secondary" disabled onPress={() => {}}>
                Disabled Secondary
              </Button>
            </FlexRow>
          </View>
        </View>

        {/* Flex Primitives Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flex Primitives</Text>
          
          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>FlexRow with gap:</Text>
            <FlexRow gap="md" style={styles.flexDemo}>
              <View style={styles.flexItem}><Text>Item 1</Text></View>
              <View style={styles.flexItem}><Text>Item 2</Text></View>
              <View style={styles.flexItem}><Text>Item 3</Text></View>
            </FlexRow>
          </View>

          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>FlexBetween:</Text>
            <FlexBetween style={styles.flexDemo}>
              <Text style={styles.flexText}>Left Content</Text>
              <Button type="secondary" size="small" onPress={() => {}}>
                Right Action
              </Button>
            </FlexBetween>
          </View>

          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>FlexCenter:</Text>
            <FlexCenter style={[styles.flexDemo, styles.centerDemo]}>
              <Text style={styles.flexText}>Centered Content</Text>
            </FlexCenter>
          </View>
        </View>

        {/* Modal Primitives Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modal Primitives</Text>
          
          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>Modal Tests:</Text>
            <FlexRow gap="md" wrap style={styles.buttonRow}>
              <Button 
                type="primary"
                onPress={() => setShowModal(true)}
              >
                Show Modal with Backdrop
              </Button>
              
              <Button 
                type="secondary"
                onPress={() => setShowModalPrimitive(true)}
              >
                Show Modal Primitive
              </Button>
            </FlexRow>
          </View>

          <View style={styles.testGroup}>
            <Text style={styles.testLabel}>Backdrop Test:</Text>
            <Button 
              type="light"
              onPress={() => setShowBackdrop(true)}
            >
              Show Backdrop Only
            </Button>
          </View>
        </View>

        {/* ResponsiveContainer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ResponsiveContainer</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ResponsiveContainer is a layout primitive that works behind the scenes.
              On mobile, it provides SafeAreaView integration and proper content positioning.
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
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Modal with Backdrop</Text>
          <Text style={styles.modalText}>
            This modal uses the ModalContainer primitive with backdrop.
            Tap outside or press the close button to close.
          </Text>
          <Button onPress={() => setShowModal(false)}>
            Close Modal
          </Button>
        </View>
      </ModalContainer>

      {/* Backdrop only test */}
      <OverlayBackdrop
        visible={showBackdrop}
        onBackdropClick={() => setShowBackdrop(false)}
        blur={true}
      >
        <View style={styles.backdropContent}>
          <Text style={styles.modalTitle}>Content on Backdrop</Text>
          <Text style={styles.modalText}>
            This demonstrates the OverlayBackdrop primitive.
            Tap the dark area to close.
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
          <Text style={styles.modalText}>
            This modal is built using the Modal primitive, which internally uses 
            the ModalContainer primitive for backdrop and animations.
          </Text>
          
          <View style={styles.modalFeatures}>
            <Text style={styles.featuresTitle}>Key Features:</Text>
            <Text style={styles.featureItem}>• Uses ModalContainer for consistent backdrop behavior</Text>
            <Text style={styles.featureItem}>• Smooth open/close animations</Text>
            <Text style={styles.featureItem}>• Cross-platform React Native implementation</Text>
            <Text style={styles.featureItem}>• Size variants (small, medium, large, full)</Text>
            <Text style={styles.featureItem}>• Desktop modal → Mobile drawer transformation</Text>
          </View>
          
          <FlexRow gap="md" justify="end" style={styles.modalActions}>
            <Button type="secondary" onPress={() => setShowModalPrimitive(false)}>
              Cancel
            </Button>
            <Button type="primary" onPress={() => setShowModalPrimitive(false)}>
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
    backgroundColor: '#f5f5f5',
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
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
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
    color: '#333',
    marginBottom: 12,
  },
  testGroup: {
    marginBottom: 16,
  },
  testLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  buttonRow: {
    paddingVertical: 8,
  },
  flexDemo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  centerDemo: {
    height: 60,
  },
  flexItem: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  flexText: {
    color: '#333',
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    color: '#856404',
    fontSize: 14,
  },
  modalContent: {
    backgroundColor: 'white',
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
    backgroundColor: 'white',
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
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#666',
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
    color: '#333',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  modalActions: {
    marginTop: 16,
  },
});