import { renderHook } from '@testing-library/react-native';
import { useLeaveScreen } from '@/src/hooks/nav/useLeaveScreen';
import { useHeaderBackActionStore } from '@/src/state/ui/headerBackActionStore';

const mockNavigation = {
  goBack: jest.fn(),
  getState: jest.fn(),
};
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
}));

beforeEach(() => {
  jest.clearAllMocks();
  useHeaderBackActionStore.getState().clearCrossStackReturnAction();
  mockNavigation.getState.mockReturnValue({ index: 0, routes: [{ name: 'StoryArcForm' }] });
});

describe('useLeaveScreen', () => {
  it('goes one screen back in its own stack when nothing opened it from elsewhere', async () => {
    const view = await renderHook(() => useLeaveScreen());

    view.result.current();

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('takes the way back to where it was opened from, once, instead of popping its stack', async () => {
    const wayBack = jest.fn();
    useHeaderBackActionStore.getState().setCrossStackReturnAction(wayBack, 'StoryArcForm');
    const view = await renderHook(() => useLeaveScreen());

    view.result.current();
    expect(wayBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    // The way back is spent: leaving again is the stack's own.
    view.result.current();
    expect(wayBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('leaves a way back registered for another screen where it is', async () => {
    const wayBack = jest.fn();
    useHeaderBackActionStore.getState().setCrossStackReturnAction(wayBack, 'StoryArcList');
    const view = await renderHook(() => useLeaveScreen());

    view.result.current();

    expect(wayBack).not.toHaveBeenCalled();
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(useHeaderBackActionStore.getState().crossStackReturnAction).toBe(wayBack);
  });
});
