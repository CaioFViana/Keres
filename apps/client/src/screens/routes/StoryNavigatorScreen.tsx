import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Select from '@/src/components/common/inputs/Select/Select';
import NavigatorRoutePersistenceModal, {
  type NavigatorRoutePersistenceMode,
} from '@/src/components/features/routes/NavigatorRoutePersistenceModal';
import {
  emptyStorySimulationState,
  enterSimulatedScene,
  evaluateSimulatedChoice,
  applySimulationEffects,
  type StorySimulationState,
} from '@keres/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '../../components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryNavigatorData } from '../../hooks/useStoryNavigatorData';
import { useStoryRoutes } from '../../hooks/useStoryRoutes';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { createRouteService } from '../../services/storymanagement/RouteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { AppAlert } from '../../utils/AppAlert';
import { useDrizzle } from '../../db';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'StoryNavigator'>;
type SimulatedRouteStep = { sceneId: string; selectedChoiceId: string | null };

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
  const [startSceneId, setStartSceneId] = useState<string | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [state, setState] = useState<StorySimulationState>(emptyStorySimulationState());
  const [activity, setActivity] = useState<string[]>([]);
  const [simulatedSteps, setSimulatedSteps] = useState<SimulatedRouteStep[]>([]);
  const [persistenceMode, setPersistenceMode] = useState<NavigatorRoutePersistenceMode | null>(
    null,
  );
  const current = scenes.find((scene) => scene.id === currentSceneId);
  const sceneEffects = useCallback(
    (id: string) =>
      effects.filter((effect) => effect.entityType === 'Scene' && effect.entityId === id),
    [effects],
  );
  const effectMessages = useCallback(
    (list: typeof effects) =>
      list.map((effect) => {
        const itemName = effect.itemId
          ? (items.find((item) => item.id === effect.itemId)?.name ?? t('unknown_item'))
          : '';
        if (effect.effectType === 'itemGrant')
          return t('navigator_effect_item_grant', { item: itemName });
        if (effect.effectType === 'itemTake')
          return t('navigator_effect_item_take', { item: itemName });
        if (effect.effectType === 'triggerSet')
          return t('navigator_effect_trigger_set', { trigger: effect.triggerName });
        return t('navigator_effect_trigger_unset', { trigger: effect.triggerName });
      }),
    [items, t],
  );
  const reset = useCallback(
    (id = startSceneId) => {
      if (!id) return;
      const entering = sceneEffects(id);
      setCurrentSceneId(id);
      setState(enterSimulatedScene(emptyStorySimulationState(), id, entering));
      setActivity([
        t('navigator_entered_scene', {
          scene: scenes.find((scene) => scene.id === id)?.name ?? t('unknown_scene'),
        }),
        ...effectMessages(entering),
      ]);
      setSimulatedSteps([{ sceneId: id, selectedChoiceId: null }]);
    },
    [effectMessages, sceneEffects, scenes, startSceneId, t],
  );
  useEffect(() => {
    if (!startSceneId) {
      const first = scenes.find((scene) => scene.isStart)?.id ?? scenes[0]?.id ?? null;
      setStartSceneId(first);
    }
  }, [scenes, startSceneId]);
  useEffect(() => {
    if (startSceneId && !currentSceneId) reset(startSceneId);
  }, [currentSceneId, reset, startSceneId]);
  const availableChoices = useMemo(
    () =>
      choices
        .filter((choice) => choice.sceneId === currentSceneId)
        .map((choice) => ({
          choice,
          evaluation: evaluateSimulatedChoice(choice, groups, checks, state),
        })),
    [choices, checks, currentSceneId, groups, state],
  );
  const activeItems = useMemo(
    () =>
      [...state.inventory].map(
        (id) => items.find((item) => item.id === id)?.name ?? t('unknown_item'),
      ),
    [items, state.inventory, t],
  );
  const activeTriggers = useMemo(() => [...state.triggers].sort(), [state.triggers]);
  const choose = (choiceId: string) => {
    const choice = choices.find((entry) => entry.id === choiceId);
    if (!choice) return;
    const choiceEffects = effects.filter(
      (effect) => effect.entityType === 'Choice' && effect.entityId === choice.id,
    );
    const entering = sceneEffects(choice.nextSceneId);
    const afterChoice = applySimulationEffects(state, choiceEffects);
    setCurrentSceneId(choice.nextSceneId);
    setState(enterSimulatedScene(afterChoice, choice.nextSceneId, entering));
    setSimulatedSteps((steps) => [
      ...steps.map((step, index) =>
        index === steps.length - 1 ? { ...step, selectedChoiceId: choice.id } : step,
      ),
      { sceneId: choice.nextSceneId, selectedChoiceId: null },
    ]);
    setActivity([
      t('navigator_chose', { choice: choice.text }),
      ...effectMessages(choiceEffects),
      t('navigator_entered_scene', {
        scene: scenes.find((scene) => scene.id === choice.nextSceneId)?.name ?? t('unknown_scene'),
      }),
      ...effectMessages(entering),
    ]);
  };
  const unavailableReason = (evaluation: ReturnType<typeof evaluateSimulatedChoice>) => {
    const failed = evaluation.outcomes
      .filter((outcome) => !outcome.passes)
      .flatMap((outcome) =>
        outcome.results.filter((result) => !result.passes).map((result) => result.check),
      );
    const trigger = failed.find((check) => check.type === 'trigger');
    if (trigger?.triggerName)
      return trigger.mode === 'block'
        ? t('navigator_blocked_by_trigger', { trigger: trigger.triggerName })
        : t('navigator_requires_trigger', { trigger: trigger.triggerName });
    return t('navigator_choice_unavailable');
  };
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
        label: { color: colors.textSecondary, fontSize: 13, marginBottom: 5 },
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 16,
          marginTop: 16,
        },
        title: { color: colors.text, fontWeight: '700', fontSize: 19 },
        summary: { color: colors.text, fontSize: 16, lineHeight: 25, marginTop: 10 },
        muted: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 10 },
        choice: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 8,
          padding: 13,
          marginTop: 10,
        },
        unavailable: { opacity: 0.45, borderColor: colors.border },
        choiceText: { color: colors.text, fontWeight: '600' },
        blockedReason: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
        state: { color: colors.textSecondary, marginTop: 16 },
        activity: { color: colors.textSecondary, marginTop: 6 },
        restart: { marginTop: 20 },
        routeActions: { marginTop: 12 },
      }),
    [colors],
  );
  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('story_navigator_title'));
      navigation
        .getParent()
        ?.setOptions({ title: t('story_navigator_title'), headerRight: undefined });
    }, [navigation, t]),
  );
  if (selectedStory?.type !== 'branching')
    return (
      <ScreenError message={t('navigator_branching_only')} onGoBack={() => navigation.goBack()} />
    );
  if (loading) return <ScreenLoading message={t('loading_story_navigator')} />;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>{t('navigator_start_scene')}</Text>
      <Select
        options={scenes.map((scene) => ({ value: scene.id, label: scene.name }))}
        value={startSceneId}
        onValueChange={(id) => {
          setStartSceneId(id);
          reset(id);
        }}
        placeholder={t('route_select_start_scene')}
      />
      {current ? (
        <View style={styles.card}>
          <TouchableOpacity
            onPress={() =>
              openEntity('Scene', current.id, {
                onReturn: () => navigation.navigate('StoryNavigator'),
              })
            }
          >
            <Text style={styles.title}>{current.name}</Text>
          </TouchableOpacity>
          <Text style={current.summary ? styles.summary : styles.muted}>
            {current.summary || t('plot_reader_no_summary')}
          </Text>
          <Text style={styles.state}>
            {t('navigator_state', {
              visits: state.sceneVisits.size,
              items: state.inventory.size,
              triggers: state.triggers.size,
            })}
          </Text>
          <Text style={styles.activity}>
            {t('navigator_active_items', {
              items: activeItems.length ? activeItems.join(', ') : t('navigator_none'),
            })}
          </Text>
          <Text style={styles.activity}>
            {t('navigator_active_triggers', {
              triggers: activeTriggers.length ? activeTriggers.join(', ') : t('navigator_none'),
            })}
          </Text>
          {activity.map((entry, index) => (
            <Text key={`${entry}-${index}`} style={styles.activity}>
              • {entry}
            </Text>
          ))}
          {availableChoices.map(({ choice, evaluation }) => (
            <TouchableOpacity
              key={choice.id}
              disabled={!evaluation.available}
              onPress={() => choose(choice.id)}
              style={[styles.choice, !evaluation.available && styles.unavailable]}
              accessibilityLabel={
                evaluation.available
                  ? choice.text
                  : `${choice.text}. ${unavailableReason(evaluation)}`
              }
            >
              <Text style={styles.choiceText}>{choice.text}</Text>
              {!evaluation.available ? (
                <Text style={styles.blockedReason}>{unavailableReason(evaluation)}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
          {availableChoices.length === 0 ? (
            <Text style={styles.muted}>{t('navigator_no_choices')}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.muted}>{t('navigator_no_scenes')}</Text>
      )}
      <Button onPress={() => reset()} style={styles.restart}>
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
