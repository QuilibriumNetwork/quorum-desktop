import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Modal from '../components/primitives/Modal';
import Button from '../components/primitives/Button';
import { Icon } from '../components/primitives/Icon';
import { useTheme } from '../components/primitives/theme';
import { Text } from '../components/primitives/Text';
import { commonTestStyles } from '../styles/commonTestStyles';

export const ModalTestScreen: React.FC = () => {
  const theme = useTheme();
  const colors = theme.colors;

  const [basicModal, setBasicModal] = useState(false);
  const [smallModal, setSmallModal] = useState(false);
  const [mediumModal, setMediumModal] = useState(false);
  const [largeModal, setLargeModal] = useState(false);
  const [noCloseModal, setNoCloseModal] = useState(false);
  const [noSwipeModal, setNoSwipeModal] = useState(false);
  const [navigationModal, setNavigationModal] = useState(false);
  const [currentPage, setCurrentPage] = useState('menu');


  return (
    <ScrollView
      style={[commonTestStyles.container, { backgroundColor: colors.surface[0] }]}
      contentContainerStyle={commonTestStyles.contentPadding}
    >
      <View style={commonTestStyles.header}>
        <View style={commonTestStyles.titleContainer}>
          <Icon name="clipboard" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
          <Text size="2xl" weight="bold" variant="strong">
            Modal
          </Text>
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Cross-platform modal that transforms to drawer on mobile
          </Text>
        </View>
      </View>

      <View style={commonTestStyles.subSection}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Basic Modal
          </Text>
        </View>

        <View style={commonTestStyles.buttonContainer}>
          <Button
            type="primary"
            onClick={() => setBasicModal(true)}
          >
            Open Basic Modal
          </Button>
        </View>
      </View>

      <View style={commonTestStyles.subSection}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Modal Sizes
          </Text>
        </View>

        <View style={commonTestStyles.buttonContainer}>
          <Button
            type="primary"
            onClick={() => setSmallModal(true)}
          >
            Small Modal (40% height)
          </Button>
        </View>

        <View style={commonTestStyles.buttonContainer}>
          <Button
            type="primary"
            onClick={() => setMediumModal(true)}
          >
            Medium Modal (70% height)
          </Button>
        </View>

        <View style={commonTestStyles.buttonContainer}>
          <Button
            type="primary"
            onClick={() => setLargeModal(true)}
          >
            Large Modal (90% height)
          </Button>
        </View>
      </View>

      <View style={commonTestStyles.subSection}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Modal Options
          </Text>
        </View>

        <View style={commonTestStyles.buttonContainer}>
          <Button
            type="primary"
            onClick={() => setNoCloseModal(true)}
          >
            No Close Button
          </Button>
        </View>

        <View style={commonTestStyles.buttonContainer}>
          <Button
            type="primary"
            onClick={() => setNoSwipeModal(true)}
          >
            No Swipe to Close
          </Button>
        </View>

        <View style={commonTestStyles.buttonContainer}>
          <Button
            type="primary"
            onClick={() => {
              setNavigationModal(true);
              setCurrentPage('menu');
            }}
          >
            Navigation Example
          </Button>
        </View>
      </View>

      {/* Basic Modal */}
      <Modal
        title="Basic Modal"
        visible={basicModal}
        onClose={() => setBasicModal(false)}
        size="medium"
      >
        <View style={{ padding: 20 }}>
          <View style={{ marginBottom: 16 }}>
            <Text size="sm" variant="default">
              This is a basic modal that transforms into a drawer on mobile. You
              can close it by:
            </Text>
          </View>
          <Text size="sm" variant="subtle">
            • Tapping outside the modal
          </Text>
          <View style={{ marginBottom: 16 }}>
            <Text size="sm" variant="subtle">
              • Swiping down from the handle area
            </Text>
          </View>
          <Button
            type="primary"
            onClick={() => setBasicModal(false)}
          >
            Close Modal
          </Button>
        </View>
      </Modal>

      {/* Small Modal */}
      <Modal
        title="Small Modal"
        visible={smallModal}
        onClose={() => setSmallModal(false)}
        size="small"
      >
        <View style={{ padding: 20 }}>
          <View style={{ marginBottom: 16 }}>
            <Text size="sm" variant="default">
              This is a small modal that takes up 40% of the screen height.
            </Text>
          </View>
          <Button
            type="danger"
            onClick={() => setSmallModal(false)}
          >
            Close
          </Button>
        </View>
      </Modal>

      {/* Medium Modal */}
      <Modal
        title="Medium Modal"
        visible={mediumModal}
        onClose={() => setMediumModal(false)}
        size="medium"
      >
        <View style={{ padding: 20 }}>
          <View style={{ marginBottom: 16 }}>
            <Text size="sm" variant="default">
              This is a medium modal that takes up 70% of the screen height. This
              is the default size.
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.surface[3],
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Icon name="mobile" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
              <Text size="sm" variant="strong">
                Swipe Gesture Test
              </Text>
            </View>
            <Text size="sm" variant="subtle">
              Try swiping down from the top handle area to close this modal. The
              gesture only works from the handle and header area.
            </Text>
          </View>
          <Button
            type="primary"
            onClick={() => setMediumModal(false)}
          >
            Close
          </Button>
        </View>
      </Modal>

      {/* Large Modal */}
      <Modal
        title="Large Modal"
        visible={largeModal}
        onClose={() => setLargeModal(false)}
        size="large"
      >
        <ScrollView style={{ padding: 20 }}>
          <Text size="sm" variant="default">
            This is a large modal that takes up 90% of the screen height.
          </Text>
          <Text size="sm" variant="subtle">
            Large modals are perfect for complex forms or detailed content that
            needs more space. Notice how the content area is scrollable if it
            exceeds the available height.
          </Text>

          {/* Extended scrollable content to test scrolling */}
          {Array.from({ length: 5 }, (_, index) => (
            <View
              key={index}
              style={{
                backgroundColor: colors.surface[3],
                padding: 16,
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <View style={{ marginBottom: 8 }}>
                <Text size="base" weight="bold" variant="strong">
                  Scrollable Section {index + 1}
                </Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text size="sm" variant="default">
                  This is section {index + 1} of the scrollable content. Each
                  section contains enough text and content to demonstrate the
                  scrolling functionality properly. The modal should maintain
                  smooth scrolling while keeping the header fixed.
                </Text>
              </View>
              <Text size="xs" variant="subtle">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor
                in reprehenderit in voluptate velit esse cillum dolore eu fugiat
                nulla pariatur.
              </Text>
            </View>
          ))}

          <View
            style={{
              backgroundColor: colors.surface[4],
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <View style={{ marginBottom: 8 }}>
              <Text size="base" weight="bold" variant="strong">
                Final Scrollable Section
              </Text>
            </View>
            <Text size="sm" variant="default">
              This is the final section that demonstrates the modal content area
              is fully scrollable when it exceeds the available height. You can
              scroll through all this content while maintaining the header and
              swipe-to-close functionality at the top.
            </Text>
          </View>
          <Button
            type="primary"
            onClick={() => setLargeModal(false)}
          >
            Close Large Modal
          </Button>
        </ScrollView>
      </Modal>

      {/* No Close Button Modal */}
      <Modal
        title="No Close Button"
        visible={noCloseModal}
        onClose={() => setNoCloseModal(false)}
        hideClose={true}
        size="medium"
      >
        <View style={{ padding: 20 }}>
          <Text size="sm" variant="default">
            This modal has no close button in the header. You can still close it
            by:
          </Text>
          <Text size="sm" variant="subtle">
            • Tapping outside the modal
          </Text>
          <Text size="sm" variant="subtle">
            • Swiping down from the handle area
          </Text>
          <Button
            type="primary"
            onClick={() => setNoCloseModal(false)}
          >
            Manual Close
          </Button>
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
        <View style={{ padding: 20 }}>
          <Text size="sm" variant="default">
            This modal has swipe-to-close disabled. Notice there's no handle at
            the top. You can only close it by:
          </Text>
          <Text size="sm" variant="subtle">
            • Tapping the ✕ button
          </Text>
          <Text size="sm" variant="subtle">
            • Tapping outside the modal
          </Text>
          <Button
            type="primary"
            onClick={() => setNoSwipeModal(false)}
          >
            Close Modal
          </Button>
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
            <View style={{ padding: 20 }}>
              <View style={{ marginBottom: 20 }}>
                <Text size="base" variant="default">
                  This demonstrates navigation within a modal, similar to
                  UserSettingsModal on desktop.
                </Text>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Button
                  type="subtle"
                  onClick={() => setCurrentPage('profile')}
                >
                  Profile Settings →
                </Button>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Button
                  type="subtle"
                  onClick={() => setCurrentPage('appearance')}
                >
                  Appearance →
                </Button>
              </View>

              <Button
                type="subtle"
                onClick={() => setNavigationModal(false)}
              >
                Close Settings
              </Button>
            </View>
          ) : currentPage === 'profile' ? (
            <View style={{ padding: 20 }}>
              <View style={{ marginBottom: 20 }}>
                <Button
                  type="unstyled"
                  onClick={() => setCurrentPage('menu')}
                >
                  <Text size="base" color={colors.accent[500]}>
                    ← Back to Settings
                  </Text>
                </Button>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text size="lg" weight="semibold" variant="strong">
                  Profile Settings
                </Text>
              </View>
              <Text size="sm" variant="default">
                Configure your profile, username, avatar, and other personal
                settings here.
              </Text>
            </View>
          ) : (
            <View style={{ padding: 20 }}>
              <View style={{ marginBottom: 20 }}>
                <Button
                  type="unstyled"
                  onClick={() => setCurrentPage('menu')}
                >
                  <Text size="base" color={colors.accent[500]}>
                    ← Back to Settings
                  </Text>
                </Button>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text size="lg" weight="semibold" variant="strong">
                  Appearance Settings
                </Text>
              </View>
              <Text size="sm" variant="default">
                Choose your theme, accent color, and other visual preferences.
              </Text>
            </View>
          )}
        </View>
      </Modal>

      <View
        style={[
          commonTestStyles.notesSection,
          { backgroundColor: colors.surface[3] }
        ]}
      >
        <View style={commonTestStyles.titleContainer}>
          <Text size="base" weight="semibold" variant="strong">
            Mobile Notes
          </Text>
        </View>
        <Text size="sm" variant="default">
          • Web: Centered modal with backdrop and ESC key support
        </Text>
        <Text size="sm" variant="default">
          • Mobile: Bottom drawer with slide-up animation and swipe gestures
        </Text>
        <Text size="sm" variant="default">
          • All sizes adapt to mobile screen dimensions (40%, 70%, 90%)
        </Text>
        <Text size="sm" variant="default">
          • Swipe gestures work from handle and header area only
        </Text>
        <Text size="sm" variant="default">
          • Theme-aware colors adapt to light/dark mode automatically
        </Text>
        <Text size="sm" variant="default">
          • Uses FontAwesome icons for consistent cross-platform design
        </Text>
      </View>
    </ScrollView>
  );
};

// All styles now centralized in commonTestStyles
