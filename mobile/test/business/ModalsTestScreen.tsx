import React, { useState } from 'react';
import { ScrollView, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  FlexRow,
  Text,
  Icon,
  Title,
} from '@/components/primitives';
import { useTheme } from '@/components/primitives/theme';
import { IconName } from '@/components/primitives/Icon/types';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';
import TestLeaveSpaceModal from './TestLeaveSpaceModal';
import TestKickUserModal from './TestKickUserModal';

interface ModalTest {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  status: 'cross-platform' | 'web-only' | 'pending';
  testAction: () => void;
}

interface ModalsTestScreenProps {
  onGoBack: () => void;
}

export const ModalsTestScreen: React.FC<ModalsTestScreenProps> = ({
  onGoBack,
}) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  // Modal visibility states
  const [leaveSpaceModalVisible, setLeaveSpaceModalVisible] = useState(false);
  const [kickUserModalVisible, setKickUserModalVisible] = useState(false);

  // Mock data for testing
  const mockSpaceId = 'test-space-123';
  const mockUserAddress = 'test-user-address-456';

  const handlePlannedModal = (title: string) => {
    Alert.alert(
      'Coming Soon',
      `${title} modal is planned for mobile implementation.`,
      [{ text: 'OK' }]
    );
  };

  const modalTests: ModalTest[] = [
    {
      id: 'leave-space',
      title: 'LeaveSpaceModal',
      description:
        'Confirmation modal for leaving a space with double-click protection and swipe-to-close',
      icon: 'close',
      status: 'cross-platform',
      testAction: () => setLeaveSpaceModalVisible(true),
    },
    {
      id: 'kick-user',
      title: 'KickUserModal',
      description:
        'Confirmation modal for kicking a user from space with haptic feedback',
      icon: 'ban',
      status: 'cross-platform',
      testAction: () => setKickUserModalVisible(true),
    },
    {
      id: 'confirm',
      title: 'ConfirmModal',
      description: 'Generic confirmation modal with customizable actions',
      icon: 'warning',
      status: 'pending',
      testAction: () => handlePlannedModal('ConfirmModal'),
    },
    {
      id: 'settings',
      title: 'SettingsModal',
      description:
        'App settings modal with form validation and keyboard avoidance',
      icon: 'settings',
      status: 'pending',
      testAction: () => handlePlannedModal('SettingsModal'),
    },
    {
      id: 'invite',
      title: 'InviteModal',
      description: 'Space invitation modal with user search and permissions',
      icon: 'user',
      status: 'pending',
      testAction: () => handlePlannedModal('InviteModal'),
    },
    {
      id: 'image-preview',
      title: 'ImagePreviewModal',
      description:
        'Full-screen image preview with pinch-to-zoom and swipe gestures',
      icon: 'image',
      status: 'pending',
      testAction: () => handlePlannedModal('ImagePreviewModal'),
    },
  ];

  const getStatusColor = (status: ModalTest['status']) => {
    switch (status) {
      case 'cross-platform':
        return theme.colors.success;
      case 'web-only':
        return theme.colors.warning;
      case 'pending':
        return theme.colors.text.subtle;
    }
  };

  const getStatusText = (status: ModalTest['status']) => {
    switch (status) {
      case 'cross-platform':
        return 'Cross-Platform';
      case 'web-only':
        return 'Web Only';
      case 'pending':
        return 'Pending';
    }
  };

  const renderModalCard = (modal: ModalTest) => (
    <TouchableOpacity
      key={modal.id}
      style={[
        {
          backgroundColor: theme.colors.bg.card,
          borderColor:
            modal.status === 'cross-platform'
              ? theme.colors.accent[500]
              : theme.colors.border.default,
          borderWidth: modal.status === 'cross-platform' ? 2 : 1,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          opacity: modal.status === 'pending' ? 0.7 : 1,
        },
      ]}
      onPress={modal.testAction}
      activeOpacity={0.7}
    >
      <FlexRow gap="md" align="start">
        <Icon
          name={modal.icon}
          size="lg"
          color={
            modal.status === 'cross-platform'
              ? theme.colors.accent[500]
              : theme.colors.text.subtle
          }
          style={{ marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <FlexRow gap="sm" align="center" style={{ marginBottom: 4 }}>
            <Text size="lg" weight="medium">
              {modal.title}
            </Text>
            <View
              style={{
                backgroundColor: `${getStatusColor(modal.status)}20`,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text
                size="xs"
                weight="semibold"
                color={getStatusColor(modal.status)}
              >
                {getStatusText(modal.status)}
              </Text>
            </View>
          </FlexRow>
          <Text size="sm" variant="subtle">
            {modal.description}
          </Text>
        </View>
      </FlexRow>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView
        contentContainerStyle={commonTestStyles.contentPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={commonTestStyles.header}>
          <FlexRow gap="md" align="center" style={{ marginBottom: 16 }}>
            <TouchableOpacity
              onPress={onGoBack}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: theme.colors.bg.card,
              }}
            >
              <Icon
                name="arrow-left"
                size="md"
                color={theme.colors.text.main}
              />
            </TouchableOpacity>
            <FlexColumn gap="xs" align="start" style={{ flex: 1 }}>
              <Text size="2xl" weight="bold">
                Modal Components
              </Text>
              <Text size="sm" variant="subtle">
                Test cross-platform modal behavior
              </Text>
            </FlexColumn>
          </FlexRow>
        </View>

        {/* Instructions Card */}
        <View
          style={{
            backgroundColor: theme.colors.bg.card,
            borderColor: theme.colors.info,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <FlexRow gap="sm" style={{ marginBottom: 12 }}>
            <Icon name="info-circle" size="md" color={theme.colors.info} />
            <Text size="lg" weight="medium" color={theme.colors.info}>
              Testing Instructions
            </Text>
          </FlexRow>
          <FlexColumn gap="sm">
            <Text size="sm" variant="main">
              • Modals appear as bottom sheets on mobile
            </Text>
            <Text size="sm" variant="main">
              • Try swiping down to close modals
            </Text>
            <Text size="sm" variant="main">
              • Test responsive behavior and animations
            </Text>
            <Text size="sm" variant="main">
              • Verify proper gesture handling
            </Text>
          </FlexColumn>
        </View>

        {/* Modal Tests */}
        <View>{modalTests.map(renderModalCard)}</View>
      </ScrollView>

      {/* Test Modals */}
      <TestLeaveSpaceModal
        spaceId={mockSpaceId}
        visible={leaveSpaceModalVisible}
        onClose={() => setLeaveSpaceModalVisible(false)}
      />
      <TestKickUserModal
        kickUserAddress={mockUserAddress}
        visible={kickUserModalVisible}
        onClose={() => setKickUserModalVisible(false)}
      />
    </SafeAreaView>
  );
};
