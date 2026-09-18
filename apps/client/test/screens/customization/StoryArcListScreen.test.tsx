import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockEnsureDefaultArc = jest.fn();
const mockGetArcsForStory = jest.fn();
const mockDeleteArc = jest.fn();
const mockAlert = jest.fn();
const mockUseScreenHeader = jest.fn();
let mockStory: { id: string } | null = { id: 'story-1' };
let mockCanEdit = true;
let mockUserId: string | null = 'user-1';
const mockDb = {};

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('@/src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('@/src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('@/src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('@/src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ term: (value: string) => value }),
}));
jest.mock('@/src/services/storymanagement/StoryArcService', () => ({
  __esModule: true,
  createStoryArcService: () => ({
    ensureDefaultArc: mockEnsureDefaultArc,
    getArcsForStory: mockGetArcsForStory,
    deleteArc: mockDeleteArc,
  }),
}));
jest.mock('@/src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: { selectedStory: unknown }) => unknown) =>
    selector({ selectedStory: mockStory }),
}));
jest.mock('@/src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('@/src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector: (state: { showNotification: unknown }) => unknown) =>
    selector({ showNotification: mockNotify }),
}));
jest.mock('@/src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#eee',
      error: '#f00',
      primary: '#00f',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('@/src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import StoryArcListScreen from '../../../src/screens/customization/StoryArcListScreen';

const makeArc = (overrides = {}) => ({
  id: 'arc-1',
  storyId: 'story-1',
  title: 'Prologue',
  description: null,
  sortOrder: 0,
  color: null,
  icon: null,
  themeOverride: null,
  isDefault: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStory = { id: 'story-1' };
  mockCanEdit = true;
  mockUserId = 'user-1';
  mockEnsureDefaultArc.mockResolvedValue(undefined);
  mockGetArcsForStory.mockResolvedValue([]);
  mockDeleteArc.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

it('ensures the default arc and shows the empty state', async () => {
  const view = await render(<StoryArcListScreen />);

  await waitFor(() => expect(mockGetArcsForStory).toHaveBeenCalledWith('story-1'));
  expect(mockEnsureDefaultArc).toHaveBeenCalledWith('user-1', 'story-1');
  expect(view.getByText('arcs_intro')).toBeTruthy();
  expect(view.getByText('arcs_empty')).toBeTruthy();
});

it('renders arc cards and opens the form on press', async () => {
  mockGetArcsForStory.mockResolvedValue([makeArc({ id: 'arc-1', title: 'Prologue' })]);
  const view = await render(<StoryArcListScreen />);

  await waitFor(() => expect(view.getByText('Prologue')).toBeTruthy());
  await fireEvent.press(view.getByText('Prologue'));
  expect(mockNavigate).toHaveBeenCalledWith('StoryArcForm', { arcId: 'arc-1' });
});

it('does not navigate when read-only', async () => {
  mockCanEdit = false;
  mockGetArcsForStory.mockResolvedValue([makeArc({ id: 'arc-1', title: 'Prologue' })]);
  const view = await render(<StoryArcListScreen />);

  await waitFor(() => expect(view.getByText('Prologue')).toBeTruthy());
  await fireEvent.press(view.getByText('Prologue'));
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockEnsureDefaultArc).not.toHaveBeenCalled();
});

it('registers the add header action', async () => {
  await render(<StoryArcListScreen />);

  const header = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    title: string;
    actions: { onPress: () => void; visible: boolean }[];
  };
  expect(header.title).toBe('arcs_title');
  expect(header.actions[0]!.visible).toBe(true);
  header.actions[0]!.onPress();
  expect(mockNavigate).toHaveBeenCalledWith('StoryArcForm', {});
});

it('deletes a non-default arc after confirmation', async () => {
  mockGetArcsForStory.mockResolvedValue([makeArc({ id: 'arc-2', title: 'Rising' })]);
  const view = await render(<StoryArcListScreen />);

  await waitFor(() => expect(view.getByText('Rising')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('delete'));
  expect(mockAlert).toHaveBeenCalled();

  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  const confirm = buttons.find((button) => button.text === 'delete');
  await confirm!.onPress!();
  expect(mockDeleteArc).toHaveBeenCalledWith('user-1', 'arc-2');
  expect(mockGetArcsForStory).toHaveBeenCalledTimes(2);
});

it('notifies when deletion fails', async () => {
  mockGetArcsForStory.mockResolvedValue([makeArc({ id: 'arc-2', title: 'Rising' })]);
  mockDeleteArc.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<StoryArcListScreen />);

  await waitFor(() => expect(view.getByText('Rising')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('delete'));
  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await buttons.find((button) => button.text === 'delete')!.onPress!();
  expect(mockNotify).toHaveBeenCalledWith('boom', 'error');
});

it('does nothing without a user or a story', async () => {
  mockUserId = null;
  mockGetArcsForStory.mockResolvedValue([makeArc({ id: 'arc-2', title: 'Rising' })]);
  const view = await render(<StoryArcListScreen />);

  await waitFor(() => expect(view.getByText('Rising')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('delete'));
  expect(mockAlert).not.toHaveBeenCalled();
  expect(mockDeleteArc).not.toHaveBeenCalled();

  mockStory = null;
  mockGetArcsForStory.mockClear();
  await render(<StoryArcListScreen />);
  await waitFor(() => expect(mockGetArcsForStory).not.toHaveBeenCalled());
});
