import { StyleSheet } from 'react-native';
import type { getColors } from '../../primitives/theme/colors';

type ColorPalette = ReturnType<typeof getColors>;

// Theme-aware styles factory
export const createIconPickerStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    iconButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface[3],
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyIconPlaceholder: {
      width: 20,
      height: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.surface[9], // More visible than border.default
      borderRadius: 10, // Half of width/height for perfect circle
    },
    dropdownContainer: {
      overflow: 'hidden',
      marginTop: 8,
      borderRadius: 8,
      backgroundColor: colors.bg.card,
      borderColor: colors.border.default,
    },
    headerContainer: {
      backgroundColor: colors.bg.card,
      padding: 12,
      position: 'relative',
    },
    clearButtonContainer: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 1,
    },
    colorRow: {
      gap: 12,
    },
    iconGridContainer: {
      padding: 8,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-around',
      paddingHorizontal: 4,
    },
    iconOption: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    selectedOption: {
      borderWidth: 2,
      borderColor: colors.accent.DEFAULT,
      backgroundColor: colors.surface['3'],
    },
    unselectedOption: {
      backgroundColor: colors.surface['2'],
      borderWidth: 1,
      borderColor: colors.border.default,
    },
  });