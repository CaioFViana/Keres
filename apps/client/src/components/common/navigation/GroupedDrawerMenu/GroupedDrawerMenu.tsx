import { Ionicons } from '@expo/vector-icons';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerItem } from '@react-navigation/drawer';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { drawerAnchorId } from '../../../../guides/anchorRegistry';
import type { GuideDrawerId } from '../../../../guides/types';
import {
  badgeNeedsAttention,
  isLeafActive,
  type MenuBadge,
  type MenuBadges,
  type MenuGroup,
  type MenuLeaf,
} from '../../../../navigation/drawerMenuModel';
import { nestedFocusOf, openMenuLeaf } from '../../../../navigation/openMenuLeaf';
import { useGuideAnchor } from '../../../../guides/useGuideAnchor';
import { useTheme } from '../../../../theme';
import { AnchoredDrawerRow } from '../ResizableDrawerContent/AnchoredDrawerItemList';
import { useDrawerGroupState } from './useDrawerGroupState';

interface GroupedDrawerMenuProps {
  state: DrawerContentComponentProps['state'];
  navigation: DrawerContentComponentProps['navigation'];
  drawerId: GuideDrawerId;
  /** Entries above the groups: how they look is `topVariant`. */
  top?: MenuLeaf[];
  topVariant?: 'search' | 'item';
  groups: MenuGroup[];
  /** Entries that are always there, below the groups. */
  footer?: MenuLeaf[];
  badges?: MenuBadges;
  /** Where the open/shut state of the groups is kept. Null: not kept. */
  storageKey: string | null;
}

/**
 * Entries in groups that open and close, with the entries that are always there below them. The group with
 * the screen on show is open; the rest are as they were left, across sessions. A group folded away still shows a dot while something inside it asks for attention.
 */
