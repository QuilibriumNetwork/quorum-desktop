import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import Modal from '../components/primitives/Modal';
import { useTheme } from '../components/primitives/theme';
import { getColors } from '../components/primitives/theme/colors';

export const ModalTestScreen: React.FC = () => {
  const theme = useTheme();
  const colors = getColors(theme.mode, theme.accentColor);

  const [basicModal, setBasicModal] = useState(false);
  const [smallModal, setSmallModal] = useState(false);
  const [mediumModal, setMediumModal] = useState(false);
  const [largeModal, setLargeModal] = useState(false);
  const [fullModal, setFullModal] = useState(false);
  const [noCloseModal, setNoCloseModal] = useState(false);
  const [noSwipeModal, setNoSwipeModal] = useState(false);
  const [navigationModal, setNavigationModal] = useState(false);
  const [currentPage, setCurrentPage] = useState('menu');

  const buttonStyle = {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center' as const,
  };

  const buttonText = {
    color: 'white',
    fontSize: 16,
    fontWeight: '600' as const,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface[0], padding: 20 }}
    >
      <Text
        style={{
          color: colors.text.strong,
          fontSize: 24,
          fontWeight: 'bold',
          marginBottom: 10,
        }}
      >
        Modal Primitive
      </Text>
      <Text
        style={{ color: colors.text.subtle, fontSize: 16, marginBottom: 30 }}
      >
        Cross-platform modal that transforms to drawer on mobile
      </Text>

      <View style={{ marginBottom: 30 }}>
        <Text
          style={{
            color: colors.text.strong,
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 15,
          }}
        >
          Basic Modal
        </Text>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => setBasicModal(true)}
        >
          <Text style={buttonText}>Open Basic Modal</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: 30 }}>
        <Text
          style={{
            color: colors.text.strong,
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 15,
          }}
        >
          Modal Sizes
        </Text>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => setSmallModal(true)}
        >
          <Text style={buttonText}>Small Modal (40% height)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => setMediumModal(true)}
        >
          <Text style={buttonText}>Medium Modal (70% height)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => setLargeModal(true)}
        >
          <Text style={buttonText}>Large Modal (90% height)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => setFullModal(true)}
        >
          <Text style={buttonText}>Full Modal (100% height)</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: 30 }}>
        <Text
          style={{
            color: colors.text.strong,
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 15,
          }}
        >
          Modal Options
        </Text>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => setNoCloseModal(true)}
        >
          <Text style={buttonText}>No Close Button</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => setNoSwipeModal(true)}
        >
          <Text style={buttonText}>No Swipe to Close</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={buttonStyle}
          onPress={() => {
            setNavigationModal(true);
            setCurrentPage('menu');
          }}
        >
          <Text style={buttonText}>Navigation Example</Text>
        </TouchableOpacity>
      </View>

      {/* Basic Modal */}
      <Modal
        title="Basic Modal"
        visible={basicModal}
        onClose={() => setBasicModal(false)}
        size="medium"
      >
        <View style={{ padding: 20 }}>
          <Text
            style={{
              color: colors.text.main,
              fontSize: 16,
              marginBottom: 16,
              lineHeight: 24,
            }}
          >
            This is a basic modal that transforms into a drawer on mobile. You
            can close it by:
          </Text>
          <Text
            style={{ color: colors.text.subtle, fontSize: 14, marginBottom: 8 }}
          >
            • Tapping the ✕ button
          </Text>
          <Text
            style={{ color: colors.text.subtle, fontSize: 14, marginBottom: 8 }}
          >
            • Tapping outside the modal
          </Text>
          <Text
            style={{
              color: colors.text.subtle,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            • Swiping down from the handle area
          </Text>
          <TouchableOpacity
            style={[buttonStyle, { backgroundColor: '#34C759' }]}
            onPress={() => setBasicModal(false)}
          >
            <Text style={buttonText}>Close Modal</Text>
          </TouchableOpacity>
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
          <Text
            style={{ color: colors.text.main, fontSize: 16, marginBottom: 16 }}
          >
            This is a small modal that takes up 40% of the screen height.
          </Text>
          <TouchableOpacity
            style={[buttonStyle, { backgroundColor: '#FF3B30' }]}
            onPress={() => setSmallModal(false)}
          >
            <Text style={buttonText}>Close</Text>
          </TouchableOpacity>
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
          <Text
            style={{ color: colors.text.main, fontSize: 16, marginBottom: 16 }}
          >
            This is a medium modal that takes up 70% of the screen height. This
            is the default size.
          </Text>
          <View
            style={{
              backgroundColor: colors.surface[3],
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: colors.utilities.warning,
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              📱 Swipe Gesture Test
            </Text>
            <Text
              style={{
                color: colors.text.subtle,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Try swiping down from the top handle area to close this modal. The
              gesture only works from the handle and header area.
            </Text>
          </View>
          <TouchableOpacity
            style={[buttonStyle, { backgroundColor: '#FF9500' }]}
            onPress={() => setMediumModal(false)}
          >
            <Text style={buttonText}>Close</Text>
          </TouchableOpacity>
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
          <Text style={{ color: 'white', fontSize: 16, marginBottom: 16 }}>
            This is a large modal that takes up 90% of the screen height.
          </Text>
          <Text
            style={{
              color: '#ccc',
              fontSize: 14,
              marginBottom: 16,
              lineHeight: 20,
            }}
          >
            Large modals are perfect for complex forms or detailed content that
            needs more space. Notice how the content area is scrollable if it
            exceeds the available height.
          </Text>
          <View
            style={{
              backgroundColor: '#1E3A8A',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 8,
              }}
            >
              Scrollable Content
            </Text>
            <Text style={{ color: '#E5E7EB', fontSize: 14, lineHeight: 20 }}>
              This content demonstrates that the modal content area is
              scrollable when it exceeds the available height. You can scroll
              through long content while maintaining the header and
              swipe-to-close functionality.
            </Text>
          </View>
          <TouchableOpacity
            style={[buttonStyle, { backgroundColor: '#8B5CF6' }]}
            onPress={() => setLargeModal(false)}
          >
            <Text style={buttonText}>Close Large Modal</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Full Modal */}
      <Modal
        title="Full Screen Modal"
        visible={fullModal}
        onClose={() => setFullModal(false)}
        size="full"
      >
        <View style={{ padding: 20, flex: 1 }}>
          <Text style={{ color: 'white', fontSize: 16, marginBottom: 16 }}>
            This is a full-screen modal that takes up 100% of the screen height.
          </Text>
          <Text
            style={{
              color: '#ccc',
              fontSize: 14,
              marginBottom: 16,
              lineHeight: 20,
            }}
          >
            Full-screen modals remove the rounded corners and extend to the full
            height. Perfect for immersive experiences or complex workflows.
          </Text>
          <View
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ color: '#888', fontSize: 18, textAlign: 'center' }}>
              Full Screen Content Area
            </Text>
          </View>
          <TouchableOpacity
            style={[buttonStyle, { backgroundColor: '#FF3B30' }]}
            onPress={() => setFullModal(false)}
          >
            <Text style={buttonText}>Close Full Modal</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={{ color: 'white', fontSize: 16, marginBottom: 16 }}>
            This modal has no close button in the header. You can still close it
            by:
          </Text>
          <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 8 }}>
            • Tapping outside the modal
          </Text>
          <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 16 }}>
            • Swiping down from the handle area
          </Text>
          <TouchableOpacity
            style={[buttonStyle, { backgroundColor: '#007AFF' }]}
            onPress={() => setNoCloseModal(false)}
          >
            <Text style={buttonText}>Manual Close</Text>
          </TouchableOpacity>
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
          <Text
            style={{ color: colors.text.main, fontSize: 16, marginBottom: 16 }}
          >
            This modal has swipe-to-close disabled. Notice there's no handle at
            the top. You can only close it by:
          </Text>
          <Text
            style={{ color: colors.text.subtle, fontSize: 14, marginBottom: 8 }}
          >
            • Tapping the ✕ button
          </Text>
          <Text
            style={{
              color: colors.text.subtle,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            • Tapping outside the modal
          </Text>
          <TouchableOpacity
            style={[buttonStyle, { backgroundColor: '#FF9500' }]}
            onPress={() => setNoSwipeModal(false)}
          >
            <Text style={buttonText}>Close Modal</Text>
          </TouchableOpacity>
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
              <Text
                style={{
                  color: colors.text.main,
                  fontSize: 16,
                  marginBottom: 20,
                }}
              >
                This demonstrates navigation within a modal, similar to
                UserSettingsModal on desktop.
              </Text>

              <TouchableOpacity
                style={[
                  buttonStyle,
                  { backgroundColor: colors.surface[3], marginBottom: 12 },
                ]}
                onPress={() => setCurrentPage('profile')}
              >
                <Text style={[buttonText, { color: colors.text.main }]}>
                  Profile Settings →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  buttonStyle,
                  { backgroundColor: colors.surface[3], marginBottom: 12 },
                ]}
                onPress={() => setCurrentPage('appearance')}
              >
                <Text style={[buttonText, { color: colors.text.main }]}>
                  Appearance →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[buttonStyle, { backgroundColor: colors.surface[3] }]}
                onPress={() => setNavigationModal(false)}
              >
                <Text style={[buttonText, { color: colors.text.main }]}>
                  Close Settings
                </Text>
              </TouchableOpacity>
            </View>
          ) : currentPage === 'profile' ? (
            <View style={{ padding: 20 }}>
              <TouchableOpacity
                style={{ marginBottom: 20 }}
                onPress={() => setCurrentPage('menu')}
              >
                <Text style={{ color: colors.accent[500], fontSize: 16 }}>
                  ← Back to Settings
                </Text>
              </TouchableOpacity>

              <Text
                style={{
                  color: colors.text.strong,
                  fontSize: 18,
                  marginBottom: 16,
                }}
              >
                Profile Settings
              </Text>
              <Text
                style={{
                  color: colors.text.main,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                Configure your profile, username, avatar, and other personal
                settings here.
              </Text>
            </View>
          ) : (
            <View style={{ padding: 20 }}>
              <TouchableOpacity
                style={{ marginBottom: 20 }}
                onPress={() => setCurrentPage('menu')}
              >
                <Text style={{ color: colors.accent[500], fontSize: 16 }}>
                  ← Back to Settings
                </Text>
              </TouchableOpacity>

              <Text
                style={{
                  color: colors.text.strong,
                  fontSize: 18,
                  marginBottom: 16,
                }}
              >
                Appearance Settings
              </Text>
              <Text
                style={{
                  color: colors.text.main,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                Choose your theme, accent color, and other visual preferences.
              </Text>
            </View>
          )}
        </View>
      </Modal>

      <View
        style={{
          backgroundColor: colors.surface[2],
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: colors.utilities.success,
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 8,
          }}
        >
          📱 Mobile Testing Notes
        </Text>
        <Text
          style={{ color: colors.text.subtle, fontSize: 12, lineHeight: 18 }}
        >
          • Web: Centered modal with backdrop and ESC key support{'\n'}• Mobile:
          Bottom drawer with slide-up animation and swipe gestures{'\n'}• All
          sizes adapt to mobile screen dimensions (40%, 70%, 90%, 100%){'\n'}•
          Swipe gestures work from handle and header area only{'\n'}•
          Theme-aware colors adapt to light/dark mode automatically{'\n'}• No
          FontAwesome dependencies - uses simple ✕ character
        </Text>
      </View>
    </ScrollView>
  );
};
