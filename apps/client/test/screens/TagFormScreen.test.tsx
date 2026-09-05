/** @jest-environment node */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import TagFormScreen from '../../src/screens/tags/TagFormScreen';

const mockGoBack = jest.fn();
let mockTagId: string | undefined;
const mockCreate = jest.fn();
const mockGet = jest.fn();
const mockAlert = jest.fn();
jest.mock('../../src/hooks/useScreenHeader', () => ({ useScreenHeader: () => {} }));
jest.mock('../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: false }),
}));
jest.mock('../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 24,
}));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { text: '#111', background: '#fff', primary: '#00f', error: '#f00', onPrimary: '#fff' },
  }),
}));
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { tagId: mockTagId } }),
}));
jest.mock('../../src/db', () => {
  const db = {};
  return { useDrizzle: () => db };
});
jest.mock('../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: () => ({ userId: 'user' }),
}));
jest.mock('../../src/state/storyStore', () => ({
  useStoryStore: () => ({ selectedStory: { id: 'story' } }),
}));
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../src/services/storymanagement/TagService', () => ({
  createTagService: () => ({ getById: mockGet, createTag: mockCreate }),
}));
jest.mock(
  '../../src/components/common/inputs/ColorPickerInput/ColorPickerInput',
  () => 'ColorPicker',
);
jest.mock('../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => 'Switch');

beforeEach(() => {
  jest.clearAllMocks();
  mockTagId = undefined;
});

it('preserves the draft on save failure and permits a retry', async () => {
  let fail!: (error: Error) => void;
  mockCreate.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const screen = await render(<TagFormScreen />);
  const name = await screen.findByLabelText('name');
  await fireEvent.changeText(name, 'Draft tag');
  // Do not await the press: save stays pending until `fail` runs, and `fireEvent` would wait on it.
  await act(async () => {
    void fireEvent.press(screen.getByText('create_tag'));
  });
  expect(screen.getByLabelText('name')).toBe(name);
  expect(screen.getByLabelText('name').props.value).toBe('Draft tag');
  await act(async () => {
    void fireEvent.press(screen.getByText('create_tag'));
  });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  await act(async () => {
    fail(new Error('failed'));
  });
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_tag');
  expect(screen.getByLabelText('name').props.value).toBe('Draft tag');
  mockCreate.mockResolvedValueOnce({ id: 'tag' });
  await fireEvent.press(screen.getByText('create_tag'));
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  log.mockRestore();
});

it('shows a missing-entity state instead of an empty editing form', async () => {
  mockTagId = 'missing';
  mockGet.mockResolvedValue(null);
  const log = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const screen = await render(<TagFormScreen />);
  expect(await screen.findByText('tag_data_missing')).toBeTruthy();
  expect(screen.queryByLabelText('name')).toBeNull();
  log.mockRestore();
});