export const GroupedDrawerMenu: React.FC<GroupedDrawerMenuProps> = ({
  state,
  navigation,
  drawerId,
  top = [],
  topVariant = 'item',
  groups,
  footer = [],
  badges = {},
  storageKey,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { open: userOpen, setGroupOpen } = useDrawerGroupState(storageKey);
  const { route: focusedRoute, focus } = nestedFocusOf(state);

  const activeLeafOf = (leaves: MenuLeaf[]) =>
    leaves.find((leaf) => isLeafActive(leaf, focusedRoute, focus));
  const activeGroupId = groups.find((group) => activeLeafOf(group.leaves))?.id ?? null;
  // The group with the screen on show is open - the screen is never hidden - unless the person shuts it while
  // they are on that screen. Going to another group forgets that.
  const [shutActive, setShutActive] = useState(false);
  const [seenActiveGroup, setSeenActiveGroup] = useState(activeGroupId);
  if (activeGroupId !== seenActiveGroup) {
    setSeenActiveGroup(activeGroupId);
    setShutActive(false);
  }
  const isOpen = (group: MenuGroup) =>
    group.id === activeGroupId ? !shutActive : (userOpen[group.id] ?? group.defaultOpen);
  const toggle = (group: MenuGroup, open: boolean) => {
    if (group.id === activeGroupId) setShutActive(open);
    else setGroupOpen(group.id, !open);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        search: {
          alignItems: 'center',
          borderColor: colors.border,
          borderRadius: 8,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 8,
          marginBottom: 4,
          marginHorizontal: 12,
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
        searchFocused: { borderColor: colors.primary },
        searchLabel: { color: colors.textSecondary, flex: 1, fontSize: 14 },
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
        groupDot: {
          backgroundColor: colors.error,
          borderRadius: 4,
          height: 8,
          width: 8,
        },
        leaves: {
          borderLeftColor: colors.border,
          borderLeftWidth: StyleSheet.hairlineWidth,
          marginLeft: 24,
        },
        divider: {
          backgroundColor: colors.border,
          height: StyleSheet.hairlineWidth,
          marginHorizontal: 16,
          marginVertical: 10,
        },
        item: { marginVertical: 0 },
        itemRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
        itemLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
        badge: {
          alignItems: 'center',
          backgroundColor: colors.border,
          borderRadius: 9,
          justifyContent: 'center',
          minWidth: 18,
          paddingHorizontal: 6,
          paddingVertical: 1,
        },
        badgeAttention: { backgroundColor: colors.error },
        badgeText: { color: colors.text, fontSize: 11, fontWeight: '600' },
        badgeTextAttention: { color: colors.onPrimary },
        dot: { backgroundColor: colors.error, borderRadius: 4, height: 8, width: 8 },
      }),
    [colors],
  );

  const renderBadge = (leaf: MenuLeaf, badge: MenuBadge | undefined) => {
    if (!badge) return null;
    if (badge.kind === 'dot') {
      return <View style={styles.dot} testID={`drawer-badge-${leaf.id}`} />;
    }
    const attention = badge.kind === 'count' && badge.attention === true;
    return (
      <View
        style={[styles.badge, attention && styles.badgeAttention]}
        testID={`drawer-badge-${leaf.id}`}
      >
        <Text style={[styles.badgeText, attention && styles.badgeTextAttention]}>
          {badge.value}
        </Text>
      </View>
    );
  };

  const renderLeaf = (leaf: MenuLeaf, focused: boolean) => {
    const badge = badges[leaf.id];
    return (
      <AnchoredDrawerRow key={leaf.id} anchorId={drawerAnchorId(drawerId, leaf.id)}>
        <DrawerItem
          label={({ color }) => (
            <View style={styles.itemRow}>
              <Text style={[styles.itemLabel, { color }]} numberOfLines={1}>
                {leaf.label}
              </Text>
              {renderBadge(leaf, badge)}
            </View>
          )}
          accessibilityLabel={leaf.label}
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
  };

  const renderSearch = (leaf: MenuLeaf) => {
    const focused = isLeafActive(leaf, focusedRoute, focus);
    return (
      <AnchoredDrawerRow key={leaf.id} anchorId={drawerAnchorId(drawerId, leaf.id)}>
        <Pressable
          style={[styles.search, focused && styles.searchFocused]}
          testID={`drawer-item-${leaf.id}`}
          accessibilityRole="search"
          accessibilityLabel={leaf.label}
          onPress={() => openMenuLeaf(navigation, state, leaf)}
        >
          <Ionicons
            name={leaf.icon}
            size={18}
            color={focused ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.searchLabel} numberOfLines={1}>
            {leaf.label}
          </Text>
        </Pressable>
      </AnchoredDrawerRow>
    );
  };

  return (
    <View>
      {top.map((leaf) =>
        topVariant === 'search'
          ? renderSearch(leaf)
          : renderLeaf(leaf, isLeafActive(leaf, focusedRoute, focus)),
      )}

      {groups.map((group) => {
        const open = isOpen(group);
        const active = activeLeafOf(group.leaves);
        const needsAttention = group.leaves.some((leaf) => badgeNeedsAttention(badges[leaf.id]));
        return (
          <View key={group.id}>
            <GroupHeader
              group={group}
              open={open}
              marked={!open && needsAttention}
              anchorId={drawerAnchorId(drawerId, `group:${group.id}`)}
              label={t(group.labelKey)}
              styles={styles}
              iconColor={colors.textSecondary}
              onToggle={() => toggle(group, open)}
            />
            {open ? (
              <View style={styles.leaves}>
                {group.leaves.map((leaf) => renderLeaf(leaf, leaf === active))}
              </View>
            ) : null}
          </View>
        );
      })}

      {footer.length > 0 ? <View style={styles.divider} /> : null}
      {footer.map((leaf) => renderLeaf(leaf, isLeafActive(leaf, focusedRoute, focus)))}
    </View>
  );
};

const GroupHeader: React.FC<{
  group: MenuGroup;
  open: boolean;
  marked: boolean;
  anchorId: string;
  label: string;
  styles: Record<'group' | 'groupLabel' | 'groupCount' | 'groupDot', object>;
  iconColor: string;
  onToggle: () => void;
}> = ({ group, open, marked, anchorId, label, styles, iconColor, onToggle }) => {
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
        {marked ? <View style={styles.groupDot} testID={`drawer-group-dot-${group.id}`} /> : null}
        <Text style={styles.groupCount}>{group.leaves.length}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={iconColor} />
      </Pressable>
    </View>
  );
};

export default GroupedDrawerMenu;
