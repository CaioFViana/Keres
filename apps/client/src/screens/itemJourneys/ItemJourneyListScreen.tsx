import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericExpandedListItemWithActions from '../../components/common/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import Select from '../../components/common/Select/Select';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { ChapterSelect, ChoiceSelect, ItemJourneySelect, ItemSelect, SceneSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { ItemJourneyStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { createItemService } from '../../services/storymanagement/ItemService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { orderItemJourneysByNarrative } from '../../utils/itemJourneyOrder';

export type ItemJourneysScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ItemJourneysStack'>,
  NativeStackNavigationProp<ItemJourneyStackParamList, 'ItemJourneyDetail'>
>;

interface ItemWithJourneys {
  item: ItemSelect;
  journeys: ItemJourneySelect[];
}

type SortMode = 'name' | 'journeyCount';

/**
 * Lista dos Itens que têm ao menos uma Item Journey - não mais uma lista achatada de todas as
 * journeys da história (sem relação nenhuma entre si na tela, ordenadas só por `createdAt`).
 * Expandir um item mostra as journeys dele, na mesma ordem narrativa que `ItemJourneyTimeline`
 * usa na tela do próprio Item.
 */
const ItemJourneyListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneysScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { canEdit } = useStoryRole(selectedStory?.id);

  const [items, setItems] = useState<ItemSelect[]>([]);
  const [journeys, setJourneys] = useState<ItemJourneySelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('journeyCount');

  const load = useCallback(async () => {
    if (!drizzleDb || !selectedStory?.id) return;
    try {
      setLoading(true);
      const storyId = selectedStory.id;
      const [fetchedItems, fetchedJourneys, fetchedScenes, fetchedChapters, fetchedChoices] = await Promise.all([
        createItemService(drizzleDb).getAllByStoryId(storyId),
        createItemJourneyService(drizzleDb).getAllByStoryId(storyId),
        createSceneService(drizzleDb).getAllByStoryId(storyId),
        createChapterService(drizzleDb).getAllByStoryId(storyId),
        createChoiceService(drizzleDb).getAllByStoryId(storyId),
      ]);
      setItems(fetchedItems);
      setJourneys(fetchedJourneys);
      setScenes(fetchedScenes);
      setChapters(fetchedChapters);
      setChoices(fetchedChoices);
      setError(null);
    } catch (err) {
      console.error('Failed to load item journeys:', err);
      setError(t('failed_to_load_item_journeys'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, selectedStory?.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === selectedStory?.id) {
        load();
      }
    };
    entityEventEmitter.on('item_journey_changed', handleChange);
    entityEventEmitter.on('item_changed', handleChange);
    return () => {
      entityEventEmitter.off('item_journey_changed', handleChange);
      entityEventEmitter.off('item_changed', handleChange);
    };
  }, [selectedStory?.id, load]);

  const sceneById = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes]);

  const groupedItems = useMemo<ItemWithJourneys[]>(() => {
    const journeysByItemId = new Map<string, ItemJourneySelect[]>();
    for (const journey of journeys) {
      const list = journeysByItemId.get(journey.itemId) ?? [];
      list.push(journey);
      journeysByItemId.set(journey.itemId, list);
    }

    const storyType = selectedStory?.type ?? 'linear';
    let grouped = items
      .filter((item) => journeysByItemId.has(item.id))
      .map((item) => ({
        item,
        journeys: orderItemJourneysByNarrative(journeysByItemId.get(item.id)!, storyType, scenes, choices, chapters),
      }));

    if (searchText.trim()) {
      const needle = searchText.trim().toLowerCase();
      grouped = grouped.filter(({ item }) => item.name.toLowerCase().includes(needle));
    }

    grouped.sort((a, b) => (
      sortMode === 'name'
        ? a.item.name.localeCompare(b.item.name)
        : b.journeys.length - a.journeys.length
    ));

    return grouped;
  }, [items, journeys, scenes, choices, chapters, selectedStory?.type, searchText, sortMode]);

  const handleOpenItem = useCallback((itemId: string) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Item', itemId);
    }
  }, [navigation]);

  const handleOpenJourney = useCallback((journeyId: string) => {
    navigation.navigate('ItemJourneyDetail', { itemJourneyId: journeyId });
  }, [navigation]);

  const sortOptions = useMemo(() => ([
    { label: t('sort_by_journey_count'), value: 'journeyCount' },
    { label: t('sort_by_name'), value: 'name' },
  ]), [t]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: 12, paddingBottom: 24 },
    filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, gap: 8, alignItems: 'flex-start' },
    searchInputWrapper: { flex: 1 },
    sortWrapper: { width: 170 },
    headerButton: { marginLeft: 15 },
    itemHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    itemName: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
    journeyCountBadge: {
      minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primaryContainer, marginLeft: 8,
    },
    journeyCountText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    journeyRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    journeyRowText: { flex: 1 },
    journeyScene: { fontSize: 12, color: colors.textSecondary },
    journeyState: { fontSize: 14, color: colors.text, marginTop: 2 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: 10 },
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('item_journeys_title'));
      navigation.getParent()?.setOptions({
        title: t('item_journeys_title'),
        headerRight: canEdit ? () => (
          <TouchableOpacity onPress={() => navigation.navigate('ItemJourneyForm', {})} style={styles.headerButton}>
            <Ionicons name="add" size={30} color={colors.text} />
          </TouchableOpacity>
        ) : undefined,
      });
    }, [navigation, colors.text, t, styles.headerButton, canEdit])
  );

  const renderHeaderContent = useCallback((entry: ItemWithJourneys) => (
    <View style={styles.itemHeaderLeft}>
      <Text style={styles.itemName} numberOfLines={1}>{entry.item.name}</Text>
      <View style={styles.journeyCountBadge}>
        <Text style={styles.journeyCountText}>{entry.journeys.length}</Text>
      </View>
    </View>
  ), [styles]);

  const renderExpandedContent = useCallback((entry: ItemWithJourneys) => (
    <View>
      {entry.journeys.map((journey) => (
        <TouchableOpacity key={journey.id} style={styles.journeyRow} onPress={() => handleOpenJourney(journey.id)} activeOpacity={0.7}>
          <View style={styles.journeyRowText}>
            <Text style={styles.journeyScene} numberOfLines={1}>{sceneById.get(journey.sceneId)?.name ?? t('unknown_scene')}</Text>
            <Text style={styles.journeyState} numberOfLines={1}>{journey.newState}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  ), [styles, sceneById, colors.textSecondary, handleOpenJourney, t]);

  const renderItem = useCallback(({ item: entry }: { item: ItemWithJourneys }) => (
    <GenericExpandedListItemWithActions
      item={{ id: entry.item.id, isFavorite: entry.item.isFavorite }}
      onViewDetails={() => handleOpenItem(entry.item.id)}
      renderHeaderContent={() => renderHeaderContent(entry)}
      renderExpandedContent={() => renderExpandedContent(entry)}
    />
  ), [handleOpenItem, renderHeaderContent, renderExpandedContent]);

  if (loading && items.length === 0) {
    return <ScreenLoading message={t('loading_item_journeys')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            placeholder={t('search_items')}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <View style={styles.sortWrapper}>
          <Select
            options={sortOptions}
            value={sortMode}
            onValueChange={(value) => setSortMode((value as SortMode) ?? 'journeyCount')}
            placeholder={t('sort')}
          />
        </View>
      </View>

      <FlatList
        data={groupedItems}
        keyExtractor={(entry) => entry.item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('no_items_with_journeys')}</Text>
          </View>
        )}
      />
    </View>
  );
};

export default ItemJourneyListScreen;
