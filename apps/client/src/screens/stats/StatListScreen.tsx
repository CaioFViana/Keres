import { Ionicons } from '@expo/vector-icons';
import { MAX_PRIMARY_STATS } from '@keres/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ReorderModal from '../../components/common/modals/ReorderModal/ReorderModal';
import { useDrizzle } from '../../db';
import type { StatSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryStats } from '../../hooks/useStoryStats';
import type { StatsStackParamList } from '../../navigation/StatsStack';
import { createStatService } from '../../services/storymanagement/StatService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';
import { formatStatValue, type StatNotation } from '@keres/shared/graphs/statLadder';

type StatListNavigationProp = NativeStackNavigationProp<StatsStackParamList, 'StatList'>;

/** A raiz do menu "Status": os eixos cadastrados, e os atalhos para escada, comparação e ranking. */
const StatListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  useDocumentTitle(t('stats_title'));
  const { colors } = useTheme();
  const navigation = useNavigation<StatListNavigationProp>();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const notation = (selectedStory?.statNotation ?? 'letter') as StatNotation;
  const { canEdit } = useStoryRole(storyId);
  const data = useStoryStats(storyId);
  const [reordering, setReordering] = useState(false);

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        title: { fontSize: 24, fontWeight: 'bold', color: colors.text },
        headerActions: { flexDirection: 'row', alignItems: 'center' },
        actionButton: { padding: 8, marginLeft: 4 },
        sectionLabel: {
          color: colors.textSecondary,
          fontSize: 12,
          marginTop: 14,
          marginBottom: 6,
          textTransform: 'uppercase',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
        },
        name: { fontSize: 16, fontWeight: 'bold', color: colors.text },
        meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 30 },
      }),
    [colors],
  );

  const handleDelete = useCallback(
    (stat: StatSelect) => {
      AppAlert.alert(
        t('stat_delete_title'),
        t('stat_delete_message', { name: stat.name }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              if (!userId) return;
              try {
                await createStatService(drizzleDb).deleteStat(userId, stat.id);
              } catch (error) {
                console.error('Failed to delete stat:', error);
                AppAlert.alert(t('error'), t('stat_save_failed'));
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [drizzleDb, t, userId],
  );

  const handleReorder = useCallback(
    async (newOrder: { id: string; order: number }[]) => {
      if (!userId || !storyId) return;
      try {
        await createStatService(drizzleDb).reorderStats(userId, storyId, newOrder);
        setReordering(false);
      } catch (error) {
        console.error('Failed to reorder stats:', error);
        AppAlert.alert(t('error'), t('stat_save_failed'));
      }
    },
    [drizzleDb, storyId, t, userId],
  );

  const handleCreate = useCallback(() => {
    const primaries = data.stats.filter((stat) => stat.isPrimary).length;
    if (primaries >= MAX_PRIMARY_STATS) {
      // Avisar antes de abrir o formulário poupa preencher tudo para ser recusado no save.
      AppAlert.alert(t('error'), t('stat_limit_reached', { count: MAX_PRIMARY_STATS }));
    }
    navigation.navigate('StatForm', {});
  }, [data.stats, navigation, t]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('stats_title'),
        headerRight: canEdit
          ? () => (
              <View style={{ flexDirection: 'row', marginRight: 15, gap: 15 }}>
                <TouchableOpacity onPress={handleCreate} accessibilityLabel={t('add')}>
                  <Ionicons name="add" size={30} color={colors.text} />
                </TouchableOpacity>
              </View>
            )
          : undefined,
      });
    }, [canEdit, colors.text, handleCreate, navigation, t]),
  );

  if (!storyId) {
    return (
      <View
        style={[
          commonContainerStyles.container,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Text style={{ color: colors.error }}>{t('no_story_selected')}</Text>
      </View>
    );
  }

  const sections = [
    { key: 'primary', label: t('stat_primary_section'), rows: data.primaryStats },
    {
      key: 'secondary',
      label: t('stat_secondary_section'),
      rows: data.stats.filter((stat) => !stat.isPrimary),
    },
  ].filter((section) => section.rows.length > 0);

  return (
    <View style={commonContainerStyles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('stats_title')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityLabel={t('stat_ranking_title')}
            style={styles.actionButton}
            onPress={() => navigation.navigate('StatRanking', {})}
          >
            <Ionicons name="podium-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={t('stat_compare_title')}
            style={styles.actionButton}
            onPress={() => navigation.navigate('StatComparison', {})}
          >
            <Ionicons name="stats-chart-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={t('stat_ladder_default_title')}
            style={styles.actionButton}
            onPress={() => navigation.navigate('StatLadder', {})}
          >
            <Ionicons name="layers-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          {canEdit && data.stats.length > 1 ? (
            <TouchableOpacity
              accessibilityLabel={t('stat_reorder_title')}
              style={styles.actionButton}
              onPress={() => setReordering(true)}
            >
              <Ionicons name="swap-vertical" size={24} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(section) => section.key}
        ListEmptyComponent={<Text style={styles.empty}>{t('stats_empty')}</Text>}
        renderItem={({ item: section }) => (
          <View>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            {section.rows.map((stat) => {
              const ladder = data.ladderOf(stat.id);
              const top = ladder.at(-1);
              return (
                <TouchableOpacity
                  key={stat.id}
                  style={styles.row}
                  onPress={() => navigation.navigate('StatForm', { statId: stat.id })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{stat.name}</Text>
                    <Text style={styles.meta}>
                      {t('stat_ladder_title')}: {ladder.length} ·{' '}
                      {top ? formatStatValue(top.minValue, ladder, notation) : '—'}
                    </Text>
                  </View>
                  {canEdit ? (
                    <TouchableOpacity
                      accessibilityLabel={t('delete')}
                      style={styles.actionButton}
                      onPress={() => handleDelete(stat)}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />

      <ReorderModal
        isVisible={reordering}
        onClose={() => setReordering(false)}
        title={t('stat_reorder_title')}
        items={data.stats}
        getId={(stat) => stat.id}
        getLabel={(stat) => stat.name}
        onReorderConfirm={(reordered) =>
          handleReorder(reordered.map((stat, index) => ({ id: stat.id, order: index })))
        }
      />
    </View>
  );
};

export default StatListScreen;
