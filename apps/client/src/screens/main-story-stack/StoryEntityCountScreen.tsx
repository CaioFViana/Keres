import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import EntityCountCard from '@/src/components/features/analysis/EntityCountCard/EntityCountCard';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useDrizzle } from '@/src/db';
import { useScreenAnchor } from '@/src/hooks/guides/useGuideAnchor';
import { useScreenTour } from '@/src/hooks/guides/useScreenTour';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import type { StoryPlan } from '@keres/shared';
import type { StoryEntityCounts } from '@/src/services/storymanagement/story-lifecycle/StoryEntityCountService';
import { createStoryEntityCountService } from '@/src/services/storymanagement/story-lifecycle/StoryEntityCountService';
import { createStoryPlanService } from '@/src/services/payments/StoryPlanService';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import { ENTITY_COUNT_LABEL_KEYS } from '@/src/utils/entity/entityCountLabels';
import { isStoryVocabularyEntityType } from '@/src/vocabulary/resolveStoryTerm';
import { useStoryVocabulary } from '@/src/hooks/vocabulary/useStoryVocabulary';
import { logger } from '@/src/utils/logging/logger';

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
  const [relations, setRelations] = useState<StoryEntityCounts | null>(null);
  const [plan, setPlan] = useState<StoryPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useScreenHeader({ target: 'parent', title: t('entity_count_title') });

  const load = useCallback(async () => {
    if (!storyId) return;
    try {
      setError(null);
      const service = createStoryEntityCountService(drizzleDb);
      const [counted, linked] = await Promise.all([
        service.countForStory(storyId),
        service.countFreeForStory(storyId),
      ]);
      setCounts(counted);
      setRelations(linked);
    } catch (countError) {
      logger.error('StoryEntityCountScreen: failed to count entities.', countError);
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
      {relations && (
        // For information only: no plan counts these, so this card never shows a limit.
        <EntityCountCard
          variant="relations"
          total={relations.total}
          byType={relations.byType}
          labelFor={labelFor}
          plan={null}
          onServer={!!serverId}
        />
      )}
    </ScrollView>
  );
};

export default StoryEntityCountScreen;
