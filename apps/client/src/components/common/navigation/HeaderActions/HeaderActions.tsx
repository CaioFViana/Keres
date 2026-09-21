import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { useTheme } from '@/src/theme';

/**
 * The shared header-actions framework: list/detail screens declare their actions as data
 * and this renders them as header icons - no per-screen menu code.
 *
 * Contract per action: `visible: false` removes it from the row entirely; `disabled` dims
 * and blocks presses; `busy` swaps the icon for a spinner and also blocks presses;
 * `active` tints a toggle-style action with the primary color. On compact screens two or
 * more actions collapse into a burger menu (see below) so the title keeps its room.
 */
export interface HeaderAction {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  visible?: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** Toggle-style actions show their icon (and menu label) in the primary color when on. */
  active?: boolean;
}

export default function HeaderActions({ actions }: { actions: readonly HeaderAction[] }) {
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();
  const visible = actions.filter((action) => action.visible !== false);
  // Compact headers hold one icon at most: two or more collapse into a burger menu so the
  // title keeps its room. The breakpoint is dimension-driven, so rotation and window
  // resizing flip between the row and the menu with no extra wiring.
  if (isCompact && visible.length > 1) {
    return <HeaderOverflowMenu actions={visible} />;
  }
  return (
    <View style={styles.row}>
      {visible.map((action) => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{
            disabled: !!(action.disabled || action.busy),
            busy: !!action.busy,
          }}
          disabled={action.disabled || action.busy}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            { opacity: action.disabled ? 0.4 : pressed ? 0.6 : 1 },
          ]}
        >
          {action.busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Ionicons
              name={action.icon}
              size={24}
              color={action.active ? colors.primary : colors.text}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** The compact overflow: one burger opening a top-right dropdown of icon-plus-label rows. */
function HeaderOverflowMenu({ actions }: { actions: readonly HeaderAction[] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.row}>
      <Pressable
        testID="header-actions-menu"
        accessibilityRole="button"
        accessibilityLabel={t('header_actions_menu')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="menu" size={24} color={colors.text} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.menuOverlay}>
          <Pressable
            testID="header-actions-menu-backdrop"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {actions.map((action) => {
              const locked = !!(action.disabled || action.busy);
              return (
                <Pressable
                  key={action.id}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityState={{ disabled: locked, busy: !!action.busy }}
                  disabled={locked}
                  onPress={() => {
                    setOpen(false);
                    action.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { opacity: action.disabled ? 0.4 : pressed ? 0.6 : 1 },
                  ]}
                >
                  {action.busy ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={action.active ? colors.primary : colors.text}
                    />
                  )}
                  <Text
                    style={[
                      styles.menuItemLabel,
                      { color: action.active ? colors.primary : colors.text },
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginRight: 8, gap: 4 },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  menuOverlay: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menu: {
    minWidth: 220,
    marginTop: 8,
    marginRight: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemLabel: { flex: 1, fontSize: 16 },
});
