/** @jest-environment node */
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: jest.fn(),
}));

import { renderHook } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { useNavigateToEntityDetail } from '../../src/hooks/useNavigateToEntityDetail';
import { useHeaderBackActionStore } from '../../src/state/headerBackActionStore';

const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useHeaderBackActionStore.getState().consumeCrossStackReturnAction();
  (useNavigation as unknown as jest.Mock).mockReturnValue({ getParent: () => ({ navigate }) });
});

it('navigates to the entity stack, screen and id param', async () => {
  const { result } = await renderHook(() => useNavigateToEntityDetail());

  result.current('Scene', 'scene-1');

  expect(navigate).toHaveBeenCalledWith('NarrativeElementsStack', {
    screen: 'SceneDetail',
    params: { sceneId: 'scene-1' },
  });
});

/**
 * The way back between stacks is what makes the destination's back button bring the origin screen, and not
 * the point the destination stack had stopped at. Without passing that on, callers using the hook (the
 * Plots screens opening a Scene, for instance) would lose the way back silently.
 */
it('forwards the cross-stack return action to the header back store', async () => {
  const { result } = await renderHook(() => useNavigateToEntityDetail());
  const returnToOrigin = jest.fn();

  result.current('Scene', 'scene-1', { onReturn: returnToOrigin });

  expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction()).toBe(returnToOrigin);
});

it('does nothing when the screen has no drawer parent', async () => {
  (useNavigation as unknown as jest.Mock).mockReturnValue({ getParent: () => undefined });
  const { result } = await renderHook(() => useNavigateToEntityDetail());

  result.current('Scene', 'scene-1');

  expect(navigate).not.toHaveBeenCalled();
});
