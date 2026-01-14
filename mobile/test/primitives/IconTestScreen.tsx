import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, useTheme, Text, Paragraph, Title } from '@/components/primitives';
import { Flex } from '@/components/primitives';
import { commonTestStyles } from '@/styles/commonTestStyles';

export const IconTestScreen: React.FC = () => {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <Flex direction="column" style={commonTestStyles.header}>
          <Flex gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="target" size="xl" style={{ marginTop: 2 }} />
            <Title>Icon</Title>
          </Flex>
          <Paragraph align="center">
            Cross-platform icon system using FontAwesome with unified API
          </Paragraph>
        </Flex>

        {/* Basic Icons */}
        <Flex direction="column" style={commonTestStyles.sectionSimple}>
          <Title size="sm">Basic Icons</Title>

          <Flex wrap gap="md" style={commonTestStyles.iconGrid}>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="check" />
              <Text size="sm" variant="subtle">
                check
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="close" />
              <Text size="sm" variant="subtle">
                close
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="user" />
              <Text size="sm" variant="subtle">
                user
              </Text>
            </Flex>
          </Flex>
        </Flex>

        {/* Theme Icons */}
        <Flex direction="column" style={commonTestStyles.sectionSimple}>
          <Title size="sm">Theme Icons</Title>

          <Flex wrap gap="md" style={commonTestStyles.iconGrid}>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="sun" color={theme.colors.utilities.warning} />
              <Text size="xs" variant="subtle">
                sun
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="moon" color={theme.colors.accent[600]} />
              <Text size="xs" variant="subtle">
                moon
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="desktop" color={theme.colors.text.subtle} />
              <Text size="xs" variant="subtle">
                desktop
              </Text>
            </Flex>
          </Flex>
        </Flex>

        {/* Sizes */}
        <Flex direction="column" style={commonTestStyles.sectionSimple}>
          <Title size="sm">Icon Sizes</Title>

          <Flex
            wrap
            justify="between"
            align="center"
            style={commonTestStyles.sizeRow}
          >
            <Flex direction="column" align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="xs" />
              <Text size="xs" variant="subtle">
                xs (12px)
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="sm" />
              <Text size="xs" variant="subtle">
                sm (14px)
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="md" />
              <Text size="xs" variant="subtle">
                md (16px)
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="lg" />
              <Text size="xs" variant="subtle">
                lg (20px)
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="xl" />
              <Text size="xs" variant="subtle">
                xl (24px)
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size={32} />
              <Text size="xs" variant="subtle">
                32px
              </Text>
            </Flex>
          </Flex>
        </Flex>

        {/* Actions & Communication */}
        <Flex direction="column" style={commonTestStyles.sectionSimple}>
          <Title size="sm">Actions & Communication</Title>

          <Flex wrap gap="md" style={commonTestStyles.iconGrid}>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="reply" color={theme.colors.utilities.success} />
              <Text size="xs" variant="subtle">
                reply
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="trash" color={theme.colors.utilities.danger} />
              <Text size="xs" variant="subtle">
                trash
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="link" color={theme.colors.accent[500]} />
              <Text size="xs" variant="subtle">
                link
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="bell" disabled />
              <Text size="xs" variant="subtle">
                bell (disabled)
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="envelope" />
              <Text size="xs" variant="subtle">
                envelope
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="clipboard" />
              <Text size="xs" variant="subtle">
                clipboard
              </Text>
            </Flex>
          </Flex>
        </Flex>

        {/* Navigation */}
        <Flex direction="column" style={commonTestStyles.sectionSimple}>
          <Title size="sm">Navigation Icons</Title>

          <Flex wrap gap="md" style={commonTestStyles.iconGrid}>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="chevron-left" />
              <Text size="xs" variant="subtle">
                chevron-left
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="chevron-right" />
              <Text size="xs" variant="subtle">
                chevron-right
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="arrow-up" />
              <Text size="xs" variant="subtle">
                arrow-up
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="arrow-down" />
              <Text size="xs" variant="subtle">
                arrow-down
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="home" />
              <Text size="xs" variant="subtle">
                home
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="menu" />
              <Text size="xs" variant="subtle">
                menu
              </Text>
            </Flex>
          </Flex>
        </Flex>

        {/* User & Social */}
        <Flex direction="column" style={commonTestStyles.sectionSimple}>
          <Title size="sm">User & Social Icons</Title>

          <Flex wrap gap="md" style={commonTestStyles.iconGrid}>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="users" />
              <Text size="xs" variant="subtle">
                users
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="user-plus" />
              <Text size="xs" variant="subtle">
                user-plus
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="smile" />
              <Text size="xs" variant="subtle">
                smile
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="mood-happy" />
              <Text size="xs" variant="subtle">
                mood-happy
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="eye" />
              <Text size="xs" variant="subtle">
                eye
              </Text>
            </Flex>
            <Flex direction="column" align="center" style={commonTestStyles.iconItem}>
              <Icon name="eye-off" />
              <Text size="xs" variant="subtle">
                eye-slash
              </Text>
            </Flex>
          </Flex>
        </Flex>

        {/* Testing Notes */}
        <View
          style={[
            commonTestStyles.notesSection,
            { backgroundColor: colors.surface[3] },
          ]}
        >
          <Text size="base" weight="semibold" variant="strong">
            Mobile Icon Testing
          </Text>

          <Flex direction="column" gap="xs">
            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Native: Uses react-native-vector-icons with FontAwesome font
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Unified API: Same props work across web and mobile
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Automatic theme integration with color system
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  60+ icons mapped from comprehensive codebase audit
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Touch-friendly sizing with semantic size options
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Ready to replace placeholder characters in primitives
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Perfect for ColorSwatch, RadioGroup, Modal, Tooltip close
                  buttons
                </Text>
              </View>
            </Flex>
          </Flex>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
