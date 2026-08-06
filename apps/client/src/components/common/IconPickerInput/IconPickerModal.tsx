import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import Button from '../Button/Button';

/**
 * Conjunto pequeno e escolhido a dedo, não uma busca entre milhares de ícones - o pedido foi
 * um sistema "simples e leve", e o app já usa só Ionicons em todo o resto (ver Avatar.tsx).
 */
export const AVATAR_ICON_OPTIONS: (keyof typeof Ionicons.glyphMap)[] = [
  'person', 'happy', 'skull', 'paw', 'leaf', 'flame',
  'star', 'shield', 'book', 'telescope', 'planet', 'moon',
  'sunny', 'rose', 'diamond', 'flash', 'rocket', 'sparkles',
  'heart', 'game-controller', 'color-wand', 'compass', 'key', 'trophy',
  'flower', 'eye', 'glasses', 'water',
];

interface IconPickerModalProps {
  currentIcon: string | null;
  onSelectIcon: (icon: string) => void;
  onClose: () => void;
  title?: string;
}

const NUM_COLUMNS = 4;
const CELL_MARGIN = 4;

/**
 * Sized from the screen width (same 70% factor `ColorPickerModal` uses for its own grid) instead
 * of a fixed pixel count - a fixed `ICON_CELL_SIZE * 4 + 40` container used to overflow the
 * modal's available width on narrow phones (the outer `modalView` alone eats ~110dp of
 * margin/padding), clipping the last column of icons.
 */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Same cap as ColorPickerModal, for the same reason: uncapped, this rendered at 70% of the
// whole desktop window on web/Electron instead of 70% of a phone screen. No-op on real phones.
const ICON_GRID_SIZE = Math.min(SCREEN_WIDTH * 0.7, 320);
const ICON_CELL_SIZE = ICON_GRID_SIZE / NUM_COLUMNS - CELL_MARGIN * 2;

const IconPickerModal: React.FC<IconPickerModalProps> = ({ currentIcon, onSelectIcon, onClose, title }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    container: {
      width: ICON_GRID_SIZE + 40,
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
      width: ICON_CELL_SIZE,
      height: ICON_CELL_SIZE,
      margin: CELL_MARGIN,
      borderRadius: ICON_CELL_SIZE / 2,
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
  });

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <FlatList
        data={AVATAR_ICON_OPTIONS}
        keyExtractor={(item) => item}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.cell, item === currentIcon && styles.cellSelected]}
            onPress={() => onSelectIcon(item)}
          >
            <Ionicons name={item} size={26} color={colors.text} />
          </TouchableOpacity>
        )}
      />
      <View style={styles.buttonWrapper}>
        <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>{t('cancel')}</Button>
      </View>
    </View>
  );
};

export default IconPickerModal;
