import React, { useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  FlexRow,
  Text,
  Title,
  Paragraph,
  Button,
  Icon,
  Modal,
  Input,
} from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { commonTestStyles, createThemedStyles } from '@/styles/commonTestStyles';
import { IconPicker } from '@/components/space/IconPicker/IconPicker.native';
import type { IconName } from '@/primitives/Icon/types';
import type { IconColor } from '@/components/space/IconPicker/types';

export const IconPickerTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  // Modal state
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Form state for Channel Editor simulation
  const [channelName, setChannelName] = useState('general');
  const [channelTopic, setChannelTopic] = useState('General discussion for the team');
  const [channelIcon, setChannelIcon] = useState<IconName | null>('hashtag');
  const [channelIconColor, setChannelIconColor] = useState<IconColor>('blue');

  // Form state for Group Editor simulation
  const [groupName, setGroupName] = useState('Development');
  const [groupIcon, setGroupIcon] = useState<IconName | null>('code');
  const [groupIconColor, setGroupIconColor] = useState<IconColor>('purple');

  const handleChannelIconSelect = (icon: IconName | null, color: IconColor) => {
    setChannelIcon(icon);
    setChannelIconColor(color);
    console.log('Channel icon selected:', { icon, color });
  };

  const handleGroupIconSelect = (icon: IconName | null, color: IconColor) => {
    setGroupIcon(icon);
    setGroupIconColor(color);
    console.log('Group icon selected:', { icon, color });
  };

  const handleChannelSave = () => {
    Alert.alert(
      'Channel Saved',
      `Name: ${channelName}\nTopic: ${channelTopic}\nIcon: ${channelIcon || 'none'} (${channelIconColor})`,
      [{ text: 'OK' }]
    );
    setIsChannelModalOpen(false);
  };

  const handleGroupSave = () => {
    Alert.alert(
      'Group Saved',
      `Name: ${groupName}\nIcon: ${groupIcon || 'none'} (${groupIconColor})`,
      [{ text: 'OK' }]
    );
    setIsGroupModalOpen(false);
  };

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
        <View style={commonTestStyles.header}>
          <FlexColumn gap="xs" align="center">
            <Title size="lg" align="center">
              IconPicker Component Test
            </Title>
            <Paragraph variant="subtle" align="center">
              Test icon selection for channels and groups
            </Paragraph>
            <FlexRow gap="md">
              <Text size="sm" variant="muted">
                Channel: {channelIcon || 'hashtag'} ({channelIconColor})
              </Text>
              <Text size="sm" variant="muted">
                Group: {groupIcon || 'none'} ({groupIconColor})
              </Text>
            </FlexRow>
          </FlexColumn>
        </View>

        <FlexColumn gap="lg">
          {/* Modal Test Controls */}
          <View style={themedStyles.section}>
            <Title size="md" style={{ marginBottom: 12 }}>
              Bottom Sheet Modals
            </Title>

            <FlexColumn gap="md">
              <Button
                type="primary"
                iconName="hashtag"
                onClick={() => {
                  console.log('Opening Channel Modal...');
                  setIsChannelModalOpen(true);
                }}
                hapticFeedback={true}
              >
                Edit Channel (requires icon)
              </Button>

              <Button
                type="secondary"
                iconName="users"
                onClick={() => {
                  console.log('Opening Group Modal...');
                  setIsGroupModalOpen(true);
                }}
                hapticFeedback={true}
              >
                Edit Group (optional icon)
              </Button>
            </FlexColumn>
          </View>

          {/* Current State Display */}
          <View style={themedStyles.section}>
            <Title size="md" style={{ marginBottom: 12 }}>
              Current Selections
            </Title>

            <FlexColumn gap="md">
              <FlexRow gap="sm" align="center">
                <Text variant="semibold" style={{ minWidth: 70 }}>Channel:</Text>
                {channelIcon ? (
                  <FlexRow gap="xs" align="center">
                    <Icon name={channelIcon} size="sm" style={{ color: theme.colors.accent.DEFAULT }} />
                    <Text size="sm">{channelIcon} · {channelIconColor}</Text>
                  </FlexRow>
                ) : (
                  <Text size="sm" variant="subtle">Default hashtag</Text>
                )}
              </FlexRow>

              <FlexRow gap="sm" align="center">
                <Text variant="semibold" style={{ minWidth: 70 }}>Group:</Text>
                {groupIcon ? (
                  <FlexRow gap="xs" align="center">
                    <Icon name={groupIcon} size="sm" style={{ color: theme.colors.accent.DEFAULT }} />
                    <Text size="sm">{groupIcon} · {groupIconColor}</Text>
                  </FlexRow>
                ) : (
                  <Text size="sm" variant="subtle">No icon selected</Text>
                )}
              </FlexRow>

              <Button
                type="secondary"
                size="sm"
                onClick={() => {
                  setChannelIcon('hashtag');
                  setChannelIconColor('default');
                  setGroupIcon(null);
                  setGroupIconColor('default');
                }}
                hapticFeedback={true}
                style={{ marginTop: 8 }}
              >
                Reset All Selections
              </Button>
            </FlexColumn>
          </View>

          {/* Implementation Notes */}
          <View style={themedStyles.section}>
            <Title size="md" style={{ marginBottom: 8 }}>
              Implementation Notes
            </Title>

            <FlexColumn gap="xs">
              <Text size="sm" variant="subtle">
                • Uses shared primitives for cross-platform consistency
              </Text>
              <Text size="sm" variant="subtle">
                • Icons organized by usage tiers (common → specialized)
              </Text>
              <Text size="sm" variant="subtle">
                • Real-time color preview with 7 accent colors
              </Text>
              <Text size="sm" variant="subtle">
                • Context-aware Clear button (hashtag vs null)
              </Text>
              <Text size="sm" variant="subtle">
                • Optimized for mobile bottom sheet interactions
              </Text>
            </FlexColumn>
          </View>
        </FlexColumn>
      </ScrollView>

      {/* Channel Editor Modal */}
      <Modal
        visible={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        title="Edit Channel"
        size="large"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <FlexColumn style={{ gap: 16 }}>
            {/* Channel Name Input */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Channel Name</Text>
              <Input
                value={channelName}
                onChange={setChannelName}
                placeholder="Enter channel name"
              />
            </View>

            {/* Channel Topic Input */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Channel Topic</Text>
              <Input
                value={channelTopic}
                onChange={setChannelTopic}
                placeholder="Enter channel topic"
                multiline
              />
            </View>

            {/* Channel Icon Section */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Channel Icon</Text>
              <IconPicker
                selectedIcon={channelIcon || undefined}
                selectedIconColor={channelIconColor}
                onIconSelect={handleChannelIconSelect}
                testID="channel-icon-picker"
                defaultIcon="hashtag"
              />
            </View>

            {/* Action Buttons */}
            <FlexRow style={{ gap: 12, marginTop: 20 }}>
              <Button
                type="secondary"
                onClick={() => setIsChannelModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleChannelSave}
                style={{ flex: 1 }}
              >
                Save Channel
              </Button>
            </FlexRow>
          </FlexColumn>
        </ScrollView>
      </Modal>

      {/* Group Editor Modal */}
      <Modal
        visible={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Edit Group"
        size="large"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <FlexColumn style={{ gap: 16 }}>
            {/* Group Name Input */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Group Name</Text>
              <Input
                value={groupName}
                onChange={setGroupName}
                placeholder="Enter group name"
              />
            </View>

            {/* Group Icon Section */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Group Icon (optional)</Text>
              <IconPicker
                selectedIcon={groupIcon || undefined}
                selectedIconColor={groupIconColor}
                onIconSelect={handleGroupIconSelect}
                testID="group-icon-picker"
              />
            </View>

            {/* Action Buttons */}
            <FlexRow style={{ gap: 12, marginTop: 20 }}>
              <Button
                type="secondary"
                onClick={() => setIsGroupModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleGroupSave}
                style={{ flex: 1 }}
              >
                Save Group
              </Button>
            </FlexRow>
          </FlexColumn>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
};