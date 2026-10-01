import {
  applySimulationEffects,
  emptyStorySimulationState,
  enterSimulatedScene,
  evaluateSimulatedChoice,
  type StorySimulationState,
} from '@keres/shared';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavigatorData } from './useStoryNavigatorData';

export type SimulatedRouteStep = { sceneId: string; selectedChoiceId: string | null };
export type SimulatedChoice = {
  choice: NavigatorData['choices'][number];
  evaluation: ReturnType<typeof evaluateSimulatedChoice>;
};

/**
 * One scene-by-scene walk through a branching story: where the reader is, which items and triggers
 * they carry, what each choice is worth right now, and the steps taken. The Story Navigator and the
 * manuscript's explore view are the same walk; only what they show of a scene differs.
 */
export function useStorySimulation({
  scenes,
  choices,
  items,
  groups,
  checks,
  effects,
}: NavigatorData) {
  const { t } = useTranslation();
  const [startSceneId, setStartSceneId] = useState<string | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [state, setState] = useState<StorySimulationState>(emptyStorySimulationState());
  const [activity, setActivity] = useState<string[]>([]);
  const [steps, setSteps] = useState<SimulatedRouteStep[]>([]);
  const current = scenes.find((scene) => scene.id === currentSceneId);

  const sceneEffects = useCallback(
    (id: string) =>
      effects.filter((effect) => effect.entityType === 'Scene' && effect.entityId === id),
    [effects],
  );
  const sceneName = useCallback(
    (id: string) => scenes.find((scene) => scene.id === id)?.name ?? t('unknown_scene'),
    [scenes, t],
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
        t('navigator_entered_scene', { scene: sceneName(id) }),
        ...effectMessages(entering),
      ]);
      setSteps([{ sceneId: id, selectedChoiceId: null }]);
    },
    [effectMessages, sceneEffects, sceneName, startSceneId, t],
  );
  const start = useCallback(
    (id: string | null) => {
      if (!id) return;
      setStartSceneId(id);
      reset(id);
    },
    [reset],
  );

  // Default start scene: `scenes` and `reset` have unstable identities (fresh references per
  // render), so tracking them with previous-value state would loop forever. The latches below
  // only act while their target is still unset, and each firing resolves its own latch.
  if (!startSceneId) {
    const first = scenes.find((scene) => scene.isStart)?.id ?? scenes[0]?.id ?? null;
    if (first !== startSceneId) {
      setStartSceneId(first);
    }
  }
  if (startSceneId && !currentSceneId) {
    reset(startSceneId);
  }

  const available = useMemo<SimulatedChoice[]>(
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
    setSteps((previous) => [
      ...previous.map((step, index) =>
        index === previous.length - 1 ? { ...step, selectedChoiceId: choice.id } : step,
      ),
      { sceneId: choice.nextSceneId, selectedChoiceId: null },
    ]);
    setActivity([
      t('navigator_chose', { choice: choice.text }),
      ...effectMessages(choiceEffects),
      t('navigator_entered_scene', { scene: sceneName(choice.nextSceneId) }),
      ...effectMessages(entering),
    ]);
  };

  const unavailableReason = (evaluation: SimulatedChoice['evaluation']) => {
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

  return {
    startSceneId,
    current,
    state,
    activity,
    steps,
    available,
    activeItems,
    activeTriggers,
    start,
    reset,
    choose,
    unavailableReason,
  };
}

export type StorySimulation = ReturnType<typeof useStorySimulation>;
