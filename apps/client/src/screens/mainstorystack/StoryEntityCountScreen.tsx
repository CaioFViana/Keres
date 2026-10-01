import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import EntityCountCard from '@/src/components/features/analysis/EntityCountCard/EntityCountCard';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useDrizzle } from '../../db';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { StoryPlan } from '@keres/shared';
import type { StoryEntityCounts } from '../../services/storymanagement/StoryEntityCountService';
import { createStoryEntityCountService } from '../../services/storymanagement/StoryEntityCountService';
import { createStoryPlanService } from '../../services/StoryPlanService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { isStoryVocabularyEntityType } from '../../vocabulary/resolveStoryTerm';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

/**
 * What each synchronized entity type is called in the count. The types the story's vocabulary renames
 * (characters, scenes...) are labelled through it instead; these are the rest, relations and links
 * included, because the plan counts those too.
 */
const ENTITY_COUNT_LABEL_KEYS: Record<string, string> = {
  AttributeValue: 'entity_count_attribute_value',
  Board: 'entity_count_board',
  Chapter: 'entity_count_chapter',
  ChapterAnchor: 'entity_count_chapter_anchor',
  Character: 'entity_count_character',
  CharacterRelation: 'entity_count_character_relation',
  CharacterScene: 'entity_count_character_scene',
  Choice: 'entity_count_choice',
  ChoiceCheck: 'entity_count_choice_check',
  ChoiceCheckGroup: 'entity_count_choice_check_group',
  Effect: 'entity_count_effect',
  Gallery: 'entity_count_gallery',
  GalleryRelation: 'entity_count_gallery_relation',
  Item: 'entity_count_item',
  ItemJourney: 'entity_count_item_journey',
  Location: 'entity_count_location',
  LocationMap: 'entity_count_location_map',
  LocationRelation: 'entity_count_location_relation',
  Mode: 'entity_count_mode',
  Note: 'entity_count_note',
  NoteRelation: 'entity_count_note_relation',
  Plot: 'entity_count_plot',
  PlotScene: 'entity_count_plot_scene',
  Route: 'entity_count_route',
  RouteStep: 'entity_count_route_step',
  Scene: 'entity_count_scene',
  SeeAlsoRelation: 'entity_count_see_also_relation',
  Stat: 'entity_count_stat',
  StatRelation: 'entity_count_stat_relation',
  StatStrength: 'entity_count_stat_strength',
  StoryArc: 'entity_count_story_arc',
  StoryCalendar: 'entity_count_story_calendar',
  StorySchemaField: 'entity_count_story_schema_field',
  Suggestion: 'entity_count_suggestion',
  Tag: 'entity_count_tag',
  TagRelation: 'entity_count_tag_relation',
  WorldRule: 'entity_count_world_rule',
};

/**
 * How many entities the story has, by type, and - for a story on a server - against the owner's plan.
 * It lives beside the analysis (the header button there opens it) but answers a different question:
 * what is in the story, not what is wrong with it. Information only; the server is what enforces.
 *
 * The count is the local one, so it includes what has not synchronized yet; the plan is read from the
 * server and is simply absent while offline or for a story that only lives on this device.
 */
const StoryEntityCountScreen = () => {
  useScreenTour('StoryEntityCount');
  const cardAnchorRef = useScreenAnchor('StoryEntityCount', 'card');
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const navigation = useNavigation();
  useBackButtonHandler({ showWebBackButton: true });
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const serverId = selectedStory?.serverId;
  const drizzleDb = useDrizzle();
  const commonContainerStyles = getCommonContainerStyles(colors);

  const [counts, setCounts] = useState<StoryEntityCounts | null>(null);
  const [plan, setPlan] = useState<StoryPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useScreenHeader({ target: 'parent', title: t('entity_count_title') });

  const load = useCallback(async () => {
    if (!storyId) return;
    try {
      setError(null);
      setCounts(await createStoryEntityCountService(drizzleDb).countForStory(storyId));
    } catch (countError) {
      console.error('StoryEntityCountScreen: failed to count entities.', countError);
      setError(t('entity_count_failed'));
    } finally {
      setLoading(false);
    }
    // The plan is a bonus on top of the count: it never holds the count back, and it never fails it.
    createStoryPlanService(drizzleDb)
      .getPlan(serverId, storyId)
      .then(setPlan)
      .catch(() => setPlan(null));
  }, [drizzleDb, storyId, serverId, t]);

  // Reloaded on every focus: the person comes here after writing, to see what it came to.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const labelFor = useCallback(
    (entityType: string) =>
      isStoryVocabularyEntityType(entityType)
        ? term(entityType, true)
        : t(ENTITY_COUNT_LABEL_KEYS[entityType] ?? entityType),
    [t, term],
  );

  if (loading) {
    return <ScreenLoading padded message={t('entity_count_loading')} />;
  }

  if (error || !counts) {
    return (
      <ScreenError
        padded
        message={error ?? t('entity_count_failed')}
        onGoBack={navigation.goBack}
      />
    );
  }

  return (
    <ScrollView
      ref={cardAnchorRef}
      style={commonContainerStyles.container}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <EntityCountCard
        total={counts.total}
        byType={counts.byType}
        labelFor={labelFor}
        plan={plan}
        onServer={!!serverId}
      />
    </ScrollView>
  );
};

export default StoryEntityCountScreen;
