import { renderHook } from '@testing-library/react-native';

const mockNavigation: { dispatch: jest.Mock; getParent: jest.Mock } = {
  dispatch: jest.fn(),
  getParent: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  __esModule: true,
  useNavigation: () => mockNavigation,
}));

import { useResetToStorySelection } from '../../../src/screens/storysettings/useResetToStorySelection';

it('resets the root navigator, however many navigators the screen sits inside', async () => {
  const root = { dispatch: jest.fn(), getParent: jest.fn(() => undefined) };
  const drawer = { dispatch: jest.fn(), getParent: jest.fn(() => root) };
  mockNavigation.getParent.mockReturnValue(drawer);
  const { result } = await renderHook(() => useResetToStorySelection());

  result.current();

  expect(root.dispatch).toHaveBeenCalledTimes(1);
  expect(root.dispatch.mock.calls[0][0]).toMatchObject({
    type: 'RESET',
    payload: { index: 0, routes: [{ name: 'StorySelection' }] },
  });
  expect(drawer.dispatch).not.toHaveBeenCalled();
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
});

it('resets its own navigator when there is none above it', async () => {
  mockNavigation.getParent.mockReturnValue(undefined);
  const { result } = await renderHook(() => useResetToStorySelection());

  result.current();

  expect(mockNavigation.dispatch).toHaveBeenCalledTimes(1);
});
