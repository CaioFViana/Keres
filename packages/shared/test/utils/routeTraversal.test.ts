import { describe, expect, it } from 'vitest';
import { validateRouteTraversal } from '../../utils/routeTraversal';

const active = { isDeleted: false };

describe('validateRouteTraversal', () => {
  it('replays scene and choice effects before evaluating the next step', () => {
    const result = validateRouteTraversal({
      steps: [
        { ...active, id: 'one', position: 1, sceneId: 'start', selectedChoiceId: 'start-middle' },
        { ...active, id: 'two', position: 2, sceneId: 'middle', selectedChoiceId: 'middle-end' },
        { ...active, id: 'three', position: 3, sceneId: 'end', selectedChoiceId: null },
      ],
      sceneIds: ['start', 'middle', 'end'],
      choices: [
        { ...active, id: 'start-middle', sceneId: 'start', nextSceneId: 'middle' },
        { ...active, id: 'middle-end', sceneId: 'middle', nextSceneId: 'end' },
      ],
      groups: [
        { ...active, id: 'middle-needs-key', choiceId: 'middle-end', combinator: 'AND', order: 1 },
      ],
      checks: [
        {
          ...active,
          id: 'key-grant',
          order: 1,
          groupId: 'middle-needs-key',
          mode: 'enable',
          type: 'inventory',
          sceneId: null,
          minVisits: null,
          itemId: 'key',
          itemPresence: 'has',
          triggerName: null,
          triggerState: null,
        },
      ],
      effects: [
        {
          ...active,
          id: 'grant-key',
          entityType: 'Choice',
          entityId: 'start-middle',
          effectType: 'itemGrant',
          itemId: 'key',
          triggerName: null,
        },
      ],
    });

    expect(result).toMatchObject({ valid: true, issues: [] });
    expect(result.finalState?.inventory.has('key')).toBe(true);
    expect(result.finalState?.sceneVisits.get('end')).toBe(1);
  });

  it('reports the precise route step when an edited condition makes its choice unavailable', () => {
    const result = validateRouteTraversal({
      steps: [
        { ...active, id: 'one', position: 1, sceneId: 'start', selectedChoiceId: 'continue' },
        { ...active, id: 'two', position: 2, sceneId: 'end', selectedChoiceId: null },
      ],
      sceneIds: ['start', 'end'],
      choices: [{ ...active, id: 'continue', sceneId: 'start', nextSceneId: 'end' }],
      groups: [
        { ...active, id: 'requires-trigger', choiceId: 'continue', combinator: 'AND', order: 1 },
      ],
      checks: [
        {
          ...active,
          id: 'requires-opened-gate',
          order: 1,
          groupId: 'requires-trigger',
          mode: 'enable',
          type: 'trigger',
          sceneId: null,
          minVisits: null,
          itemId: null,
          itemPresence: null,
          triggerName: 'opened-gate',
          triggerState: 'set',
        },
      ],
      effects: [],
    });

    expect(result).toEqual({
      valid: false,
      issues: [
        {
          kind: 'choice_unavailable',
          stepId: 'one',
          sceneId: 'start',
          choiceId: 'continue',
          failedCheckTypes: ['trigger'],
        },
      ],
      finalState: expect.any(Object),
    });
  });

  it('keeps structural failures distinct from simulated availability', () => {
    const result = validateRouteTraversal({
      steps: [{ ...active, id: 'one', position: 1, sceneId: 'missing', selectedChoiceId: null }],
      sceneIds: [],
      choices: [],
      groups: [],
      checks: [],
      effects: [],
    });

    expect(result).toEqual({
      valid: false,
      issues: [{ kind: 'structure', issue: 'scene_missing' }],
      finalState: null,
    });
  });
});
