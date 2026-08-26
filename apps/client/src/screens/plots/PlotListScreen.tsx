import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import PlotListItem from '@/src/components/features/list-items/PlotListItem';
import type { PlotSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryPlots } from '../../hooks/useStoryPlots';
import { useStoryRole } from '../../hooks/useStoryRole';
import type {
  MainSystemDrawerParamList,
  PlotsStackParamList,
} from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';

export type PlotsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'PlotsStack'>,
  NativeStackNavigationProp<PlotsStackParamList, 'Plots'>
>;

/**
 * The root of the "Plots" menu: the story's narrative threads, and the shortcuts to the matrix,
 * the coverage and the reader.
 *
 * Deliberately without Advanced Search, tags or favourites - a Plot has only a name and details, and the
 * full bar would give the impression of filters that do not exist.
 */
const PlotListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<PlotsScreenNavigationProp>();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const { plots, relationsOf, loading } = useStoryPlots(
    selectedStory?.type === 'linear' ? storyId : undefined,
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState<string | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    headerRightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 15,
      gap: 15,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('plots_title'));
      navigation.getParent()?.setOptions({
        title: t('plots_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PlotReader')}
              accessibilityLabel={t('plot_reader_title')}
            >
              <Ionicons name="book-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('PlotMatrix')}
              accessibilityLabel={t('plot_matrix_title')}
            >
              <Ionicons name="grid-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('PlotProgress')}
              accessibilityLabel={t('plot_progress_title')}
            >
              <Ionicons name="stats-chart-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity
                onPress={() => navigation.navigate('PlotForm', {})}
                accessibilityLabel={t('create_plot')}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    }, [navigation, colors.text, t, canEdit, styles.headerRightContainer]),
  );

  const visiblePlots = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const filtered = term
      ? plots.filter((plot) => `${plot.name} ${plot.details ?? ''}`.toLowerCase().includes(term))
      : plots;
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (activeSort === 'createdAt')
        return direction * (a.createdAt.getTime() - b.createdAt.getTime());
      if (activeSort === 'updatedAt')
        return direction * (a.updatedAt.getTime() - b.updatedAt.getTime());
      if (activeSort === 'sceneCount')
        return direction * (relationsOf(a.id).length - relationsOf(b.id).length);
      return direction * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [activeSort, plots, relationsOf, searchQuery, sortDirection]);

  const sortOptions = useMemo(
    () => [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('plot_sort_by_scene_count'), value: 'sceneCount' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ],
    [t],
  );

  const renderPlotListItem = useCallback(
    ({ item }: { item: PlotSelect }) => (
      <PlotListItem
        plot={item}
        sceneCount={relationsOf(item.id).length}
        onViewDetails={(plotId) => navigation.navigate('PlotDetail', { plotId })}
      />
    ),
    [navigation, relationsOf],
  );

  if (!storyId) {
    return <ScreenError message={t('no_story_selected')} onGoBack={() => navigation.goBack()} />;
  }

  if (selectedStory?.type !== 'linear') {
    return <ScreenError message={t('plots_linear_only')} onGoBack={() => navigation.goBack()} />;
  }

  if (loading && plots.length === 0) {
    return <ScreenLoading message={t('loading_plots')} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={visiblePlots}
        renderItem={renderPlotListItem}
        keyExtractor={(item) => item.id}
        onSearch={setSearchQuery}
        searchPlaceholder={t('search_plots')}
        currentSearchTerm={searchQuery}
        filterOptions={[]}
        onFilterChange={() => {}}
        selectedFilterValues={[]}
        sortOptions={sortOptions}
        onSortChange={setActiveSort}
        onSortDirectionChange={setSortDirection}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        emptyListComponent={<Text style={styles.emptyText}>{t('no_plots')}</Text>}
        disableTagFilter
        disableFavoriteFilter
        isLoading={loading}
      />
    </View>
  );
};

export default PlotListScreen;
