import { AVATAR_ICON_OPTIONS as SHARED_AVATAR_ICON_OPTIONS } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../../theme';
import Button from '@/src/components/common/controls/Button/Button';

/**
 * A lista mora em `@keres/shared` porque o site público desenha o mesmo avatar - ver
 * `metadata/avatar.ts`. Reexportada aqui para os imports existentes continuarem válidos, e
 * tipada como glifo do Ionicons, que é o que este app precisa.
 */
export const AVATAR_ICON_OPTIONS =
  SHARED_AVATAR_ICON_OPTIONS as readonly (keyof typeof Ionicons.glyphMap)[];

interface IconPickerModalProps {
  currentIcon: string | null;
  onSelectIcon: (icon: string) => void;
  onClose: () => void;
  title?: string;
}

const CELL_MARGIN = 4;

/**
 * The grid changes both its size and column count with the available window. Mobile keeps four
 * columns for comfortable touch targets; wider windows use five or six columns so the picker
 * does not remain a narrow phone-sized strip in the middle of a desktop modal.
 */
const IconPickerModal: React.FC<IconPickerModalProps> = ({
  currentIcon,
  onSelectIcon,
  onClose,
  title,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { breakpoint } = useResponsiveLayout();
  const numColumns = breakpoint === 'wide' ? 6 : breakpoint === 'medium' ? 5 : 4;
  const iconGridSize =
    breakpoint === 'wide'
      ? Math.min(Math.max(screenWidth * 0.42, 360), 520)
      : breakpoint === 'medium'
        ? Math.min(Math.max(screenWidth * 0.5, 320), 420)
        : Math.min(screenWidth * 0.7, 320);
  const iconCellSize = iconGridSize / numColumns - CELL_MARGIN * 2;
  const iconSize = breakpoint === 'wide' ? 32 : breakpoint === 'medium' ? 29 : 26;

  const styles = StyleSheet.create({
    container: {
      width: iconGridSize + 40,
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
      textAlign: 'center',
    },
    grid: {
      justifyContent: 'center',
    },
    cell: {
      width: iconCellSize,
      height: iconCellSize,
      margin: CELL_MARGIN,
      borderRadius: iconCellSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
    },
    cellSelected: {
      borderColor: colors.primary,
    },
    buttonWrapper: {
      marginTop: 20,
      width: '60%',
    },
    iconList: {
      maxHeight: Math.max(220, screenHeight * 0.62),
    },
  });

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <FlatList
        key={`icon-grid-${numColumns}`}
        data={AVATAR_ICON_OPTIONS}
        keyExtractor={(item) => item}
        numColumns={numColumns}
        style={styles.iconList}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.cell, item === currentIcon && styles.cellSelected]}
            onPress={() => onSelectIcon(item)}
          >
            <Ionicons name={item} size={iconSize} color={colors.text} />
          </TouchableOpacity>
        )}
      />
      <View style={styles.buttonWrapper}>
        <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>
          {t('cancel')}
        </Button>
      </View>
    </View>
  );
};

export default IconPickerModal;
