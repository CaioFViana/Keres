/** @jest-environment node */
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useScreenHeader } from '../../src/hooks/useScreenHeader';
import { setDocumentTitle } from '../../src/utils/documentTitle';

let mockFocused = true;
const mockParent = { setOptions: jest.fn() };
const mockNavigation = { setOptions: jest.fn(), getParent: jest.fn(() => mockParent) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(() => {
      if (mockFocused) return callback();
    }, [callback, mockFocused]);
  },
}));
jest.mock('../../src/utils/documentTitle', () => ({ setDocumentTitle: jest.fn() }));
jest.mock(
  '../../src/components/common/navigation/HeaderActions/HeaderActions',
  () => 'HeaderActions',
);

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
});

it('updates the explicit owner and clears inherited actions when returning to a screen without them', async () => {
  const hook = await renderHook<void, { title: string; edit: boolean }>(
    ({ title, edit }) =>
      useScreenHeader({
        target: 'parent',
        title,
        actions: edit
          ? [{ id: 'edit', icon: 'pencil-outline', label: 'Edit', onPress: jest.fn() }]
          : [],
      }),
    { initialProps: { title: 'Item', edit: true } },
  );
  expect(mockParent.setOptions).toHaveBeenLastCalledWith({
    title: 'Item',
    headerRight: expect.any(Function),
  });
  expect(mockNavigation.setOptions).not.toHaveBeenCalled();
  await hook.rerender({ title: 'Form', edit: false });
  expect(mockParent.setOptions).toHaveBeenLastCalledWith({ title: 'Form', headerRight: undefined });
  expect(setDocumentTitle).toHaveBeenLastCalledWith('Form');
});

it('keeps inline actions stable while invoking the latest command and permissions', async () => {
  const commands = jest.fn();
  const hook = await renderHook<void, { id: string; visible: boolean }>(
    ({ id, visible }) =>
      useScreenHeader({
        target: 'self',
        title: 'Detail',
        actions: [
          {
            id: 'edit',
            icon: 'pencil-outline',
            label: 'Edit',
            visible,
            onPress: () => commands(id),
          },
        ],
      }),
    { initialProps: { id: 'one', visible: true } },
  );
  const renderer = mockNavigation.setOptions.mock.calls.at(-1)[0].headerRight;
  const action = (renderer() as React.ReactElement<{ actions: { onPress(): void }[] }>).props
    .actions[0];
  await hook.rerender({ id: 'two', visible: true });
  expect(mockNavigation.setOptions).toHaveBeenCalledTimes(1);
  action.onPress();
  expect(commands).toHaveBeenLastCalledWith('two');
  await hook.rerender({ id: 'two', visible: false });
  action.onPress();
  expect(commands).toHaveBeenCalledTimes(1);
  expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({
    title: 'Detail',
    headerRight: undefined,
  });
});

it('does not overwrite another focused screen on blur, background updates or unmount', async () => {
  const hook = await renderHook<void, { title: string }>(
    ({ title }) => useScreenHeader({ target: 'parent', title }),
    {
      initialProps: { title: 'Original' },
    },
  );
  mockFocused = false;
  await hook.rerender({ title: 'Background' });
  expect(mockParent.setOptions).toHaveBeenCalledTimes(1);
  expect(setDocumentTitle).toHaveBeenCalledTimes(1);
  mockFocused = true;
  await hook.rerender({ title: 'Background' });
  expect(mockParent.setOptions).toHaveBeenLastCalledWith({
    title: 'Background',
    headerRight: undefined,
  });
  await hook.unmount();
  expect(mockParent.setOptions).toHaveBeenCalledTimes(2);
});

it('preserves specialized renderers and an intentional document title', async () => {
  const renderer = () => null;
  await renderHook(() =>
    useScreenHeader({
      target: 'self',
      title: 'Create arc',
      documentTitle: 'Arc',
      renderActions: renderer,
    }),
  );
  expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({
    title: 'Create arc',
    headerRight: renderer,
  });
  expect(setDocumentTitle).toHaveBeenLastCalledWith('Arc');
});
