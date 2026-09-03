import { describe, expect, it } from 'vitest';
import { validateRouteSteps } from '../../utils/routeValidation';

const baseStep = { isDeleted: false };

describe('validateRouteSteps', () => {
  it('accepts a possible path and permits a repeated scene visit', () => {
    expect(
      validateRouteSteps(
        [
          { ...baseStep, position: 1, sceneId: 'a', selectedChoiceId: 'a-b' },
          { ...baseStep, position: 2, sceneId: 'b', selectedChoiceId: 'b-a' },
          { ...baseStep, position: 3, sceneId: 'a', selectedChoiceId: null },
        ],
        ['a', 'b'],
        [
          { id: 'a-b', sceneId: 'a', nextSceneId: 'b', isDeleted: false },
          { id: 'b-a', sceneId: 'b', nextSceneId: 'a', isDeleted: false },
        ],
      ),
    ).toEqual([]);
  });

  it('reports a broken link without rewriting the route', () => {
    expect(
      validateRouteSteps(
        [
          { ...baseStep, position: 1, sceneId: 'a', selectedChoiceId: 'a-c' },
          { ...baseStep, position: 2, sceneId: 'b', selectedChoiceId: null },
        ],
        ['a', 'b'],
        [{ id: 'a-c', sceneId: 'a', nextSceneId: 'c', isDeleted: false }],
      ),
    ).toEqual(['choice_target_mismatch']);
  });
});
