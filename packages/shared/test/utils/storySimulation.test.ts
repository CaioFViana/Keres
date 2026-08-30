import { describe, expect, it } from 'vitest';
import {
  applySimulationEffects,
  emptyStorySimulationState,
  enterSimulatedScene,
  evaluateSimulatedChoice,
} from '../../utils/storySimulation';

const base = {
  storyId: 'story',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

describe('story simulation', () => {
  it('applies scene state and explains enable checks', () => {
    const entered = enterSimulatedScene(emptyStorySimulationState(), 'intro', [
      {
        ...base,
        id: 'effect',
        entityType: 'Scene',
        entityId: 'intro',
        effectType: 'triggerSet',
        itemId: null,
        triggerName: 'met-guide',
      },
    ]);
    const result = evaluateSimulatedChoice(
      { id: 'choice' },
      [{ ...base, id: 'group', choiceId: 'choice', combinator: 'AND', order: 1 }],
      [
        {
          ...base,
          id: 'check',
          groupId: 'group',
          mode: 'enable',
          type: 'trigger',
          order: 1,
          sceneId: null,
          minVisits: null,
          itemId: null,
          itemPresence: null,
          triggerName: 'met-guide',
          triggerState: 'set',
        },
      ],
      entered,
    );
    expect(result.available).toBe(true);
    expect(entered.triggers.has('met-guide')).toBe(true);
  });

  it('does not mutate the supplied state while applying effects', () => {
    const state = emptyStorySimulationState();
    const next = applySimulationEffects(state, [
      {
        ...base,
        id: 'effect',
        entityType: 'Choice',
        entityId: 'choice',
        effectType: 'itemGrant',
        itemId: 'key',
        triggerName: null,
      },
    ]);
    expect(state.inventory.has('key')).toBe(false);
    expect(next.inventory.has('key')).toBe(true);
  });
});
