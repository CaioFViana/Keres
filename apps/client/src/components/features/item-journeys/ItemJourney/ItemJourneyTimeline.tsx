import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../../db';
import type {
  CharacterSelect,
  ChapterSelect,
  ChoiceSelect,
  ItemJourneySelect,
  ItemSelect,
  SceneSelect,
} from '../../../../db/schema';
import type { ItemStackParamList } from '../../../../navigation/MainSystemStack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createCharacterService } from '../../../../services/storymanagement/CharacterService';
import { createChapterService } from '../../../../services/storymanagement/ChapterService';
import { createChoiceService } from '../../../../services/storymanagement/ChoiceService';
import { createItemJourneyService } from '../../../../services/storymanagement/ItemJourneyService';
import { createSceneService } from '../../../../services/storymanagement/SceneService';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useTheme } from '../../../../theme';
import { entityEventEmitter } from '../../../../utils/EventEmitter';
import { orderItemJourneysByNarrative } from '../../../../utils/itemJourneyOrder';
import { buildChapterColors } from '@keres/shared/graphs/storyGraphLayout';

interface ItemJourneyTimelineProps {
  item: ItemSelect;
  storyId: string;
  storyType: 'linear' | 'branching';
}

/**
 * A história de um Item como uma sequência de cartões conectados - a cena onde ele nasceu
 * (a partir do próprio Item, `characterOwnerId`/`initialState`) seguida de cada Item Journey,
 * na ordem narrativa (`orderItemJourneysByNarrative`), com um cartão final pra criar a
 * próxima. Inspirado visualmente na tela do Mapa da História (`ChoiceViewScreen`) - cor por
 * capítulo, cartões nativos - mas como uma linha do tempo simples: a jornada de um item é uma
 * sequência única por definição (é o que a estratégia de ordenação garante), não um grafo
 * ramificado, então não precisa do canvas de pan/zoom nem das curvas SVG daquela tela.
 */
const ItemJourneyTimeline: React.FC<ItemJourneyTimelineProps> = ({ item, storyId, storyType }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ItemStackParamList>>();
  const navigateToDetail = useNavigateToEntityDetail();
  const drizzleDb = useDrizzle();

  const [journeys, setJourneys] = useState<ItemJourneySelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [loading, setLoading] = useState(true);

  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!drizzleDb || !storyId) return;
    if (!loadedRef.current) setLoading(true);
    try {
      const [fetchedJourneys, fetchedScenes, fetchedChapters, fetchedChoices, fetchedCharacters] =
        await Promise.all([
          createItemJourneyService(drizzleDb).getItemJourneysByItemId(storyId, item.id),
          createSceneService(drizzleDb).getAllByStoryId(storyId),
          createChapterService(drizzleDb).getAllByStoryId(storyId),
          createChoiceService(drizzleDb).getAllByStoryId(storyId),
          createCharacterService(drizzleDb).getAllByStoryId(storyId),
        ]);
      setJourneys(fetchedJourneys);
      setScenes(fetchedScenes);
      setChapters(fetchedChapters);
      setChoices(fetchedChoices);
      setCharacters(fetchedCharacters);
    } catch (err) {
      console.error('Failed to load item journey timeline:', err);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, [drizzleDb, storyId, item.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        load();
      }
    };
    entityEventEmitter.on('item_journey_changed', handleChange);
    return () => {
      entityEventEmitter.off('item_journey_changed', handleChange);
    };
  }, [storyId, load]);

  const chapterColorById = buildChapterColors(chapters);
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const orderedJourneys = orderItemJourneysByNarrative(
    journeys,
    storyType,
    scenes,
    choices,
    chapters,
  );

  const handleOpenJourney = useCallback(
    (journeyId: string) => {
      navigateToDetail('ItemJourney', journeyId);
    },
    [navigateToDetail],
  );

  const handleAddJourney = useCallback(() => {
    navigation.navigate('ItemJourneyForm', { itemId: item.id });
  }, [navigation, item.id]);

  const originOwner = item.characterOwnerId ? characterById.get(item.characterOwnerId) : undefined;

  const styles = StyleSheet.create({
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 15,
      marginBottom: 10,
    },
    scrollContent: { paddingBottom: 8, paddingRight: 8, alignItems: 'flex-start' },
    row: { flexDirection: 'row', alignItems: 'center' },
    card: {
      width: 150,
      minHeight: 88,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 10,
      justifyContent: 'center',
    },
    originCard: {
      borderStyle: 'dashed',
    },
    addCard: {
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chapterAccent: {
      height: 3,
      borderRadius: 2,
      marginBottom: 8,
    },
    cardLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    connector: { marginHorizontal: 4 },
  });

  const renderChapterAccent = (chapterId: string | undefined) => (
    <View
      style={[
        styles.chapterAccent,
        {
          backgroundColor: chapterId
            ? (chapterColorById.get(chapterId) ?? colors.border)
            : colors.border,
          width: 40,
        },
      ]}
    />
  );

  return (
    <View>
      <Text style={styles.sectionTitle}>{t('item_journeys_title')}</Text>
      {loading ? (
        <Text style={{ color: colors.textSecondary }}>{t('loading')}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.card, styles.originCard]}>
            {renderChapterAccent(undefined)}
            <Text style={styles.cardLabel}>{t('item_journey_origin')}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.initialState || t('common_na')}
            </Text>
            {originOwner && (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {originOwner.name}
              </Text>
            )}
          </View>

          {orderedJourneys.map((journey) => {
            const scene = sceneById.get(journey.sceneId);
            const chapter = scene ? chapterById.get(scene.chapterId) : undefined;
            const newOwner = journey.newCharacterOwnerId
              ? characterById.get(journey.newCharacterOwnerId)
              : undefined;
            return (
              <View key={journey.id} style={styles.row}>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.textSecondary}
                  style={styles.connector}
                />
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => handleOpenJourney(journey.id)}
                  activeOpacity={0.7}
                >
                  {renderChapterAccent(chapter?.id)}
                  <Text style={styles.cardLabel} numberOfLines={1}>
                    {scene?.name ?? t('unknown_scene')}
                  </Text>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {journey.newState}
                  </Text>
                  {newOwner && (
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {newOwner.name}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.row}>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={colors.textSecondary}
              style={styles.connector}
            />
            <TouchableOpacity
              style={[styles.card, styles.addCard]}
              onPress={handleAddJourney}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={[styles.cardSubtitle, { marginTop: 4, color: colors.primary }]}>
                {t('add_item_journey')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default ItemJourneyTimeline;
