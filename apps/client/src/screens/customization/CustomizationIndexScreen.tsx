import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { setDocumentTitle } from '@/src/utils/documentTitle';

/**
 * The four ways a story can be shaped beyond its own text.
 *
 * They were four separate drawer entries, which put unrelated day-to-day work (characters, scenes)
 * next to things a writer sets up once and rarely returns to. Grouping them costs one tap and buys
 * a drawer that reads as a list of places to write rather than a list of everything.
 *
 * The stat system keeps its own visibility rule, which simply moved here from the drawer: the
 * screens stay reachable when it is off, only the entry disappears.
 */

interface Entry {
  route: keyof CustomizationStackParamList;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descriptionKey: string;
  hidden?: boolean;
}

const CustomizationIndexScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const story = useStoryStore((state) => state.selectedStory);
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomizationStackParamList, 'CustomizationIndex'>>();

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('customization_title'),
        headerRight: undefined,
      });
      setDocumentTitle(t('customization_title'));
    }, [navigation, t]),
  );

  const entries: Entry[] = [
    {
      route: 'StoryCalendarList',
      icon: 'calendar-outline',
      titleKey: 'calendar_list_title',
      descriptionKey: 'customization_calendars_description',
    },
    {
      route: 'StorySchemaList',
      icon: 'construct-outline',
      titleKey: 'story_schema_management_title',
      descriptionKey: 'customization_schema_description',
    },
    {
      route: 'Suggestions',
      icon: 'bulb-outline',
      titleKey: 'standard_suggestions_title',
      descriptionKey: 'customization_suggestions_description',
    },
    {
      route: 'StatList',
      icon: 'stats-chart-outline',
      titleKey: 'stats_title',
      descriptionKey: 'customization_stats_description',
      hidden: !story?.statSystem,
    },
  ];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 14, paddingBottom: 40 },
        intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 10,
        },
        body: { flexGrow: 1, flexShrink: 1 },
        title: { fontSize: 16, fontWeight: '700', color: colors.text },
        description: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
      }),
    [colors],
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('customization_intro')}</Text>
        {entries
          .filter((entry) => !entry.hidden)
          .map((entry) => (
            <TouchableOpacity
              key={entry.route}
              style={styles.card}
              testID={`customization-${entry.route}`}
              onPress={() => navigation.navigate(entry.route as never)}
            >
              <Ionicons name={entry.icon} size={24} color={colors.primary} />
              <View style={styles.body}>
                <Text style={styles.title}>{t(entry.titleKey)}</Text>
                <Text style={styles.description}>{t(entry.descriptionKey)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
};

export default CustomizationIndexScreen;
