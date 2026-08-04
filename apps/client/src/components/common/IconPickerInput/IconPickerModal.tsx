import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

const ICON_CELL_SIZE = 56;

const IconPickerModal: React.FC<IconPickerModalProps> = ({ currentIcon, onSelectIcon, onClose, title }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    container: {
      width: ICON_CELL_SIZE * 4 + 40,
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
      margin: 4,
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
        numColumns={4}
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
