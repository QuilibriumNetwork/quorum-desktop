import React from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, useTheme, Text } from '../components/primitives';
import { commonTestStyles } from '../styles/commonTestStyles';

export const IconTestScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;

  return (
    <ScrollView
      style={[commonTestStyles.container, { backgroundColor: colors.surface[0] }]}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 20,
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Icon name="target" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
          <Text size="2xl" weight="bold" variant="strong">Icon</Text>
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Cross-platform icon system using FontAwesome with unified API
          </Text>
        </View>
      </View>

      {/* Basic Icons */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Basic Icons
          </Text>
        </View>

        <View style={commonTestStyles.iconGrid}>
          <View style={commonTestStyles.iconItem}>
            <Icon name="check" />
            <Text size="sm" variant="subtle">
              check
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="times" />
            <Text size="sm" variant="subtle">
              times
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="user" />
            <Text size="sm" variant="subtle">
              user
            </Text>
          </View>
        </View>
      </View>

      {/* Theme Icons */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Theme Icons
          </Text>
        </View>

        <View style={commonTestStyles.iconGrid}>
          <View style={commonTestStyles.iconItem}>
            <Icon name="sun" color={theme.colors.utilities.warning} />
            <Text size="xs" variant="subtle">
              sun
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="moon" color={theme.colors.accent[600]} />
            <Text size="xs" variant="subtle">
              moon
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="desktop" color={theme.colors.text.subtle} />
            <Text size="xs" variant="subtle">
              desktop
            </Text>
          </View>
        </View>
      </View>

      {/* Sizes */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Icon Sizes
          </Text>
        </View>

        <View style={commonTestStyles.sizeRow}>
          <View style={commonTestStyles.sizeItem}>
            <Icon name="heart" size="xs" />
            <Text size="xs" variant="subtle">
              xs (12px)
            </Text>
          </View>
          <View style={commonTestStyles.sizeItem}>
            <Icon name="heart" size="sm" />
            <Text size="xs" variant="subtle">
              sm (14px)
            </Text>
          </View>
          <View style={commonTestStyles.sizeItem}>
            <Icon name="heart" size="md" />
            <Text size="xs" variant="subtle">
              md (16px)
            </Text>
          </View>
          <View style={commonTestStyles.sizeItem}>
            <Icon name="heart" size="lg" />
            <Text size="xs" variant="subtle">
              lg (20px)
            </Text>
          </View>
          <View style={commonTestStyles.sizeItem}>
            <Icon name="heart" size="xl" />
            <Text size="xs" variant="subtle">
              xl (24px)
            </Text>
          </View>
          <View style={commonTestStyles.sizeItem}>
            <Icon name="heart" size={32} />
            <Text size="xs" variant="subtle">
              32px
            </Text>
          </View>
        </View>
      </View>

      {/* Actions & Communication */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Actions & Communication
          </Text>
        </View>

        <View style={commonTestStyles.iconGrid}>
          <View style={commonTestStyles.iconItem}>
            <Icon name="reply" color={theme.colors.utilities.success} />
            <Text size="xs" variant="subtle">
              reply
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="trash" color={theme.colors.utilities.danger} />
            <Text size="xs" variant="subtle">
              trash
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="link" color={theme.colors.accent[500]} />
            <Text size="xs" variant="subtle">
              link
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="bell" disabled />
            <Text size="xs" variant="subtle">
              bell (disabled)
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="envelope" />
            <Text size="xs" variant="subtle">
              envelope
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="clipboard" />
            <Text size="xs" variant="subtle">
              clipboard
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Navigation Icons
          </Text>
        </View>

        <View style={commonTestStyles.iconGrid}>
          <View style={commonTestStyles.iconItem}>
            <Icon name="chevron-left" />
            <Text size="xs" variant="subtle">
              chevron-left
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="chevron-right" />
            <Text size="xs" variant="subtle">
              chevron-right
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="arrow-up" />
            <Text size="xs" variant="subtle">
              arrow-up
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="arrow-down" />
            <Text size="xs" variant="subtle">
              arrow-down
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="home" />
            <Text size="xs" variant="subtle">
              home
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="menu" />
            <Text size="xs" variant="subtle">
              menu
            </Text>
          </View>
        </View>
      </View>

      {/* User & Social */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            User & Social Icons
          </Text>
        </View>

        <View style={commonTestStyles.iconGrid}>
          <View style={commonTestStyles.iconItem}>
            <Icon name="users" />
            <Text size="xs" variant="subtle">
              users
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="user-plus" />
            <Text size="xs" variant="subtle">
              user-plus
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="smile" />
            <Text size="xs" variant="subtle">
              smile
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="face-smile-beam" />
            <Text size="xs" variant="subtle">
              face-smile-beam
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="eye" />
            <Text size="xs" variant="subtle">
              eye
            </Text>
          </View>
          <View style={commonTestStyles.iconItem}>
            <Icon name="eye-slash" />
            <Text size="xs" variant="subtle">
              eye-slash
            </Text>
          </View>
        </View>
      </View>

      {/* Testing Notes */}
      <View style={[commonTestStyles.notesSection, { backgroundColor: colors.surface[3] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text size="base" weight="semibold" variant="strong">
            Mobile Icon Testing
          </Text>
        </View>
        <Text size="sm" variant="default">
          • Native: Uses react-native-vector-icons with FontAwesome font{'\n'}•
          Unified API: Same props work across web and mobile{'\n'}• Automatic
          theme integration with color system{'\n'}• 60+ icons mapped from
          comprehensive codebase audit{'\n'}• Touch-friendly sizing with
          semantic size options{'\n'}• Ready to replace placeholder characters
          in primitives{'\n'}• Perfect for ColorSwatch, RadioGroup, Modal,
          Tooltip close buttons
        </Text>
      </View>
    </ScrollView>
  );
};

// All styles now centralized in commonTestStyles
