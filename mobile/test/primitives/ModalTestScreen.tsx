import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Modal,
  Button,
  Icon,
  useTheme,
  Text,
  Paragraph,
  Title,
  Flex,
} from '@/components/primitives';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';

export const ModalTestScreen: React.FC = () => {
  const theme = useTheme();
  const colors = theme.colors;
  const themedStyles = createThemedStyles(theme);

  const [basicModal, setBasicModal] = useState(false);
  const [smallModal, setSmallModal] = useState(false);
  const [mediumModal, setMediumModal] = useState(false);
  const [largeModal, setLargeModal] = useState(false);
  const [noCloseModal, setNoCloseModal] = useState(false);
  const [noSwipeModal, setNoSwipeModal] = useState(false);
  // Removed swipeUpModal - @gorhom/bottom-sheet has built-in expand gesture
  const [navigationModal, setNavigationModal] = useState(false);
  const [currentPage, setCurrentPage] = useState('menu');
  const [deviceTestModal, setDeviceTestModal] = useState(false);

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.header}>
          <Flex direction="column" gap="sm" align="center">
            <Flex
              gap="md"
              align="center"
              style={{ alignItems: 'flex-start' }}
            >
              <Icon name="clipboard" size="xl" style={{ marginTop: 2 }} />
              <Title>Modal</Title>
            </Flex>
            <Paragraph align="center">
              Cross-platform modal that transforms to drawer on mobile
            </Paragraph>
          </Flex>
        </View>

        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Basic Modal</Title>
            <Flex gap="sm">
              <Button type="primary" onClick={() => setBasicModal(true)}>
                Open Basic Modal
              </Button>
            </Flex>
          </Flex>
        </View>

        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Modal Sizes</Title>
            <Flex direction="column" gap="sm">
              <Button type="primary" onClick={() => setSmallModal(true)}>
                Small Modal (40% height)
              </Button>
              <Button type="primary" onClick={() => setMediumModal(true)}>
                Medium Modal (70% height)
              </Button>
              <Button type="primary" onClick={() => setLargeModal(true)}>
                Large Modal (90% height)
              </Button>
            </Flex>
          </Flex>
        </View>

        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Modal Options</Title>
            <Flex direction="column" gap="sm">
              <Button type="primary" onClick={() => setNoCloseModal(true)}>
                No Close Button
              </Button>
              <Button type="primary" onClick={() => setNoSwipeModal(true)}>
                No Swipe to Close
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  setNavigationModal(true);
                  setCurrentPage('menu');
                }}
              >
                Navigation Example
              </Button>
            </Flex>
          </Flex>
        </View>

        {/* Basic Modal */}
        <Modal
          title="Basic Modal"
          visible={basicModal}
          onClose={() => setBasicModal(false)}
          size="medium"
        >
          <View>
            <Flex direction="column" gap="md">
              <Paragraph>
                This is a basic modal that transforms into a drawer on mobile.
                You can close it by:
              </Paragraph>
              <Flex direction="column" gap="xs">
                <Text size="sm" color={colors.text.subtle}>
                  • Tapping outside the modal
                </Text>
                <Text size="sm" color={colors.text.subtle}>
                  • Swiping down from the handle area
                </Text>
              </Flex>
              <Button type="primary" onClick={() => setBasicModal(false)}>
                Close Modal
              </Button>
            </Flex>
          </View>
        </Modal>

        {/* Small Modal */}
        <Modal
          title="Small Modal"
          visible={smallModal}
          onClose={() => setSmallModal(false)}
          size="small"
        >
          <View>
            <Flex direction="column" gap="md">
              <Paragraph>
                This is a small modal that takes up 40% of the screen height.
              </Paragraph>
              <Button type="danger" onClick={() => setSmallModal(false)}>
                Close
              </Button>
            </Flex>
          </View>
        </Modal>

        {/* Medium Modal */}
        <Modal
          title="Medium Modal"
          visible={mediumModal}
          onClose={() => setMediumModal(false)}
          size="medium"
        >
          <View>
            <Flex direction="column" gap="md">
              <Paragraph>
                This is a medium modal that takes up 70% of the screen height.
                This is the default size.
              </Paragraph>
              <View
                style={{
                  backgroundColor: colors.surface[3],
                  padding: 16,
                  borderRadius: 8,
                }}
              >
                <Flex direction="column" gap="sm">
                  <Flex gap="sm" style={{ alignItems: 'center' }}>
                    <Icon name="mobile" size="xl" />
                    <Title size="sm">Swipe Gesture Test</Title>
                  </Flex>
                  <Text size="sm" color={colors.text.subtle}>
                    Try swiping down from the top handle area to close this
                    modal. The gesture only works from the handle and header
                    area.
                  </Text>
                </Flex>
              </View>
              <Button type="primary" onClick={() => setMediumModal(false)}>
                Close
              </Button>
            </Flex>
          </View>
        </Modal>

        {/* Large Modal */}
        <Modal
          title="Large Modal"
          visible={largeModal}
          onClose={() => setLargeModal(false)}
          size="large"
        >
          <Flex direction="column" gap="md">
            <Paragraph>
              This is a large modal that takes up 90% of the screen height.
            </Paragraph>
            <Text size="sm" color={colors.text.subtle}>
              Large modals are perfect for complex forms or detailed content
              that needs more space. Notice how the content area is scrollable
              if it exceeds the available height.
            </Text>

            {/* Extended scrollable content to test scrolling - INCREASED FOR BETTER TESTING */}
            {Array.from({ length: 12 }, (_, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: colors.surface[3],
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <Flex direction="column" gap="sm">
                  <Title size="sm">
                    🔄 Scrollable Test Section {index + 1}
                  </Title>
                  <Paragraph>
                    This is section {index + 1} of the scrollable content. Each
                    section contains enough text and content to demonstrate the
                    scrolling functionality properly. The modal should maintain
                    smooth scrolling while keeping the header fixed.
                  </Paragraph>
                  <Text size="xs" color={colors.text.subtle}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                    do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua. Ut enim ad minim veniam, quis nostrud exercitation
                    ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    Duis aute irure dolor in reprehenderit in voluptate velit
                    esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
                    occaecat cupidatat non proident.
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.surface[5],
                      padding: 8,
                      borderRadius: 4,
                      marginTop: 8,
                    }}
                  >
                    <Text size="xs" color={colors.text.muted}>
                      Section {index + 1} - If you can read this, scrolling is
                      working! 🎉
                    </Text>
                  </View>
                </Flex>
              </View>
            ))}

            <View
              style={{
                backgroundColor: colors.surface[4],
                padding: 16,
                borderRadius: 8,
              }}
            >
              <Flex direction="column" gap="sm">
                <Title size="sm">Final Scrollable Section</Title>
                <Paragraph>
                  This is the final section that demonstrates the modal content
                  area is fully scrollable when it exceeds the available height.
                  You can scroll through all this content while maintaining the
                  header and swipe-to-close functionality at the top.
                </Paragraph>
              </Flex>
            </View>

            <View
              style={{
                backgroundColor: colors.success + '20',
                padding: 16,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.success,
                marginTop: 16,
              }}
            >
              <Text size="sm" color={colors.success}>
                ✅ SUCCESS! If you can see this message, scrolling is working
                perfectly! This should be at the bottom of all the scrollable
                content.
              </Text>
            </View>

            <Button
              type="primary"
              onClick={() => setLargeModal(false)}
              style={{ marginTop: 20 }}
            >
              🎯 Close Large Modal (Bottom Button)
            </Button>
          </Flex>
        </Modal>

        {/* No Close Button Modal */}
        <Modal
          title="No Close Button"
          visible={noCloseModal}
          onClose={() => setNoCloseModal(false)}
          hideClose={true}
          size="medium"
        >
          <View>
            <Flex direction="column" gap="md">
              <Paragraph>
                This modal has no close button in the header. You can still
                close it by:
              </Paragraph>
              <Flex direction="column" gap="xs">
                <Text size="sm" color={colors.text.subtle}>
                  • Tapping outside the modal
                </Text>
                <Text size="sm" color={colors.text.subtle}>
                  • Swiping down from the handle area
                </Text>
              </Flex>
              <Button type="primary" onClick={() => setNoCloseModal(false)}>
                Manual Close
              </Button>
            </Flex>
          </View>
        </Modal>

        {/* No Swipe Modal */}
        <Modal
          title="No Swipe to Close"
          visible={noSwipeModal}
          onClose={() => setNoSwipeModal(false)}
          swipeToClose={false}
          size="medium"
        >
          <View>
            <Flex direction="column" gap="md">
              <Paragraph>
                This modal has swipe-to-close disabled. Notice there's no handle
                at the top. You can only close it by:
              </Paragraph>
              <Flex direction="column" gap="xs">
                <Text size="sm" color={colors.text.subtle}>
                  • Tapping the ✕ button
                </Text>
                <Text size="sm" color={colors.text.subtle}>
                  • Tapping outside the modal
                </Text>
              </Flex>
              <Button type="primary" onClick={() => setNoSwipeModal(false)}>
                Close Modal
              </Button>
            </Flex>
          </View>
        </Modal>

        {/* Navigation Example Modal */}
        <Modal
          title={
            currentPage === 'menu'
              ? 'Settings'
              : currentPage === 'profile'
                ? 'Profile Settings'
                : 'Appearance'
          }
          visible={navigationModal}
          onClose={() => setNavigationModal(false)}
          size="large"
        >
          <View style={{ flex: 1 }}>
            {currentPage === 'menu' ? (
              <View>
                <Flex direction="column" gap="lg">
                  <Paragraph>
                    This demonstrates navigation within a modal, similar to
                    UserSettingsModal on desktop.
                  </Paragraph>

                  <Flex direction="column" gap="sm">
                    <Button
                      type="subtle"
                      onClick={() => setCurrentPage('profile')}
                    >
                      Profile Settings →
                    </Button>

                    <Button
                      type="subtle"
                      onClick={() => setCurrentPage('appearance')}
                    >
                      Appearance →
                    </Button>

                    <Button
                      type="subtle"
                      onClick={() => setNavigationModal(false)}
                    >
                      Close Settings
                    </Button>
                  </Flex>
                </Flex>
              </View>
            ) : currentPage === 'profile' ? (
              <View>
                <Flex direction="column" gap="lg">
                  <Button
                    type="unstyled"
                    onClick={() => setCurrentPage('menu')}
                  >
                    <Text size="base" color={colors.accent[500]}>
                      ← Back to Settings
                    </Text>
                  </Button>

                  <Flex direction="column" gap="md">
                    <Title size="sm">Profile Settings</Title>
                    <Paragraph>
                      Configure your profile, username, avatar, and other
                      personal settings here.
                    </Paragraph>
                  </Flex>
                </Flex>
              </View>
            ) : (
              <View>
                <Flex direction="column" gap="lg">
                  <Button
                    type="unstyled"
                    onClick={() => setCurrentPage('menu')}
                  >
                    <Text size="base" color={colors.accent[500]}>
                      ← Back to Settings
                    </Text>
                  </Button>

                  <Flex direction="column" gap="md">
                    <Title size="sm">Appearance Settings</Title>
                    <Paragraph>
                      Choose your theme, accent color, and other visual
                      preferences.
                    </Paragraph>
                  </Flex>
                </Flex>
              </View>
            )}
          </View>
        </Modal>

        <View style={themedStyles.notesSection}>
          <Flex direction="column" gap="md">
            <Title size="sm">Mobile Notes</Title>
            <Flex direction="column" gap="sm">
              <Flex gap="xs" align="start">
                <Text size="sm">•</Text>
                <View style={{ flex: 1 }}>
                  <Text size="sm">
                    Web: Centered modal with backdrop and ESC key support
                  </Text>
                </View>
              </Flex>

              <Flex gap="xs" align="start">
                <Text size="sm">•</Text>
                <View style={{ flex: 1 }}>
                  <Text size="sm">
                    Mobile: Bottom drawer with slide-up animation and swipe
                    gestures
                  </Text>
                </View>
              </Flex>

              <Flex gap="xs" align="start">
                <Text size="sm">•</Text>
                <View style={{ flex: 1 }}>
                  <Text size="sm">
                    All sizes adapt to mobile screen dimensions (40%, 70%, 90%)
                  </Text>
                </View>
              </Flex>

              <Flex gap="xs" align="start">
                <Text size="sm">•</Text>
                <View style={{ flex: 1 }}>
                  <Text size="sm">
                    Swipe gestures work from handle and header area only
                  </Text>
                </View>
              </Flex>

              <Flex gap="xs" align="start">
                <Text size="sm">•</Text>
                <View style={{ flex: 1 }}>
                  <Text size="sm">
                    Built-in expand gesture: all modals can be expanded by
                    swiping up on the handle
                  </Text>
                </View>
              </Flex>

              <Flex gap="xs" align="start">
                <Text size="sm">•</Text>
                <View style={{ flex: 1 }}>
                  <Text size="sm">
                    Theme-aware colors adapt to light/dark mode automatically
                  </Text>
                </View>
              </Flex>

              <Flex gap="xs" align="start">
                <Text size="sm">•</Text>
                <View style={{ flex: 1 }}>
                  <Text size="sm">
                    Uses FontAwesome icons for consistent cross-platform design
                  </Text>
                </View>
              </Flex>
            </Flex>
          </Flex>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
