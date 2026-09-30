import FormField from '@/src/components/common/forms/FormField/FormField';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import NavigatorScenePanel from '@/src/components/features/routes/NavigatorScenePanel';
import NavigatorRoutePersistenceModal, {
  type NavigatorRoutePersistenceMode,
} from '@/src/components/features/routes/NavigatorRoutePersistenceModal';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '../../components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryNavigatorData } from '../../hooks/useStoryNavigatorData';
import { useStorySimulation } from '../../hooks/useStorySimulation';
import { useStoryRoutes } from '../../hooks/useStoryRoutes';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { createRouteService } from '../../services/storymanagement/RouteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDrizzle } from '../../db';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'StoryNavigator'>;

export default function StoryNavigatorScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const db = useDrizzle();
  const openEntity = useNavigateToEntityDetail();
  const { scenes, choices, items, groups, checks, effects, loading } = useStoryNavigatorData(
    selectedStory?.id,
  );
  const { routes } = useStoryRoutes(selectedStory?.id);
  const simulation = useStorySimulation({ scenes, choices, items, groups, checks, effects });
  const { startSceneId, current, steps: simulatedSteps } = simulation;
  const [persistenceMode, setPersistenceMode] = useState<NavigatorRoutePersistenceMode | null>(
    null,
  );
  const persistTraversal = (value: { name?: string; routeId?: string }) => {
    if (!selectedStory?.id || !userId || simulatedSteps.length === 0) return;
    const replacing = Boolean(value.routeId);
    AppAlert.alert(
      t(replacing ? 'navigator_replace_route_confirm_title' : 'navigator_save_route_confirm_title'),
      t(
        replacing
          ? 'navigator_replace_route_confirm_message'
          : 'navigator_save_route_confirm_message',
        {
          count: simulatedSteps.length,
        },
      ),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t(replacing ? 'navigator_replace_route' : 'navigator_save_as_route'),
          onPress: async () => {
            try {
              const service = createRouteService(db);
              const route = value.routeId
                ? routes.find((entry) => entry.id === value.routeId)
                : await service.save(userId, {
                    storyId: selectedStory.id,
                    name: value.name!,
                    details: null,
                  });
              if (!route) throw new Error('Route not found.');
              await service.replaceSteps(userId, route.id, simulatedSteps);
              setPersistenceMode(null);
              navigation.navigate('RouteDetail', { routeId: route.id });
            } catch (error) {
              console.error('Failed to persist navigator route:', error);
              AppAlert.alert(t('error'), t('navigator_save_route_failed'));
            }
          },
        },
      ],
      { cancelable: true },
    );
  };
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        content: { padding: 16, paddingBottom: 30 },
        restart: { marginTop: 20 },
        routeActions: { marginTop: 12 },
      }),
    [colors],
  );
  useScreenHeader({
    target: 'parent',
    title: t('story_navigator_title'),
  });
  if (selectedStory?.type !== 'branching')
    return (
      <ScreenError message={t('navigator_branching_only')} onGoBack={() => navigation.goBack()} />
    );
  if (loading) return <ScreenLoading message={t('loading_story_navigator')} />;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FormField label={t('navigator_start_scene')}>
        <SingleSelectPill
          options={scenes.map((scene) => ({ value: scene.id, label: scene.name }))}
          value={startSceneId}
          onValueChange={simulation.start}
          placeholder={t('route_select_start_scene')}
        />
      </FormField>
      <NavigatorScenePanel
        simulation={simulation}
        content="summary"
        onOpenScene={(sceneId) =>
          openEntity('Scene', sceneId, {
            onReturn: () => navigation.navigate('StoryNavigator'),
          })
        }
      />
      <Button onPress={() => simulation.reset()} style={styles.restart}>
        {t('navigator_restart')}
      </Button>
      <FormActions style={styles.routeActions} stackOnCompact>
        <Button onPress={() => setPersistenceMode('new')} disabled={!simulatedSteps.length}>
          {t('navigator_save_as_route')}
        </Button>
        <Button
          onPress={() => setPersistenceMode('replace')}
          disabled={!simulatedSteps.length || routes.length === 0}
        >
          {t('navigator_replace_route')}
        </Button>
      </FormActions>
      {persistenceMode ? (
        <NavigatorRoutePersistenceModal
          visible
          mode={persistenceMode}
          routes={routes}
          suggestedName={t('navigator_route_name_suggestion', { scene: current?.name ?? '' })}
          stepCount={simulatedSteps.length}
          onClose={() => setPersistenceMode(null)}
          onConfirm={persistTraversal}
        />
      ) : null}
    </ScrollView>
  );
}
