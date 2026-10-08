import { Ionicons } from '@expo/vector-icons';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerItem } from '@react-navigation/drawer';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { drawerAnchorId } from '../../../../guides/anchorRegistry';
import type { GuideDrawerId } from '../../../../guides/types';
import {
  buildMainDrawerMenu,
  isLeafActive,
  type MenuGroup,
  type MenuGroupId,
  type MenuLeaf,
} from '../../../../navigation/mainDrawerMenu';
import { nestedFocusOf, openMenuLeaf } from '../../../../navigation/openMenuLeaf';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import { useTheme } from '../../../../theme';
import { useStoryVocabulary } from '../../../../vocabulary/useStoryVocabulary';
import { useGuideAnchor } from '../../../../guides/useGuideAnchor';
import { AnchoredDrawerRow } from '../ResizableDrawerContent/AnchoredDrawerItemList';

interface MainDrawerMenuProps {
  state: DrawerContentComponentProps['state'];
  navigation: DrawerContentComponentProps['navigation'];
  drawerId: GuideDrawerId;
  /** The story on screen, shown at the top of the menu. */
  story?: { title: string; typeLabel: string } | null;
  /** The arc the story is looked at through, when there is more than one to pick from. */
  arcLabel?: string;
}

/**
 * The story menu: the story's name, the arc picker, then entries in groups that open and close, and the
 * entries that are always there (settings, help, leaving the story) at the bottom. The group with the screen
 * on show is open; the rest keep the state they were left in during this session.
 */
export const MainDrawerMenu: React.FC<MainDrawerMenuProps> = ({
  state,
  navigation,
  drawerId,
  story,
  arcLabel,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { term } = useStoryVocabulary();
  const showLiteraryDevices = useUserSettingsStore((settings) => settings.suggestLiteraryDevices);
  const [userOpen, setUserOpen] = useState<Partial<Record<MenuGroupId, boolean>>>({});

  const menu = useMemo(
    () => buildMainDrawerMenu({ t: (key) => t(key), term, showLiteraryDevices }),
    [t, term, showLiteraryDevices],
  );
  const { route: focusedRoute, focus } = nestedFocusOf(state);

  const activeLeafOf = (leaves: MenuLeaf[]) =>
    leaves.find((leaf) => isLeafActive(leaf, focusedRoute, focus));
  const isOpen = (group: MenuGroup) =>
    userOpen[group.id] ?? (group.defaultOpen || activeLeafOf(group.leaves) !== undefined);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 },
        title: { color: colors.text, fontSize: 17, fontWeight: '700' },
        subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
        arcRow: {
          alignItems: 'center',
          borderColor: colors.border,
          borderRadius: 8,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 8,
          marginHorizontal: 12,
          marginBottom: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
        arcLabel: { color: colors.text, flex: 1, fontSize: 14 },
        group: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: 10,
          paddingBottom: 6,
          paddingHorizontal: 16,
          paddingTop: 16,
        },
        groupLabel: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '600' },
        groupCount: { color: colors.textSecondary, fontSize: 12 },
        leaves: {
          borderLeftColor: colors.border,
          borderLeftWidth: StyleSheet.hairlineWidth,
          marginLeft: 26,
        },
        divider: {
          backgroundColor: colors.border,
          height: StyleSheet.hairlineWidth,
          marginHorizontal: 16,
          marginVertical: 10,
        },
        item: { marginVertical: 0 },
      }),
    [colors],
  );

  const renderLeaf = (leaf: MenuLeaf, focused: boolean) => (
    <AnchoredDrawerRow key={leaf.id} anchorId={drawerAnchorId(drawerId, leaf.id)}>
      <DrawerItem
        label={leaf.label}
        icon={({ color, size }) => <Ionicons name={leaf.icon} color={color} size={size} />}
        focused={focused}
        activeTintColor={colors.primary}
        inactiveTintColor={colors.text}
        style={styles.item}
        testID={`drawer-item-${leaf.id}`}
        onPress={() => openMenuLeaf(navigation, state, leaf)}
      />
    </AnchoredDrawerRow>
  );

  return (
    <View>
      {story ? (
        <View style={styles.header} testID="drawer-story-header">
          <Text style={styles.title} numberOfLines={2}>
            {story.title}
          </Text>
          <Text style={styles.subtitle}>{story.typeLabel}</Text>
        </View>
      ) : null}
      {arcLabel ? (
        <Pressable
          style={styles.arcRow}
          testID="drawer-arc-picker"
          accessibilityRole="button"
          onPress={() =>
            openMenuLeaf(navigation, state, {
              id: 'ArcContext',
              route: 'ArcContext',
              label: arcLabel,
              icon: 'library-outline',
            })
          }
        >
          <Ionicons name="library-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.arcLabel} numberOfLines={1}>
            {arcLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      {menu.groups.map((group) => {
        const open = isOpen(group);
        const active = activeLeafOf(group.leaves);
        return (
          <View key={group.id}>
            <GroupHeader
              group={group}
              open={open}
              anchorId={drawerAnchorId(drawerId, `group:${group.id}`)}
              label={t(group.labelKey)}
              styles={styles}
              iconColor={colors.textSecondary}
              chevronColor={colors.textSecondary}
              onToggle={() => setUserOpen((current) => ({ ...current, [group.id]: !open }))}
            />
            {open ? (
              <View style={styles.leaves}>
                {group.leaves.map((leaf) => renderLeaf(leaf, leaf === active))}
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.divider} />
      {menu.footer.map((leaf) =>
        renderLeaf(leaf, leaf.route === focusedRoute && (leaf.active?.(focus) ?? true)),
      )}
    </View>
  );
};

const GroupHeader: React.FC<{
  group: MenuGroup;
  open: boolean;
  anchorId: string;
  label: string;
  styles: Record<'group' | 'groupLabel' | 'groupCount', object>;
  iconColor: string;
  chevronColor: string;
  onToggle: () => void;
}> = ({ group, open, anchorId, label, styles, iconColor, chevronColor, onToggle }) => {
  const anchorRef = useGuideAnchor(anchorId);
  return (
    <View ref={anchorRef} collapsable={false}>
      <Pressable
        style={styles.group}
        testID={`drawer-group-${group.id}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
      >
        <Ionicons name={group.icon} size={18} color={iconColor} />
        <Text style={styles.groupLabel}>{label}</Text>
        <Text style={styles.groupCount}>{group.leaves.length}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={chevronColor} />
      </Pressable>
    </View>
  );
};

export default MainDrawerMenu;
