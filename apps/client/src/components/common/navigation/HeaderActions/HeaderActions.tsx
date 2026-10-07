import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  headerAnchorId,
  registerGuideAnchor,
  unregisterGuideAnchor,
} from '@/src/guides/anchorRegistry';
import { measureGuideNode, useGuideAnchor } from '@/src/guides/useGuideAnchor';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { useSystemInsets } from '@/src/hooks/useSystemInsets';
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
  /** A dot on the icon: something new is behind this action. The burger shows it too while it hides this one. */
  badge?: boolean;
}

/** The dot of an action's `badge`. */
function BadgeDot({ testID }: { testID: string }) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.background }]}
    />
  );
}

/** The icon, wrapped with its dot only when there is one: an unbadged action keeps the bare icon. */
function withBadge(icon: React.ReactElement, badge: boolean | undefined, testID: string) {
  if (!badge) return icon;
  return (
    <View>
      {icon}
      <BadgeDot testID={testID} />
    </View>
  );
}

/** Makes one header action a tour target, by its icon. */
function AnchoredAction({ icon, children }: { icon: string; children: React.ReactNode }) {
  const anchorRef = useGuideAnchor(headerAnchorId(icon));
  return (
    <View ref={anchorRef} collapsable={false}>
      {children}
    </View>
  );
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
        <AnchoredAction key={action.id} icon={action.icon}>
          <Pressable
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
              withBadge(
                <Ionicons
                  name={action.icon}
                  size={24}
                  color={action.active ? colors.primary : colors.text}
                />,
                action.badge,
                `header-action-badge-${action.id}`,
              )
            )}
          </Pressable>
        </AnchoredAction>
      ))}
    </View>
  );
}

/** The compact overflow: one burger opening a top-right dropdown of icon-plus-label rows. */
function HeaderOverflowMenu({ actions }: { actions: readonly HeaderAction[] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSystemInsets();
  const [open, setOpen] = useState(false);
  // Every action hides behind the one burger, so a tour pointing at one points at the burger.
  const burgerRef = useRef<View>(null);
  const icons = actions.map((action) => action.icon).join('|');
  useEffect(() => {
    const ids = icons.split('|').map(headerAnchorId);
    for (const id of ids) registerGuideAnchor(id, () => measureGuideNode(burgerRef.current));
    return () => ids.forEach(unregisterGuideAnchor);
  }, [icons]);
  return (
    <View style={styles.row}>
      <Pressable
        ref={burgerRef}
        collapsable={false}
        testID="header-actions-menu"
        accessibilityRole="button"
        accessibilityLabel={t('header_actions_menu')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
      >
        {withBadge(
          <Ionicons name="menu" size={24} color={colors.text} />,
          actions.some((action) => action.badge),
          'header-actions-menu-badge',
        )}
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
            testID="header-actions-menu-panel"
            // The modal's window is under the (translucent) status bar: the first row starts below it.
            style={[
              styles.menu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginTop: insets.top + 8,
              },
            ]}
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
                    withBadge(
                      <Ionicons
                        name={action.icon}
                        size={22}
                        color={action.active ? colors.primary : colors.text}
                      />,
                      action.badge,
                      `header-menu-badge-${action.id}`,
                    )
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
  badge: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
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
