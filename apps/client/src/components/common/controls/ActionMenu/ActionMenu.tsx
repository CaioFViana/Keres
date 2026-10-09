import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** What cannot be undone, or ends something: drawn in the error color. */
  destructive?: boolean;
  onPress: () => void;
}

interface ActionMenuProps {
  items: readonly ActionMenuItem[];
  /** Names the "more" button; defaults to a generic label. */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A "more" button that opens a list of the actions a row has besides its main one, each with an icon
 * and a word: a row of bare icons asks the person to guess which is which.
 */
const ActionMenu: React.FC<ActionMenuProps> = ({ items, accessibilityLabel, testID }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? t('more_actions')}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.trigger, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable
            testID={testID ? `${testID}-backdrop` : undefined}
            accessibilityLabel={t('cancel')}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.shadow, opacity: 0.35 }]}
            onPress={() => setOpen(false)}
          />
          <View
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {items.map((item) => {
              const color = item.destructive ? colors.error : colors.text;
              return (
                <Pressable
                  key={item.id}
                  testID={testID ? `${testID}-${item.id}` : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => {
                    setOpen(false);
                    item.onPress();
                  }}
                  style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons name={item.icon} size={22} color={color} />
                  <Text style={[styles.label, { color }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  label: { fontSize: 16 },
});

export default ActionMenu;
