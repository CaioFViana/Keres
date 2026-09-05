import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ItemSelect } from '../../../../db/schema';
import type { ItemStackParamList } from '../../../../navigation/MainSystemStack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useItemJourneyTimelineData } from '../../../../hooks/useItemJourneyTimelineData';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useSceneCalendarDates } from '../../../../hooks/useSceneCalendarDates';
import { useTheme } from '../../../../theme';
import { orderItemJourneysByNarrative } from '../../../../utils/itemJourneyOrder';
import { buildChapterColors } from '@keres/shared/graphs/storyGraphLayout';
import { useVocabularyEntityCopy } from '../../../../vocabulary/useVocabularyEntityCopy';

interface ItemJourneyTimelineProps {
  item: ItemSelect;
  storyId: string;
  storyType: 'linear' | 'branching';
}

/**
 * An Item's history as a sequence of connected cards - the scene where it was born (from the Item
 * itself, `characterOwnerId`/`initialState`) followed by each Item Journey, in narrative order
 * (`orderItemJourneysByNarrative`), with a final card for creating the next one. Visually inspired by
 * the Story Map screen (`ChoiceViewScreen`) - colour per chapter, native cards - but as a simple
 * timeline: an item's journey is a single sequence by definition (which is what the ordering strategy
 * guarantees), not a branching graph, so it needs neither the pan/zoom canvas nor that screen's SVG
 * curves.
 */
const ItemJourneyTimeline: React.FC<ItemJourneyTimelineProps> = ({ item, storyId, storyType }) => {
  const { t } = useTranslation();
  const itemCopy = useVocabularyEntityCopy('Item');
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ItemStackParamList>>();
  const navigateToDetail = useNavigateToEntityDetail();
  const { dateForScene } = useSceneCalendarDates(storyId);
  const { journeys, scenes, chapters, choices, characters, loading } = useItemJourneyTimelineData(
    storyId,
    item.id,
  );

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
      <Text style={styles.sectionTitle}>{itemCopy.itemJourneys}</Text>
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
            const chapter = scene?.chapterId ? chapterById.get(scene.chapterId) : undefined;
            const newOwner = journey.newCharacterOwnerId
              ? characterById.get(journey.newCharacterOwnerId)
              : undefined;
            const sceneDate = scene ? dateForScene(scene) : null;
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
                  {sceneDate && (
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {sceneDate.date}
                    </Text>
                  )}
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
