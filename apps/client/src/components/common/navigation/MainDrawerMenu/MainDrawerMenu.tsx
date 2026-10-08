import { Ionicons } from '@expo/vector-icons';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GuideDrawerId } from '../../../../guides/types';
import { useStoryMenuBadges } from '../../../../hooks/useStoryMenuBadges';
import { buildMainDrawerMenu } from '../../../../navigation/mainDrawerMenu';
import { nestedFocusOf, openMenuLeaf } from '../../../../navigation/openMenuLeaf';
import { useStoryStore } from '../../../../state/storyStore';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import { useTheme } from '../../../../theme';
import { useStoryVocabulary } from '../../../../vocabulary/useStoryVocabulary';
import GroupedDrawerMenu from '../GroupedDrawerMenu/GroupedDrawerMenu';

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
 * The story menu: the story's name, the arc picker, the search, then entries in groups that open and close
 * (each as it was left in this story), and the entries that are always there (settings, help, leaving the
 * story) at the bottom.
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
  const storyId = useStoryStore((current) => current.selectedStory?.id);
  const { route: focusedRoute, focus } = nestedFocusOf(state);
  const badges = useStoryMenuBadges(storyId, `${focusedRoute}:${focus.screen ?? ''}`);

  const menu = useMemo(
    () => buildMainDrawerMenu({ t: (key) => t(key), term, showLiteraryDevices }),
    [t, term, showLiteraryDevices],
  );

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
      }),
    [colors],
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

      <GroupedDrawerMenu
        state={state}
        navigation={navigation}
        drawerId={drawerId}
        top={menu.top}
        topVariant="search"
        groups={menu.groups}
        footer={menu.footer}
        badges={badges}
        storageKey={storyId ? `@keres/drawer-groups/${storyId}` : null}
      />
    </View>
  );
};

export default MainDrawerMenu;
